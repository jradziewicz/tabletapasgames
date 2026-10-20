import { describe, expect, it } from 'vitest'
import { canMoveRight, canMoveUp } from './toolWeaponGrid.js'

describe('weapon / tool grid walls', () => {
    it('no longer blocks the two walls removed on 2026-10-20', () => {
        expect(canMoveRight({ weapon: 4, tool: 7 })).toBe(true)
        expect(canMoveUp({ weapon: 2, tool: 7 })).toBe(true)
    })

    it('still blocks the other printed and added walls', () => {
        expect(canMoveRight({ weapon: 5, tool: 2 })).toBe(false)
        expect(canMoveRight({ weapon: 2, tool: 5 })).toBe(false)
        expect(canMoveUp({ weapon: 3, tool: 4 })).toBe(false)
        expect(canMoveUp({ weapon: 3, tool: 5 })).toBe(false)
        expect(canMoveUp({ weapon: 1, tool: 3 })).toBe(false)
        expect(canMoveUp({ weapon: 3, tool: 1 })).toBe(false)
    })
})
