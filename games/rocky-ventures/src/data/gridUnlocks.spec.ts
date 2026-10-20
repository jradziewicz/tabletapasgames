import { describe, expect, it } from 'vitest'
import { hasBlueUnlockAt, hasRedUnlockAt } from './toolWeaponGrid.js'

describe('red / blue unlocks', () => {
    it('unlock on the circle itself', () => {
        expect(hasRedUnlockAt({ weapon: 2, tool: 4 })).toBe(true)
        expect(hasBlueUnlockAt({ weapon: 3, tool: 6 })).toBe(true)
    })

    it('unlock anywhere directly above a circle in the same tool column', () => {
        expect(hasRedUnlockAt({ weapon: 5, tool: 3 })).toBe(true)
        expect(hasRedUnlockAt({ weapon: 4, tool: 5 })).toBe(true)
        expect(hasBlueUnlockAt({ weapon: 5, tool: 7 })).toBe(true)
        expect(hasBlueUnlockAt({ weapon: 5, tool: 8 })).toBe(true)
    })

    it('do not unlock below a circle or in a column without one', () => {
        expect(hasRedUnlockAt({ weapon: 2, tool: 3 })).toBe(false)
        expect(hasRedUnlockAt({ weapon: 5, tool: 2 })).toBe(false)
        expect(hasBlueUnlockAt({ weapon: 4, tool: 4 })).toBe(false)
        expect(hasBlueUnlockAt({ weapon: 5, tool: 1 })).toBe(false)
    })
})
