import { describe, expect, it } from 'vitest'
import { withPlayerAidTab } from './workspaceTabs.js'

describe('Player Aid tab in saved layouts', () => {
    it('goes right after the map, split or not', () => {
        expect(withPlayerAidTab({ v: 1, sidebar: [], main: ['board', 'tableau', 'aids'] })).toEqual({ v: 1, sidebar: [], main: ['board', 'playerAid', 'tableau', 'aids'] })
        expect(withPlayerAidTab({ v: 1, sidebar: [], main: ['rows', 50, ['market'], ['tableau', 'board']] })).toEqual({
            v: 1,
            sidebar: [],
            main: ['rows', 50, ['market'], ['tableau', 'board', 'playerAid']]
        })
    })

    it('stays where the player has put it', () => {
        const saved = { v: 1, sidebar: [], main: ['board', 'tableau', 'playerAid'] }
        expect(withPlayerAidTab(saved)).toBe(saved)
        expect(withPlayerAidTab(undefined)).toBeUndefined()
    })
})
