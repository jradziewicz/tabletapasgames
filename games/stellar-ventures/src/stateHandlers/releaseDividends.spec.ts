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
import { ReleaseDividendsStateHandler } from './releaseDividends.js'
import { HydratedReleaseDividends, isReleaseDividends } from '../actions/releaseDividends.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

function createTestState(playerCount = 2) {
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
    initialState.machineState = MachineState.ReleaseDividends

    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

// Mirrors the real GameEngine.executeThroughRuntime loop closely enough to exercise the
// pending-action-queue mechanism faithfully: enter() queues a System action via
// context.addSystemAction, and this helper pops/applies/transitions exactly as the engine would,
// without any player ever submitting anything themselves.
function runReleaseDividends(
    state: HydratedStellarVenturesGameState,
    handler: ReleaseDividendsStateHandler
) {
    const context = createMachineContext(state)
    handler.enter(context)

    const pending = context.getPendingActions()
    expect(pending).toHaveLength(1)
    expect(isReleaseDividends(pending[0])).toBe(true)

    const actionData = context.nextPendingAction()
    if (!actionData || !isReleaseDividends(actionData)) {
        throw Error('Expected a queued ReleaseDividends action')
    }
    const action = new HydratedReleaseDividends(actionData)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    return action
}

describe('ReleaseDividendsStateHandler', () => {
    it('queues a System ReleaseDividends action with no player involvement', () => {
        const state = createTestState()
        const handler = new ReleaseDividendsStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.activePlayerIds).toEqual([])
        expect(handler.validActionsForPlayer('p1', context)).toEqual([])
        const pending = context.getPendingActions()
        expect(pending).toHaveLength(1)
        expect(pending[0]?.playerId).toBeUndefined()
        expect(isReleaseDividends(pending[0])).toBe(true)
    })

    it('moves every player\'s Frozen Funds to Liquid Funds, not just one Corporation\'s Shareholders', () => {
        const state = createTestState(3)
        const handler = new ReleaseDividendsStateHandler()

        // Simulate Frozen Funds having accumulated from Pay Dividends payouts across several
        // different Corporations during the Corporation Round just finished. Every player can
        // hold Shares in every Corporation (not just the ones they preside over), so this step
        // is not scoped to any single active Corporation.
        const p1 = state.getPlayerState('p1')
        const p2 = state.getPlayerState('p2')
        const p3 = state.getPlayerState('p3')
        p1.liquidFunds = 10
        p1.frozenFunds = 7
        p2.liquidFunds = 20
        p2.frozenFunds = 0
        p3.liquidFunds = 0
        p3.frozenFunds = 15

        runReleaseDividends(state, handler)

        expect(p1.liquidFunds).toBe(17)
        expect(p1.frozenFunds).toBe(0)
        expect(p2.liquidFunds).toBe(20)
        expect(p2.frozenFunds).toBe(0)
        expect(p3.liquidFunds).toBe(15)
        expect(p3.frozenFunds).toBe(0)
    })

    it('moves on to Boardroom Battle once Dividends are released', () => {
        const state = createTestState()
        const handler = new ReleaseDividendsStateHandler()
        runReleaseDividends(state, handler)
        expect(state.machineState).toBe(MachineState.BoardroomBattle)
    })
})
