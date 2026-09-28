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
import { DraftPowerStateHandler } from './draftPower.js'
import { HydratedDraftPower, DraftPower, isDraftPower } from '../actions/draftPower.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
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

    return new StellarVenturesGameInitializer().initializeGameState(game, state)
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

// Puts PinkInc into a pending Draft Power state with p1 as its President, as either Initial
// Auction or Sign The Agreement would set up.
function setUpPendingDraft(state: HydratedStellarVenturesGameState, resumeState: MachineState) {
    state.getCorporation(CorporationId.PinkInc).issueShareToPlayer('p1', 0)
    state.draftPowerCorporationId = CorporationId.PinkInc
    state.draftPowerResumeState = resumeState
    state.machineState = MachineState.DraftPower
}

describe('DraftPowerStateHandler', () => {
    it('makes only the pending Corporation\'s President the active player', () => {
        const state = createTestState()
        setUpPendingDraft(state, MachineState.InitialAuction)
        const handler = new DraftPowerStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.activePlayerIds).toEqual(['p1'])
        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.DraftPower])
        expect(handler.validActionsForPlayer('p2', context)).toEqual([])
    })

    it('adds the chosen Power to the Corporation and removes it from the available pool', () => {
        const state = createTestState()
        setUpPendingDraft(state, MachineState.InitialAuction)
        const handler = new DraftPowerStateHandler()
        const context = createMachineContext(state)
        const powerId = state.availableCorporatePowerIds[0]!
        const otherPowerIds = state.availableCorporatePowerIds.slice(1)

        const action = new HydratedDraftPower({
            id: 'draft-1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DraftPower,
            playerId: 'p1',
            powerId
        } as DraftPower)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(state.getCorporation(CorporationId.PinkInc).hasActivePower(powerId)).toBe(true)
        expect(state.availableCorporatePowerIds).toEqual(otherPowerIds)
        expect(state.draftPowerCorporationId).toBeUndefined()
        expect(state.draftPowerResumeState).toBeUndefined()
        expect(state.activePlayerIds).toEqual([])
        expect(nextState).toBe(MachineState.InitialAuction)
    })

    it('rejects a powerId not currently in the available pool', () => {
        const state = createTestState()
        setUpPendingDraft(state, MachineState.InitialAuction)
        expect(HydratedDraftPower.canDraftPower(state, 'p1', 'not-a-real-power')).toBe(false)
    })

    it('rejects a draft attempt from a non-President player', () => {
        const state = createTestState()
        setUpPendingDraft(state, MachineState.InitialAuction)
        const powerId = state.availableCorporatePowerIds[0]!
        expect(HydratedDraftPower.canDraftPower(state, 'p2', powerId)).toBe(false)
    })

    it('resumes at whatever draftPowerResumeState was set, e.g. IssueShare after the last Initial Auction draft', () => {
        const state = createTestState()
        // Simulate having already drafted for the other 4 corporations, leaving the pile
        // unrevealed and the queue empty, as the 5th (final) draft of Initial Auction would see.
        state.initialAuctionQueue = []
        setUpPendingDraft(state, MachineState.IssueShare)
        const handler = new DraftPowerStateHandler()
        const context = createMachineContext(state)
        const drawPileBefore = [...state.corporatePowerDrawPileIds]
        expect(drawPileBefore.length).toBeGreaterThan(0)
        const powerId = state.availableCorporatePowerIds[0]!

        const action = new HydratedDraftPower({
            id: 'draft-final',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DraftPower,
            playerId: 'p1',
            powerId
        } as DraftPower)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.IssueShare)
        // The draw pile is revealed into the available pool once the Initial Auction is over.
        expect(state.corporatePowerDrawPileIds).toEqual([])
        for (const id of drawPileBefore) {
            expect(state.availableCorporatePowerIds).toContain(id)
        }
    })

    it('Windfall resolves entirely inline: ₮5 to the Treasury, then discarded immediately', () => {
        const state = createTestState()
        setUpPendingDraft(state, MachineState.InitialAuction)
        const context = createMachineContext(state)
        // Force Windfall into the visible pool regardless of what Setup's shuffle actually dealt.
        state.availableCorporatePowerIds = [CorporatePowerId.Windfall, ...state.availableCorporatePowerIds]
        const corporation = state.getCorporation(CorporationId.PinkInc)
        const treasuryBefore = corporation.treasury

        const action = new HydratedDraftPower({
            id: 'draft-windfall',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DraftPower,
            playerId: 'p1',
            powerId: CorporatePowerId.Windfall
        } as DraftPower)
        action.apply(state, context)

        expect(corporation.treasury).toBe(treasuryBefore + 5)
        expect(corporation.hasActivePower(CorporatePowerId.Windfall)).toBe(false)
        // PinkInc still has its Setup Power (Alien Explorers) - only Windfall itself is gone.
        expect(corporation.powers).toEqual([{ id: CorporatePowerId.AlienExplorers }])
        // Discarded, not left in the visible pool either - it's gone from the game once drafted.
        expect(state.availableCorporatePowerIds).not.toContain(CorporatePowerId.Windfall)
    })

    it('Hyperdrive grants an immediate +1 CARGO and stays on the Charter (unlike Windfall)', () => {
        const state = createTestState()
        setUpPendingDraft(state, MachineState.InitialAuction)
        const context = createMachineContext(state)
        state.availableCorporatePowerIds = [
            CorporatePowerId.Hyperdrive,
            ...state.availableCorporatePowerIds
        ]
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.cargo = 3

        const action = new HydratedDraftPower({
            id: 'draft-hyperdrive',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DraftPower,
            playerId: 'p1',
            powerId: CorporatePowerId.Hyperdrive
        } as DraftPower)
        action.apply(state, context)

        expect(corporation.cargo).toBe(4)
        // Unlike Windfall, Hyperdrive is "Permanent" (no "then discard" in its Glossary text) -
        // it stays on the Charter even though its one-time CARGO effect already resolved.
        expect(corporation.hasActivePower(CorporatePowerId.Hyperdrive)).toBe(true)
        expect(state.availableCorporatePowerIds).not.toContain(CorporatePowerId.Hyperdrive)
    })

    it('Hyperdrive CARGO gain is clamped at MAX_CARGO, same as any other CARGO gain', () => {
        const state = createTestState()
        setUpPendingDraft(state, MachineState.InitialAuction)
        const context = createMachineContext(state)
        state.availableCorporatePowerIds = [
            CorporatePowerId.Hyperdrive,
            ...state.availableCorporatePowerIds
        ]
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.cargo = MAX_CARGO

        const action = new HydratedDraftPower({
            id: 'draft-hyperdrive-capped',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DraftPower,
            playerId: 'p1',
            powerId: CorporatePowerId.Hyperdrive
        } as DraftPower)
        action.apply(state, context)

        expect(corporation.cargo).toBe(MAX_CARGO)
    })

    it('isValidAction only accepts DraftPower actions', () => {
        const state = createTestState()
        setUpPendingDraft(state, MachineState.InitialAuction)
        const handler = new DraftPowerStateHandler()
        const context = createMachineContext(state)
        const powerId = state.availableCorporatePowerIds[0]!

        const action = new HydratedDraftPower({
            id: 'draft-1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DraftPower,
            playerId: 'p1',
            powerId
        } as DraftPower)

        expect(handler.isValidAction(action, context)).toBe(true)
        expect(isDraftPower(action)).toBe(true)
    })
})
