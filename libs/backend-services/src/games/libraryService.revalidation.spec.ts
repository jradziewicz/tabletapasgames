import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { SiteManifest } from '@tabletop/games-config'
import type { RedisCacheService } from '../cache/cacheService.js'
import { LibraryService } from './libraryService.js'

// A minimal stand-in for the Redis cache: enough of cacheGet / cachingGet / delete to
// exercise the periodic revalidation without a live Redis. Cache coherence itself is covered
// by libraryService.spec.ts against a real instance.
class FakeCache {
    store = new Map<string, unknown>()
    deletes = 0

    async cacheGet(key: string) {
        return this.store.has(key)
            ? { value: this.store.get(key), cached: true }
            : { value: undefined, cached: false }
    }

    async cachingGet<T>(key: string, produce: () => Promise<unknown>): Promise<T> {
        if (this.store.has(key)) return this.store.get(key) as T
        const value = await produce()
        this.store.set(key, value)
        return value as T
    }

    async delete(key: string) {
        this.deletes += 1
        this.store.delete(key)
    }
}

describe('manifest cache revalidation', () => {
    let directory: string
    let manifestPath: string
    let cache: FakeCache
    const cacheKey = 'site-manifest-test'
    const before: SiteManifest = {
        ...SiteManifest,
        frontend: { ...SiteManifest.frontend, version: '1.0.0' },
        games: []
    }
    const after: SiteManifest = {
        ...before,
        frontend: { ...before.frontend, version: '2.0.0' }
    }

    const service = (cacheSeconds = 60) =>
        new LibraryService(cache as unknown as RedisCacheService, {
            manifestPath,
            cacheKey,
            cacheSeconds
        })

    beforeEach(async () => {
        vi.useFakeTimers()
        directory = await mkdtemp(path.join(tmpdir(), 'manifest-revalidate-test-'))
        manifestPath = path.join(directory, 'manifest.json')
        cache = new FakeCache()
        await writeFile(manifestPath, JSON.stringify(before))
    })

    afterEach(async () => {
        vi.useRealTimers()
        await rm(directory, { recursive: true, force: true })
    })

    it('replaces a stale cached manifest with the deployed one on a fresh instance', async () => {
        // Another instance cached the old manifest, then a deploy uploaded a new file.
        cache.store.set(cacheKey, before)
        await writeFile(manifestPath, JSON.stringify(after))

        const changes: string[] = []
        const fresh = service()
        fresh.onManifestMismatch(({ next }) => changes.push(next.frontend.version))
        expect(await fresh.refreshManifest()).toEqual(after)
        expect(cache.store.get(cacheKey)).toEqual(after)
        expect(cache.deletes).toBe(1)
        // First load has no previous snapshot, so there is nothing to report as a mismatch.
        expect(changes).toEqual([])
    })

    it('notices a newly deployed manifest once the revalidation window has passed', async () => {
        const running = service(60)
        const changes: string[] = []
        running.onManifestMismatch(({ next }) => changes.push(next.frontend.version))
        expect(await running.refreshManifest()).toEqual(before)
        expect(cache.deletes).toBe(0)

        // Deploy a new manifest; inside the window the cached copy is still trusted.
        await writeFile(manifestPath, JSON.stringify(after))
        vi.advanceTimersByTime(30_000)
        expect(await running.refreshManifest()).toEqual(before)
        expect(changes).toEqual([])

        // Past the window the file is re-read, the cache replaced, and the change reported.
        vi.advanceTimersByTime(31_000)
        expect(await running.refreshManifest()).toEqual(after)
        expect(cache.store.get(cacheKey)).toEqual(after)
        expect(changes).toEqual(['2.0.0'])
        expect(cache.deletes).toBe(1)
    })

    it('leaves the cached manifest alone when the deployed file is unchanged', async () => {
        const running = service(60)
        await running.refreshManifest()
        vi.advanceTimersByTime(61_000)
        await running.refreshManifest()
        vi.advanceTimersByTime(61_000)
        await running.refreshManifest()
        expect(cache.deletes).toBe(0)
        expect(cache.store.get(cacheKey)).toEqual(before)
    })

    it('keeps serving the cached manifest when the deployed file is unreadable', async () => {
        cache.store.set(cacheKey, before)
        await rm(manifestPath)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        try {
            expect(await service().refreshManifest()).toEqual(before)
            expect(cache.deletes).toBe(0)
        } finally {
            warn.mockRestore()
        }
    })

    it('does not touch the cache when caching is disabled', async () => {
        const local = new LibraryService(cache as unknown as RedisCacheService, {
            manifestPath,
            cacheKey,
            useCache: false
        })
        expect(await local.refreshManifest()).toEqual(before)
        expect(cache.store.size).toBe(0)
        expect(cache.deletes).toBe(0)
    })
})
