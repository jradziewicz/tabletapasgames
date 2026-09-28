import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import {
    CorporationId,
    CorporatePowerId,
    CorporationState,
    HydratedCorporationState
} from '../model/corporation.js'
import { HydratedShipyardState, ShipyardState } from '../model/shipyard.js'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import {
    MAX_CARGO,
    applyScrappingEvent,
    canAffordNextShip,
    canOrderAnotherShip,
    deliverOrderedShips,
    emptyShipColumnCount,
    isForcedShipPurchase,
    maxCargoForCorporation,
    shipCost,
    totalShipCount
} from './shipOrdering.js'

function createTestGameState(playerCount = 4) {
    const players: Player[] = Array.from({ length: playerCount }, (_, index) => ({
        id: `p${index + 1}`,
        isHuman: true,
        userId: `u${index + 1}`,
        name: `Player ${index + 1}`,
        status: PlayerStatus.Joined
    }))

    const game: Game = {
        id: 'game-1',
        typeId: 'stellar-ventures',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Stellar Ventures Test',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }

    return new StellarVenturesGameInitializer().initializeGameState(game, state)
}

function createTestCorporation(overrides: Partial<CorporationState> = {}): HydratedCorporationState {
    const corporation: CorporationState = {
        id: CorporationId.PinkInc,
        active: true,
        treasury: 10,
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
    }
    return new HydratedCorporationState(corporation)
}

function createTestShipyard(overrides: Partial<ShipyardState> = {}): HydratedShipyardState {
    const shipyard: ShipyardState = {
        sections: [
            { level: 1, remainingShips: 9 },
            { level: 2, remainingShips: 7 },
            { level: 3, remainingShips: 9, scrapTargetLevel: 1 },
            { level: 5, remainingShips: 5, scrapTargetLevel: 2 },
            { level: 8, remainingShips: 0, unlimited: true, scrapTargetLevel: 3 }
        ],
        ...overrides
    }
    return new HydratedShipyardState(shipyard)
}

describe('totalShipCount / emptyShipColumnCount', () => {
    it('counts Ships in either the Ordered or Delivered row', () => {
        const corporation = createTestCorporation({
            orderedShipLevels: [1],
            deliveredShipLevels: [2, 3]
        })
        expect(totalShipCount(corporation)).toBe(3)
        expect(emptyShipColumnCount(corporation)).toBe(0)
    })

    it('leaves empty columns for a Corporation with fewer than 3 Ships', () => {
        const corporation = createTestCorporation({ orderedShipLevels: [1] })
        expect(emptyShipColumnCount(corporation)).toBe(2)
    })
})

describe('isForcedShipPurchase', () => {
    it('is true only when a Corporation has zero Ships anywhere on its Charter', () => {
        expect(isForcedShipPurchase(createTestCorporation())).toBe(true)
        expect(isForcedShipPurchase(createTestCorporation({ orderedShipLevels: [1] }))).toBe(false)
        expect(isForcedShipPurchase(createTestCorporation({ deliveredShipLevels: [2] }))).toBe(false)
    })
})

describe('shipCost', () => {
    it('equals the Ship level', () => {
        expect(shipCost(1)).toBe(1)
        expect(shipCost(2)).toBe(2)
        expect(shipCost(3)).toBe(3)
        expect(shipCost(5)).toBe(5)
        expect(shipCost(8)).toBe(8)
    })
})

describe('canAffordNextShip / canOrderAnotherShip', () => {
    it('checks affordability against the Shipyard current lowest available level', () => {
        const shipyard = createTestShipyard()
        expect(canAffordNextShip(shipyard, createTestCorporation({ treasury: 1 }))).toBe(true)
        expect(canAffordNextShip(shipyard, createTestCorporation({ treasury: 0 }))).toBe(false)
    })

    it('requires both an empty column and affordability', () => {
        const shipyard = createTestShipyard()
        const noRoom = createTestCorporation({
            orderedShipLevels: [1, 2, 3],
            treasury: 10
        })
        expect(canOrderAnotherShip(shipyard, noRoom)).toBe(false)

        const noFunds = createTestCorporation({ treasury: 0 })
        expect(canOrderAnotherShip(shipyard, noFunds)).toBe(false)

        const canOrder = createTestCorporation({ treasury: 1 })
        expect(canOrderAnotherShip(shipyard, canOrder)).toBe(true)
    })

    it('is false once the Shipyard has no ships left at all', () => {
        const emptyShipyard = createTestShipyard({
            sections: [{ level: 1, remainingShips: 0 }]
        })
        expect(canOrderAnotherShip(emptyShipyard, createTestCorporation())).toBe(false)
    })
})

describe('maxCargoForCorporation', () => {
    it('is always the flat MAX_CARGO, with or without Hyperdrive active', () => {
        expect(maxCargoForCorporation(createTestCorporation())).toBe(MAX_CARGO)

        // Confirmed by the game's co-designer: Hyperdrive grants an immediate +1 to actual CARGO
        // when drafted (see actions/draftPower.spec.ts) - it never raises the cap itself, which
        // stays a flat 13 for every Corporation.
        const withHyperdrive = createTestCorporation({ powers: [{ id: CorporatePowerId.Hyperdrive }] })
        expect(maxCargoForCorporation(withHyperdrive)).toBe(MAX_CARGO)
    })
})

describe('deliverOrderedShips', () => {
    it('clamps delivered CARGO at MAX_CARGO without Hyperdrive', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.cargo = MAX_CARGO - 2
        corporation.orderedShipLevels = [5]
        deliverOrderedShips(state)
        expect(corporation.cargo).toBe(MAX_CARGO)
        expect(corporation.deliveredShipLevels).toContain(5)
        expect(corporation.orderedShipLevels).toEqual([])
    })

    it('still clamps at the flat MAX_CARGO even with Hyperdrive active', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.powers.push({ id: CorporatePowerId.Hyperdrive })
        corporation.cargo = MAX_CARGO - 2
        corporation.orderedShipLevels = [5]
        deliverOrderedShips(state)
        expect(corporation.cargo).toBe(MAX_CARGO)
    })
})

describe('applyScrappingEvent', () => {
    it('removes ships of the target level from every Corporation, reducing CARGO only for Delivered removals', () => {
        const state = createTestGameState()
        const pink = state.getCorporation(CorporationId.PinkInc)
        pink.deliveredShipLevels = [1, 2]
        pink.orderedShipLevels = [1]
        pink.cargo = 5

        applyScrappingEvent(state, 1)

        expect(pink.deliveredShipLevels).toEqual([2])
        expect(pink.orderedShipLevels).toEqual([])
        expect(pink.cargo).toBe(4)
    })

    describe('Spare Parts', () => {
        it('pulls one Delivered Ship off the Charter without reducing CARGO, recording a pending offer', () => {
            const state = createTestGameState()
            const pink = state.getCorporation(CorporationId.PinkInc)
            pink.powers = [{ id: CorporatePowerId.SpareParts }]
            pink.deliveredShipLevels = [1]
            pink.cargo = 5

            applyScrappingEvent(state, 1)

            expect(pink.deliveredShipLevels).toEqual([])
            expect(pink.cargo).toBe(5)
            expect(state.pendingSparePartsCorporationId).toBe(CorporationId.PinkInc)
            expect(state.pendingSparePartsShipLevel).toBe(1)
        })

        it('only saves 1 Ship (limit 1 Ship) even if the event removes more than one at that level', () => {
            const state = createTestGameState()
            const pink = state.getCorporation(CorporationId.PinkInc)
            pink.powers = [{ id: CorporatePowerId.SpareParts }]
            pink.deliveredShipLevels = [1, 1]
            pink.cargo = 5

            applyScrappingEvent(state, 1)

            expect(pink.deliveredShipLevels).toEqual([])
            expect(pink.cargo).toBe(4)
            expect(state.pendingSparePartsCorporationId).toBe(CorporationId.PinkInc)
        })

        it('does not intercept Ordered Ships', () => {
            const state = createTestGameState()
            const pink = state.getCorporation(CorporationId.PinkInc)
            pink.powers = [{ id: CorporatePowerId.SpareParts }]
            pink.orderedShipLevels = [1]
            pink.cargo = 5

            applyScrappingEvent(state, 1)

            expect(pink.orderedShipLevels).toEqual([])
            expect(state.pendingSparePartsCorporationId).toBeUndefined()
        })

        it('does not trigger without a Delivered Ship at the target level', () => {
            const state = createTestGameState()
            const pink = state.getCorporation(CorporationId.PinkInc)
            pink.powers = [{ id: CorporatePowerId.SpareParts }]
            pink.deliveredShipLevels = [2]
            pink.cargo = 5

            applyScrappingEvent(state, 1)

            expect(state.pendingSparePartsCorporationId).toBeUndefined()
            expect(pink.cargo).toBe(5)
        })

        it('does not re-trigger while a pending or parked Spare Parts Ship already exists', () => {
            const state = createTestGameState()
            const pink = state.getCorporation(CorporationId.PinkInc)
            pink.powers = [{ id: CorporatePowerId.SpareParts }]
            pink.deliveredShipLevels = [1, 2]
            pink.cargo = 5
            state.pendingSparePartsCorporationId = CorporationId.PinkInc
            state.pendingSparePartsShipLevel = 3

            applyScrappingEvent(state, 1)

            expect(pink.deliveredShipLevels).toEqual([2])
            expect(pink.cargo).toBe(4)
            expect(state.pendingSparePartsShipLevel).toBe(3)
        })
    })
})
