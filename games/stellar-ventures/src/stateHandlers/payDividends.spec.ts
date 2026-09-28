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
import { PayDividendsStateHandler } from './payDividends.js'
import { HydratedPayDividends, isPayDividends } from '../actions/payDividends.js'
import {
    HydratedDeepSpaceSmuggling,
    DeepSpaceSmuggling
} from '../actions/deepSpaceSmuggling.js'
import { HydratedDeepSpacePirates, DeepSpacePirates } from '../actions/deepSpacePirates.js'
import {
    HydratedDeclinePayDividendsPower,
    DeclinePayDividendsPower
} from '../actions/declinePayDividendsPower.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId, CorporationStatus } from '../model/corporation.js'
import { dividendPayoutPerShare } from '../operations/dividends.js'
import { effectiveMiningCapacityForCorporation } from '../operations/corporatePowers.js'
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

    const pinkIncIndex = initialState.corporationTurnOrder.indexOf(CorporationId.PinkInc)
    initialState.activeCorporationIndex = pinkIncIndex
    initialState.machineState = MachineState.PayDividends

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
function runPayDividends(state: HydratedStellarVenturesGameState, handler: PayDividendsStateHandler) {
    const context = createMachineContext(state)
    handler.enter(context)

    const pending = context.getPendingActions()
    expect(pending).toHaveLength(1)
    expect(isPayDividends(pending[0])).toBe(true)

    const actionData = context.nextPendingAction()
    if (!actionData || !isPayDividends(actionData)) {
        throw Error('Expected a queued PayDividends action')
    }
    const action = new HydratedPayDividends(actionData)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    return action
}

function deepSpaceSmuggling(
    state: HydratedStellarVenturesGameState,
    handler: PayDividendsStateHandler,
    playerId: string,
    corporationId: CorporationId
) {
    const context = createMachineContext(state)
    const action = new HydratedDeepSpaceSmuggling({
        id: `deep-space-smuggling-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DeepSpaceSmuggling,
        playerId,
        corporationId
    } as DeepSpaceSmuggling)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.PayDividends) {
        handler.enter(context)
    }
}

function deepSpacePirates(
    state: HydratedStellarVenturesGameState,
    handler: PayDividendsStateHandler,
    playerId: string,
    corporationId: CorporationId
) {
    const context = createMachineContext(state)
    const action = new HydratedDeepSpacePirates({
        id: `deep-space-pirates-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DeepSpacePirates,
        playerId,
        corporationId
    } as DeepSpacePirates)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.PayDividends) {
        handler.enter(context)
    }
}

function declinePayDividendsPower(
    state: HydratedStellarVenturesGameState,
    handler: PayDividendsStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedDeclinePayDividendsPower({
        id: `decline-pay-dividends-power-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DeclinePayDividendsPower,
        playerId
    } as DeclinePayDividendsPower)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.PayDividends) {
        handler.enter(context)
    }
}

describe('PayDividendsStateHandler', () => {
    it('queues a System PayDividends action with no player involvement', () => {
        const state = createTestState()
        const handler = new PayDividendsStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.activePlayerIds).toEqual([])
        expect(handler.validActionsForPlayer('p1', context)).toEqual([])
        const pending = context.getPendingActions()
        expect(pending).toHaveLength(1)
        expect(pending[0]?.playerId).toBeUndefined()
        expect(isPayDividends(pending[0])).toBe(true)
    })

    it('pays every player-held Share the correct per-Share amount to Frozen Funds', () => {
        const state = createTestState()
        const handler = new PayDividendsStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)

        // p1 gets 1 Share, p2 gets 1 Share (Corporation is Minor -> 2 issued Shares).
        corporation.issueShareToPlayer('p1', 0)
        corporation.issueShareToPlayer('p2', 1)
        expect(corporation.status).toBe(CorporationStatus.Minor)

        // Give PinkInc some Cargo and let its Mining Capacity come from its Home Planet Outpost
        // alone (already placed at Setup) - whatever that yields is fine, since we read the
        // payout back out with the same formula the action itself uses for cross-checking below.
        corporation.cargo = 6

        const p1Before = state.getPlayerState('p1').frozenFunds
        const p2Before = state.getPlayerState('p2').frozenFunds

        const action = runPayDividends(state, handler)

        expect(action.payoutPerShare).toBeGreaterThan(0)
        expect(state.getPlayerState('p1').frozenFunds).toBe(p1Before + action.payoutPerShare!)
        expect(state.getPlayerState('p2').frozenFunds).toBe(p2Before + action.payoutPerShare!)
        expect(state.machineState).toBe(MachineState.OrderShips)
    })

    it('pays nothing for unissued Shares or Shares held by the Aliens', () => {
        const state = createTestState()
        const handler = new PayDividendsStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)

        corporation.issueShareToPlayer('p1', 0)
        corporation.issueShareToAlien(1)
        // The rest of PinkInc's Shares are left unissued.

        const p2Before = state.getPlayerState('p2').frozenFunds

        runPayDividends(state, handler)

        // p2 holds no Shares in PinkInc at all, so it should be untouched.
        expect(state.getPlayerState('p2').frozenFunds).toBe(p2Before)
        // No error should be thrown by the unissued/Alien Shares, and the state should still
        // advance normally.
        expect(state.machineState).toBe(MachineState.OrderShips)
    })

    it("factors in Ore Refinement's +3 Mining Capacity bonus for the payout row", () => {
        const state = createTestState()
        const handler = new PayDividendsStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer('p1', 0)
        corporation.cargo = 6
        corporation.powers.push({ id: CorporatePowerId.OreRefinement })

        const boostedMiningCapacity = state.board.miningCapacityForCorporation(CorporationId.PinkInc) + 3
        const expectedPayout = dividendPayoutPerShare(corporation.cargo, boostedMiningCapacity, corporation.status)

        const action = runPayDividends(state, handler)

        expect(action.payoutPerShare).toBe(expectedPayout)
    })

    it('moves on to Order Ships once Dividends are paid', () => {
        const state = createTestState()
        const handler = new PayDividendsStateHandler()
        runPayDividends(state, handler)
        expect(state.machineState).toBe(MachineState.OrderShips)
    })

    describe('Deep Space Smuggling', () => {
        it("offers Deep Space Smuggling to the active Corporation's President before the automatic payout", () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DeepSpaceSmuggling })
            corporation.issueShareToPlayer('p1', 0)
            const handler = new PayDividendsStateHandler()
            const context = createMachineContext(state)

            handler.enter(context)

            expect(state.activePlayerIds).toEqual(['p1'])
            expect(context.getPendingActions()).toHaveLength(0)
            expect(handler.validActionsForPlayer('p1', context)).toEqual(
                expect.arrayContaining([
                    ActionType.DeepSpaceSmuggling,
                    ActionType.DeclinePayDividendsPower
                ])
            )
        })

        it("copies the target Corporation's CARGO for the payout row, then discards the power", () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DeepSpaceSmuggling })
            corporation.issueShareToPlayer('p1', 0)
            corporation.cargo = 0

            const other = state.getCorporation(CorporationId.FrostFederated)
            other.cargo = 13

            const handler = new PayDividendsStateHandler()
            handler.enter(createMachineContext(state))
            deepSpaceSmuggling(state, handler, 'p1', CorporationId.FrostFederated)

            expect(corporation.powers).not.toContainEqual({ id: CorporatePowerId.DeepSpaceSmuggling })
            expect(state.machineState).toBe(MachineState.PayDividends)

            const miningCapacity = effectiveMiningCapacityForCorporation(state, CorporationId.PinkInc)
            const expectedPayout = dividendPayoutPerShare(other.cargo, miningCapacity, corporation.status)

            const action = runPayDividends(state, handler)
            expect(action.payoutPerShare).toBe(expectedPayout)
            expect(state.payDividendsCopyCargoFromCorporationId).toBeUndefined()
            // Resolved flags reset once the automatic payout actually runs.
            expect(state.payDividendsSmugglingOfferResolved).toBeUndefined()
        })

        it('resolves via decline, keeping the power and using this Corporation\'s own CARGO', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DeepSpaceSmuggling })
            corporation.issueShareToPlayer('p1', 0)
            corporation.cargo = 6

            const handler = new PayDividendsStateHandler()
            handler.enter(createMachineContext(state))
            declinePayDividendsPower(state, handler, 'p1')

            expect(corporation.powers).toContainEqual({ id: CorporatePowerId.DeepSpaceSmuggling })

            const miningCapacity = effectiveMiningCapacityForCorporation(state, CorporationId.PinkInc)
            const expectedPayout = dividendPayoutPerShare(corporation.cargo, miningCapacity, corporation.status)
            const action = runPayDividends(state, handler)
            expect(action.payoutPerShare).toBe(expectedPayout)
        })

        it('rejects targeting the active Corporation itself', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DeepSpaceSmuggling })
            corporation.issueShareToPlayer('p1', 0)

            expect(
                HydratedDeepSpaceSmuggling.canDeepSpaceSmuggling(state, 'p1', CorporationId.PinkInc)
            ).toBe(false)
        })
    })

    describe('Deep Space Pirates', () => {
        it("copies the target Corporation's Mining Capacity for the payout row, then discards the power", () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DeepSpacePirates })
            corporation.issueShareToPlayer('p1', 0)
            corporation.cargo = 13

            const other = state.getCorporation(CorporationId.FrostFederated)
            other.powers.push({ id: CorporatePowerId.OreRefinement })

            const handler = new PayDividendsStateHandler()
            handler.enter(createMachineContext(state))
            deepSpacePirates(state, handler, 'p1', CorporationId.FrostFederated)

            expect(corporation.powers).not.toContainEqual({ id: CorporatePowerId.DeepSpacePirates })

            const miningCapacity = effectiveMiningCapacityForCorporation(
                state,
                CorporationId.FrostFederated
            )
            const expectedPayout = dividendPayoutPerShare(corporation.cargo, miningCapacity, corporation.status)

            const action = runPayDividends(state, handler)
            expect(action.payoutPerShare).toBe(expectedPayout)
            expect(state.payDividendsCopyMiningCapacityFromCorporationId).toBeUndefined()
            expect(state.payDividendsPiratesOfferResolved).toBeUndefined()
        })
    })

    describe('Deep Space Smuggling and Deep Space Pirates held together', () => {
        it('offers both, one at a time, before the automatic payout', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DeepSpaceSmuggling })
            corporation.powers.push({ id: CorporatePowerId.DeepSpacePirates })
            corporation.issueShareToPlayer('p1', 0)
            corporation.cargo = 6

            const other = state.getCorporation(CorporationId.FrostFederated)
            other.cargo = 13

            const handler = new PayDividendsStateHandler()
            const context = createMachineContext(state)
            handler.enter(context)

            // Smuggling is offered first.
            expect(handler.validActionsForPlayer('p1', context)).toContain(
                ActionType.DeepSpaceSmuggling
            )
            deepSpaceSmuggling(state, handler, 'p1', CorporationId.FrostFederated)

            // Now Pirates.
            expect(state.machineState).toBe(MachineState.PayDividends)
            expect(context.getPendingActions()).toHaveLength(0)
            expect(handler.validActionsForPlayer('p1', context)).toContain(
                ActionType.DeepSpacePirates
            )
            declinePayDividendsPower(state, handler, 'p1')

            const action = runPayDividends(state, handler)
            expect(action.payoutPerShare).toBeGreaterThan(0)
            expect(state.payDividendsSmugglingOfferResolved).toBeUndefined()
            expect(state.payDividendsPiratesOfferResolved).toBeUndefined()
        })
    })

    describe('Spare Parts (parked Ship)', () => {
        it('finally Scraps a parked Ship for this Corporation, reducing CARGO before the payout is calculated', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer('p1', 0)
            corporation.cargo = 6

            state.sparePartsParkedCorporationId = CorporationId.PinkInc
            state.sparePartsParkedShipLevel = 2

            const handler = new PayDividendsStateHandler()
            const miningCapacity = effectiveMiningCapacityForCorporation(state, CorporationId.PinkInc)
            const expectedPayout = dividendPayoutPerShare(5, miningCapacity, corporation.status)

            const action = runPayDividends(state, handler)

            expect(corporation.cargo).toBe(5)
            expect(state.sparePartsParkedCorporationId).toBeUndefined()
            expect(state.sparePartsParkedShipLevel).toBeUndefined()
            expect(action.payoutPerShare).toBe(expectedPayout)
        })

        it("does not touch a Ship parked for a different Corporation", () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer('p1', 0)
            corporation.cargo = 6

            state.sparePartsParkedCorporationId = CorporationId.FrostFederated
            state.sparePartsParkedShipLevel = 2

            const handler = new PayDividendsStateHandler()
            runPayDividends(state, handler)

            expect(corporation.cargo).toBe(6)
            expect(state.sparePartsParkedCorporationId).toBe(CorporationId.FrostFederated)
            expect(state.sparePartsParkedShipLevel).toBe(2)
        })
    })
})
