import { describe, expect, it } from 'vitest'
import { canonicalUrl, isIndexablePath, normalizePath } from './seo'

describe('seo', () => {
    it('collapses duplicate spellings of a path', () => {
        expect(normalizePath('/about/')).toBe('/about')
        expect(normalizePath('/index.html')).toBe('/')
        expect(normalizePath('')).toBe('/')
        expect(canonicalUrl('/terms/')).toBe('https://play.tabletapasgames.com/terms')
        expect(canonicalUrl('/index.html')).toBe('https://play.tabletapasgames.com/')
    })

    it('only indexes public pages', () => {
        expect(isIndexablePath('/')).toBe(true)
        expect(isIndexablePath('/privacy/')).toBe(true)
        expect(isIndexablePath('/dashboard')).toBe(false)
        expect(isIndexablePath('/game/abc')).toBe(false)
        expect(isIndexablePath('/login')).toBe(false)
    })
})
