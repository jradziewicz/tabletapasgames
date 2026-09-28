import { describe, expect, it } from 'vitest'
import {
    CorporationId,
    CorporationState,
    CorporationStatus,
    CorporatePowerId,
    HydratedCorporationState
} from './corporation.js'

function createTestCorporation(overrides: Partial<CorporationState> = {}): HydratedCorporationState {
    return new HydratedCorporationState({
        id: CorporationId.FrostFederated,
        active: true,
        treasury: 0,
        shares: [],
        cargo: 0,
        orderedShipLevels: [],
        deliveredShipLevels: [],
        wormholeActive: false,
        powers: [],
        loanCount: 0,
        turnOrderPosition: 0,
        unbuiltOutposts: 0,
        ...overrides
    })
}

function issuedShares(count: number): CorporationState['shares'] {
    return Array.from({ length: count }, (_, index) => ({
        owner: { type: 'player' as const, playerId: 'p1' },
        issuedSequence: index
    }))
}

describe('HydratedCorporationState.status (Stalled IPO)', () => {
    it('becomes Major on its 4th Share issued without Stalled IPO', () => {
        const corporation = createTestCorporation({ shares: issuedShares(4) })
        expect(corporation.status).toBe(CorporationStatus.Major)
    })

    it("stays Minor on its 4th Share issued with Stalled IPO active - Major requires a 5th", () => {
        const corporation = createTestCorporation({
            shares: issuedShares(4),
            powers: [{ id: CorporatePowerId.StalledIPO }]
        })
        expect(corporation.status).toBe(CorporationStatus.Minor)
    })

    it('becomes Major on its 5th Share issued with Stalled IPO active', () => {
        const corporation = createTestCorporation({
            shares: issuedShares(5),
            powers: [{ id: CorporatePowerId.StalledIPO }]
        })
        expect(corporation.status).toBe(CorporationStatus.Major)
    })

    it('is still Minor at 2-3 Shares and Private below that, regardless of Stalled IPO', () => {
        const withPower = createTestCorporation({
            shares: issuedShares(2),
            powers: [{ id: CorporatePowerId.StalledIPO }]
        })
        expect(withPower.status).toBe(CorporationStatus.Minor)

        const noShares = createTestCorporation({
            powers: [{ id: CorporatePowerId.StalledIPO }]
        })
        expect(noShares.status).toBe(CorporationStatus.Private)
    })
})
