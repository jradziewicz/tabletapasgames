import {
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
import { AssignTurnOrderStateHandler } from './assignTurnOrder.js'
import { HydratedAssignTurnOrder, isAssignTurnOrder } from '../actions/assignTurnOrder.js'
import { CorporationId } from '../model/corporation.js'
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

    const initialState = new StellarVenturesGameInitializer().initializeGameState(game, state)
    initialState.machineState = MachineState.AssignTurnOrder
    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function runAssignTurnOrder(state: HydratedStellarVenturesGameState, handler: AssignTurnOrderStateHandler) {
    const context = createMachineContext(state)
    handler.enter(context)

    const pending = context.getPendingActions()
    expect(pending).toHaveLength(1)
    expect(isAssignTurnOrder(pending[0])).toBe(true)

    const actionData = context.nextPendingAction()
    if (!actionData || !isAssignTurnOrder(actionData)) {
        throw Error('Expected a queued AssignTurnOrder action')
    }
    const action = new HydratedAssignTurnOrder(actionData)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    return action
}

describe('AssignTurnOrderStateHandler', () => {
    it('queues a System AssignTurnOrder action with no player involvement', () => {
        const state = createTestState()
        const handler = new AssignTurnOrderStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.activePlayerIds).toEqual([])
        expect(handler.validActionsForPlayer('p1', context)).toEqual([])
        const pending = context.getPendingActions()
        expect(pending).toHaveLength(1)
        expect(pending[0]?.playerId).toBeUndefined()
        expect(isAssignTurnOrder(pending[0])).toBe(true)
    })

    it('reorders corporationTurnOrder by Mining Capacity and updates each turnOrderPosition', () => {
        const state = createTestState()
        const handler = new AssignTurnOrderStateHandler()
        const capacities: Partial<Record<CorporationId, number>> = {
            [CorporationId.PinkInc]: 1,
            [CorporationId.FrostFederated]: 50,
            [CorporationId.ScarletSyndicate]: 10,
            [CorporationId.CeruleanCouncil]: 5,
            [CorporationId.GambogeGuild]: 20
        }
        state.board.miningCapacityForCorporation = (corporationId) => capacities[corporationId] ?? 0

        runAssignTurnOrder(state, handler)

        expect(state.corporationTurnOrder).toEqual([
            CorporationId.FrostFederated,
            CorporationId.GambogeGuild,
            CorporationId.ScarletSyndicate,
            CorporationId.CeruleanCouncil,
            CorporationId.PinkInc
        ])
        state.corporationTurnOrder.forEach((corporationId, index) => {
            expect(state.getCorporation(corporationId).turnOrderPosition).toBe(index)
        })
    })

    it('passes the Director Marker to the next player clockwise', () => {
        const state = createTestState()
        const handler = new AssignTurnOrderStateHandler()
        const [p1, p2] = state.turnManager.turnOrder
        state.directorPlayerId = p1!

        runAssignTurnOrder(state, handler)

        expect(state.directorPlayerId).toBe(p2)
    })

    it('advances the Era counter', () => {
        const state = createTestState()
        const handler = new AssignTurnOrderStateHandler()
        state.era = 1

        runAssignTurnOrder(state, handler)

        expect(state.era).toBe(2)
    })

    it('moves on to a new Corporation Round, resetting activeCorporationIndex, outside Era 3', () => {
        const state = createTestState()
        const handler = new AssignTurnOrderStateHandler()
        state.era = 1
        state.activeCorporationIndex = state.corporationTurnOrder.length - 1

        runAssignTurnOrder(state, handler)

        expect(state.era).toBe(2)
        expect(state.machineState).toBe(MachineState.IssueShare)
        expect(state.activeCorporationIndex).toBe(0)
    })

    it('routes to Form Amethyst Agency when advancing into Era 3', () => {
        const state = createTestState()
        const handler = new AssignTurnOrderStateHandler()
        state.era = 2 // becomes 3 once Advance Era runs

        runAssignTurnOrder(state, handler)

        expect(state.era).toBe(3)
        expect(state.machineState).toBe(MachineState.FormAmethystAgency)
    })
})
