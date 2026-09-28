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
import { LiquidationStateHandler } from './liquidation.js'
import { HydratedLiquidate, isLiquidate } from '../actions/liquidate.js'
import {
    HydratedBackroomDeal,
    BackroomDeal,
    BackroomDealDirection,
    BACKROOM_DEAL_MINING_CAPACITY_DELTA
} from '../actions/backroomDeal.js'
import { HydratedDeclineBackroomDeal, DeclineBackroomDeal } from '../actions/declineBackroomDeal.js'
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

    const initialState = new StellarVenturesGameInitializer().initializeGameState(game, state)
    initialState.machineState = MachineState.Liquidation
    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function runLiquidate(state: HydratedStellarVenturesGameState, handler: LiquidationStateHandler) {
    const context = createMachineContext(state)
    handler.enter(context)

    const pending = context.getPendingActions()
    expect(pending).toHaveLength(1)
    expect(isLiquidate(pending[0])).toBe(true)

    const actionData = context.nextPendingAction()
    if (!actionData || !isLiquidate(actionData)) {
        throw Error('Expected a queued Liquidate action')
    }
    const action = new HydratedLiquidate(actionData)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    return action
}

describe('LiquidationStateHandler', () => {
    it('queues a System Liquidate action with no player involvement', () => {
        const state = createTestState()
        const handler = new LiquidationStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.activePlayerIds).toEqual([])
        expect(handler.validActionsForPlayer('p1', context)).toEqual([])
        const pending = context.getPendingActions()
        expect(pending).toHaveLength(1)
        expect(pending[0]?.playerId).toBeUndefined()
        expect(isLiquidate(pending[0])).toBe(true)
    })

    it('delivers any still-Ordered Ships as part of applying Liquidate', () => {
        const state = createTestState()
        const handler = new LiquidationStateHandler()
        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        pinkInc.orderedShipLevels = [2]
        pinkInc.cargo = 1

        runLiquidate(state, handler)

        expect(pinkInc.orderedShipLevels).toEqual([])
        expect(pinkInc.deliveredShipLevels).toEqual([2])
        expect(pinkInc.cargo).toBe(3)
    })

    it("pays each player's Shares into their Liquid Funds as part of applying Liquidate", () => {
        const state = createTestState()
        const handler = new LiquidationStateHandler()
        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        pinkInc.cargo = 13
        pinkInc.issueShareToPlayer('p1', 0)
        const p1Before = state.getPlayerState('p1').liquidFunds

        runLiquidate(state, handler)

        expect(state.getPlayerState('p1').liquidFunds).toBeGreaterThan(p1Before)
    })

    it('moves on to EndOfGame', () => {
        const state = createTestState()
        const handler = new LiquidationStateHandler()

        runLiquidate(state, handler)

        expect(state.machineState).toBe(MachineState.EndOfGame)
    })

    describe('Backroom Deal', () => {
        it("offers Backroom Deal to its holder's President before queuing the automatic Liquidate, and withholds it", () => {
            const state = createTestState()
            const handler = new LiquidationStateHandler()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.BackroomDeal })
            pinkInc.issueShareToPlayer('p1', 0)
            const context = createMachineContext(state)

            handler.enter(context)

            expect(state.activePlayerIds).toEqual(['p1'])
            expect(context.getPendingActions()).toHaveLength(0)
            expect(handler.validActionsForPlayer('p1', context)).toEqual(
                expect.arrayContaining([ActionType.BackroomDeal, ActionType.DeclineBackroomDeal])
            )
        })

        it('moves the Alien Mining Capacity up by 1 row (+3), discards the power, and then proceeds to the automatic Liquidate', () => {
            const state = createTestState()
            const handler = new LiquidationStateHandler()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.BackroomDeal })
            pinkInc.issueShareToPlayer('p1', 0)
            const miningCapacityBefore = state.alienCorporation.miningCapacity

            const context = createMachineContext(state)
            handler.enter(context)
            const action = new HydratedBackroomDeal({
                id: 'backroom-deal-1',
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.BackroomDeal,
                playerId: 'p1',
                direction: BackroomDealDirection.Up
            } as BackroomDeal)
            action.apply(state, context)
            const nextState = handler.onAction(action, context)
            state.machineState = nextState as MachineState

            expect(state.alienCorporation.miningCapacity).toBe(
                miningCapacityBefore + BACKROOM_DEAL_MINING_CAPACITY_DELTA
            )
            expect(pinkInc.powers).not.toContainEqual({ id: CorporatePowerId.BackroomDeal })
            expect(state.backroomDealResolved).toBe(true)
            expect(state.machineState).toBe(MachineState.Liquidation)

            runLiquidate(state, handler)
            expect(state.machineState).toBe(MachineState.EndOfGame)
        })

        it('moves the Alien Mining Capacity down by 1 row (-3), floored at 0', () => {
            const state = createTestState()
            const handler = new LiquidationStateHandler()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.BackroomDeal })
            pinkInc.issueShareToPlayer('p1', 0)
            state.alienCorporation.miningCapacity = 1

            const context = createMachineContext(state)
            handler.enter(context)
            const action = new HydratedBackroomDeal({
                id: 'backroom-deal-1',
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.BackroomDeal,
                playerId: 'p1',
                direction: BackroomDealDirection.Down
            } as BackroomDeal)
            action.apply(state, context)

            expect(state.alienCorporation.miningCapacity).toBe(0)
        })

        it('resolves via decline without moving the Alien Mining Capacity or discarding the power', () => {
            const state = createTestState()
            const handler = new LiquidationStateHandler()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.BackroomDeal })
            pinkInc.issueShareToPlayer('p1', 0)
            const miningCapacityBefore = state.alienCorporation.miningCapacity

            const context = createMachineContext(state)
            handler.enter(context)
            const action = new HydratedDeclineBackroomDeal({
                id: 'decline-backroom-deal-1',
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.DeclineBackroomDeal,
                playerId: 'p1'
            } as DeclineBackroomDeal)
            action.apply(state, context)
            const nextState = handler.onAction(action, context)
            state.machineState = nextState as MachineState

            expect(state.alienCorporation.miningCapacity).toBe(miningCapacityBefore)
            expect(pinkInc.powers).toContainEqual({ id: CorporatePowerId.BackroomDeal })
            expect(state.backroomDealResolved).toBe(true)

            runLiquidate(state, handler)
            expect(state.machineState).toBe(MachineState.EndOfGame)
        })

        it('is never offered a 2nd time once resolved', () => {
            const state = createTestState()
            const handler = new LiquidationStateHandler()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.BackroomDeal })
            pinkInc.issueShareToPlayer('p1', 0)
            state.backroomDealResolved = true

            expect(HydratedBackroomDeal.canBackroomDeal(state, 'p1')).toBe(false)
            expect(HydratedDeclineBackroomDeal.canDeclineBackroomDeal(state, 'p1')).toBe(false)
        })

        it('rejects Backroom Deal from a non-President player', () => {
            const state = createTestState()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.BackroomDeal })
            pinkInc.issueShareToPlayer('p1', 0)

            expect(HydratedBackroomDeal.canBackroomDeal(state, 'p2')).toBe(false)
        })
    })
})
