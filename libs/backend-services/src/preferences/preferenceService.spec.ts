import { describe, expect, it } from 'vitest'
import * as Type from 'typebox'
import { PreferenceError, type PreferenceRecord, type TitlePreferenceDefinition } from '@tabletop/common'
import { PreferenceService } from './preferenceService.js'
import type { PreferenceStore } from './preferenceStore.js'

const schema = Type.Object({ sound: Type.Boolean() }, { additionalProperties: false })
const definition = {
    title: { schema, defaults: { sound: true }, version: 1 }
} satisfies TitlePreferenceDefinition<typeof schema>

function createService() {
    let stored: (PreferenceRecord | undefined)[] = [undefined]
    const store: PreferenceStore = {
        read: async () => stored,
        update: async (_userId, _scopes, change) => {
            stored = change(stored).records
            return stored as PreferenceRecord[]
        }
    }
    const cache = {
        cacheGetMulti: async () => [],
        cachingGetMulti: async () => [],
        readConsistently: async () => undefined,
        lockWhileWriting: async (_keys: string[], write: () => Promise<unknown>) => write()
    }
    return new PreferenceService(store, cache as never)
}

const change = { scope: 'title' as const, version: 1, set: { sound: false }, unset: [] }

describe('PreferenceService.update', () => {
    it('accepts the weak form of the current ETag that Cloudflare sends back after compressing', async () => {
        const service = createService()
        const { etag } = await service.read('u1', 'game', definition)

        const result = await service.update('u1', 'game', definition, change, `W/${etag}`)

        expect(result.data.title.values).toEqual({ sound: false })
    })

    it('still rejects a stale ETag with 412', async () => {
        const service = createService()
        const { etag } = await service.read('u1', 'game', definition)
        await service.update('u1', 'game', definition, change, etag)

        await expect(service.update('u1', 'game', definition, change, `W/${etag}`)).rejects.toMatchObject(
            new PreferenceError('Preferences changed; reload and retry', 412)
        )
    })
})
