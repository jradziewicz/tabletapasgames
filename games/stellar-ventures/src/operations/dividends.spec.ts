import { describe, expect, it } from 'vitest'
import { CorporationStatus } from '../model/corporation.js'
import {
    DividendPayoutTable,
    dividendPayoutPerShare,
    dividendRowForCargo,
    dividendRowForMiningCapacity
} from './dividends.js'

describe('dividendRowForCargo', () => {
    it('maps 0-13 directly to the same row number', () => {
        expect(dividendRowForCargo(0)).toBe(0)
        expect(dividendRowForCargo(1)).toBe(1)
        expect(dividendRowForCargo(13)).toBe(13)
    })

    it('caps anything above 13 at row 13', () => {
        expect(dividendRowForCargo(14)).toBe(13)
        expect(dividendRowForCargo(100)).toBe(13)
    })
})

describe('dividendRowForMiningCapacity', () => {
    it('treats 0 (or negative) Mining Capacity as row 0', () => {
        expect(dividendRowForMiningCapacity(0)).toBe(0)
        expect(dividendRowForMiningCapacity(-5)).toBe(0)
    })

    it('bands 1-39 in groups of 3, rounding up to the next row', () => {
        expect(dividendRowForMiningCapacity(1)).toBe(1)
        expect(dividendRowForMiningCapacity(3)).toBe(1)
        expect(dividendRowForMiningCapacity(4)).toBe(2)
        expect(dividendRowForMiningCapacity(6)).toBe(2)
        expect(dividendRowForMiningCapacity(37)).toBe(13)
        expect(dividendRowForMiningCapacity(39)).toBe(13)
    })

    it('caps the "40+" overflow at row 13, same as everything else in that band', () => {
        expect(dividendRowForMiningCapacity(40)).toBe(13)
        expect(dividendRowForMiningCapacity(1000)).toBe(13)
    })
})

describe('dividendPayoutPerShare', () => {
    it('uses whichever of Cargo/Mining Capacity gives the lower row', () => {
        // Cargo=2 (row 2), Mining Capacity=10 (row 4) -> the lower row (2) wins.
        expect(dividendPayoutPerShare(2, 10, CorporationStatus.Private)).toBe(
            DividendPayoutTable[2]![CorporationStatus.Private]
        )
        // Mining Capacity=2 (row 1) is lower than Cargo=9 (row 9) -> row 1 wins.
        expect(dividendPayoutPerShare(9, 2, CorporationStatus.Major)).toBe(
            DividendPayoutTable[1]![CorporationStatus.Major]
        )
    })

    it('matches the exact rulebook board table at a few representative rows/columns', () => {
        expect(dividendPayoutPerShare(0, 0, CorporationStatus.Private)).toBe(2)
        expect(dividendPayoutPerShare(0, 0, CorporationStatus.Minor)).toBe(1)
        expect(dividendPayoutPerShare(0, 0, CorporationStatus.Major)).toBe(1)

        expect(dividendPayoutPerShare(6, 18, CorporationStatus.Private)).toBe(12)
        expect(dividendPayoutPerShare(6, 18, CorporationStatus.Minor)).toBe(6)
        expect(dividendPayoutPerShare(6, 18, CorporationStatus.Major)).toBe(3)

        expect(dividendPayoutPerShare(13, 39, CorporationStatus.Private)).toBe(26)
        expect(dividendPayoutPerShare(13, 39, CorporationStatus.Minor)).toBe(13)
        expect(dividendPayoutPerShare(13, 39, CorporationStatus.Major)).toBe(7)
    })
})
