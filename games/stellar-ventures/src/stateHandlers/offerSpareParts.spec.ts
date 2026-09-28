import {
    ActionSource,
    GameCategory,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { OfferSparePartsStateHandler } from './offerSpareParts.js'
import { HydratedSpareParts, SpareParts } from '../actions/spareParts.js'
import { HydratedDeclineSpareParts, DeclineSpareParts } from '../actions/declineSpareParts.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

function createTestState(playerCount = 4) {
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

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

// Puts PinkInc into a state where a Scrapping Event has just pulled one of its Delivered Ships
// off the Charter pending a Spare Parts decision - exactly as
// operations/shipOrdering.ts's applyScrappingEvent would leave it - then enters OfferSpareParts
// exactly as stateHandlers/orderShips.ts / scrapLowestShip.ts would detour into it.
function setUpPendingOffer(
    state: HydratedStellarVenturesGameState,
    presidentPlayerId: string,
    resumeState: MachineState
) {
    const corporation = state.getCorporation(CorporationId.PinkInc)
    corporation.issueShareToPlayer(presidentPlayerId, 0)
    corporation.powers = [{ id: CorporatePowerId.SpareParts }]
    corporation.cargo = 5

    state.pendingSparePartsCorporationId = CorporationId.PinkInc
    state.pendingSparePartsShipLevel = 2
    state.pendingSparePartsResumeState = resumeState
    state.machineState = MachineState.OfferSpareParts

    const handler = new OfferSparePartsStateHandler()
    handler.enter(createMachineContext(state))
    return handler
}

describe('OfferSparePartsStateHandler', () => {
    it('makes the Corporation President the only active player', () => {
        const state = createTestState()
        const handler = setUpPendingOffer(state, 'p1', MachineState.OrderShips)

        expect(state.activePlayerIds).toEqual(['p1'])
        const context = createMachineContext(state)
        expect(handler.validActionsForPlayer('p1', context)).toEqual(
            expect.arrayContaining([ActionType.SpareParts, ActionType.DeclineSpareParts])
        )
        expect(handler.validActionsForPlayer('p2', context)).toEqual([])
    })

    it('using Spare Parts parks the Ship, discards the One-Time Power, and resumes at the stored state', () => {
        const state = createTestState()
        const handler = setUpPendingOffer(state, 'p1', MachineState.OrderShips)
        const corporation = state.getCorporation(CorporationId.PinkInc)
        const context = createMachineContext(state)

        const action = new HydratedSpareParts({
            id: 'spare-parts-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.SpareParts,
            playerId: 'p1'
        } as SpareParts)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(state.sparePartsParkedCorporationId).toBe(CorporationId.PinkInc)
        expect(state.sparePartsParkedShipLevel).toBe(2)
        expect(corporation.cargo).toBe(5) // CARGO reduction still delayed
        expect(corporation.hasActivePower(CorporatePowerId.SpareParts)).toBe(false)

        expect(state.pendingSparePartsCorporationId).toBeUndefined()
        expect(state.pendingSparePartsShipLevel).toBeUndefined()
        expect(state.pendingSparePartsResumeState).toBeUndefined()
        expect(nextState).toBe(MachineState.OrderShips)
        expect(state.activePlayerIds).toEqual([])
    })

    it('declining Scraps the Ship for real now and keeps the Power for a future occurrence', () => {
        const state = createTestState()
        const handler = setUpPendingOffer(state, 'p1', MachineState.DeliverShips)
        const corporation = state.getCorporation(CorporationId.PinkInc)
        const context = createMachineContext(state)

        const action = new HydratedDeclineSpareParts({
            id: 'decline-spare-parts-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DeclineSpareParts,
            playerId: 'p1'
        } as DeclineSpareParts)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(corporation.cargo).toBe(4)
        expect(state.sparePartsParkedCorporationId).toBeUndefined()
        expect(corporation.hasActivePower(CorporatePowerId.SpareParts)).toBe(true)

        expect(state.pendingSparePartsCorporationId).toBeUndefined()
        expect(state.pendingSparePartsResumeState).toBeUndefined()
        expect(nextState).toBe(MachineState.DeliverShips)
    })

    it('rejects both actions from a non-President player', () => {
        const state = createTestState()
        setUpPendingOffer(state, 'p1', MachineState.OrderShips)
        expect(HydratedSpareParts.canSpareParts(state, 'p2')).toBe(false)
        expect(HydratedDeclineSpareParts.canDeclineSpareParts(state, 'p2')).toBe(false)
    })

    it('rejects both actions once there is nothing pending', () => {
        const state = createTestState()
        state.machineState = MachineState.OfferSpareParts
        expect(HydratedSpareParts.canSpareParts(state, 'p1')).toBe(false)
        expect(HydratedDeclineSpareParts.canDeclineSpareParts(state, 'p1')).toBe(false)
    })
})
