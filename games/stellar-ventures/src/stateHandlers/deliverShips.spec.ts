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
import { DeliverShipsStateHandler } from './deliverShips.js'
import { HydratedDeliverShips, isDeliverShips } from '../actions/deliverShips.js'
import { CorporationId } from '../model/corporation.js'
import { MAX_CARGO } from '../operations/shipOrdering.js'
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
    initialState.machineState = MachineState.DeliverShips
    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function runDeliverShips(state: HydratedStellarVenturesGameState, handler: DeliverShipsStateHandler) {
    const context = createMachineContext(state)
    handler.enter(context)

    const pending = context.getPendingActions()
    expect(pending).toHaveLength(1)
    expect(isDeliverShips(pending[0])).toBe(true)

    const actionData = context.nextPendingAction()
    if (!actionData || !isDeliverShips(actionData)) {
        throw Error('Expected a queued DeliverShips action')
    }
    const action = new HydratedDeliverShips(actionData)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    return action
}

describe('DeliverShipsStateHandler', () => {
    it('queues a System DeliverShips action with no player involvement', () => {
        const state = createTestState()
        const handler = new DeliverShipsStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.activePlayerIds).toEqual([])
        expect(handler.validActionsForPlayer('p1', context)).toEqual([])
        const pending = context.getPendingActions()
        expect(pending).toHaveLength(1)
        expect(pending[0]?.playerId).toBeUndefined()
        expect(isDeliverShips(pending[0])).toBe(true)
    })

    it("moves every Corporation's Ordered Ships to Delivered Ships, increasing CARGO by the total level", () => {
        const state = createTestState()
        const handler = new DeliverShipsStateHandler()
        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        const frostFederated = state.getCorporation(CorporationId.FrostFederated)
        pinkInc.orderedShipLevels = [1, 2]
        pinkInc.cargo = 3
        frostFederated.orderedShipLevels = [5]
        frostFederated.cargo = 0

        runDeliverShips(state, handler)

        expect(pinkInc.orderedShipLevels).toEqual([])
        expect(pinkInc.deliveredShipLevels).toEqual([1, 2])
        expect(pinkInc.cargo).toBe(6) // 3 + (1 + 2)
        expect(frostFederated.orderedShipLevels).toEqual([])
        expect(frostFederated.deliveredShipLevels).toEqual([5])
        expect(frostFederated.cargo).toBe(5)
    })

    it('preserves any Ships already Delivered from a previous Era', () => {
        const state = createTestState()
        const handler = new DeliverShipsStateHandler()
        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        pinkInc.deliveredShipLevels = [1]
        pinkInc.orderedShipLevels = [2]
        pinkInc.cargo = 1

        runDeliverShips(state, handler)

        expect(pinkInc.deliveredShipLevels).toEqual([1, 2])
        expect(pinkInc.cargo).toBe(3)
    })

    it('clamps CARGO at MAX_CARGO, losing any excess (rulebook reminder)', () => {
        const state = createTestState()
        const handler = new DeliverShipsStateHandler()
        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        pinkInc.cargo = 12
        pinkInc.orderedShipLevels = [5, 8] // would be 12 + 13 = 25 uncapped

        runDeliverShips(state, handler)

        expect(pinkInc.cargo).toBe(MAX_CARGO)
    })

    it('leaves a Corporation with no Ordered Ships unchanged', () => {
        const state = createTestState()
        const handler = new DeliverShipsStateHandler()
        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        pinkInc.deliveredShipLevels = [2]
        pinkInc.cargo = 4

        runDeliverShips(state, handler)

        expect(pinkInc.deliveredShipLevels).toEqual([2])
        expect(pinkInc.cargo).toBe(4)
    })

    it('moves on to Assign Turn Order', () => {
        const state = createTestState()
        const handler = new DeliverShipsStateHandler()

        runDeliverShips(state, handler)

        expect(state.machineState).toBe(MachineState.AssignTurnOrder)
    })
})
