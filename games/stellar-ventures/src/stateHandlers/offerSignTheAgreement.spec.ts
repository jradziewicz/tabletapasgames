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
import { OfferSignTheAgreementStateHandler } from './offerSignTheAgreement.js'
import { DraftPowerStateHandler } from './draftPower.js'
import { HydratedSignTheAgreement, SignTheAgreement } from '../actions/signTheAgreement.js'
import {
    HydratedDeclineSignTheAgreement,
    DeclineSignTheAgreement
} from '../actions/declineSignTheAgreement.js'
import { HydratedDraftPower, DraftPower } from '../actions/draftPower.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

// Real Alien Planet hexes on the Alpha map (data/alphaBoard.ts) - see
// operations/agreement.spec.ts for the same fixed hex ids.
const ALIEN_PLANET_HEX_ID_1 = '6,0'
const ALIEN_PLANET_HEX_ID_2 = '1,1'

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

// Puts PinkInc into a state where it's just built its 2nd Alien Planet Outpost (on
// ALIEN_PLANET_HEX_ID_2) and qualifies to sign, then detours into OfferSignTheAgreement exactly
// as ExpandNetworkOrWormholeStateHandler / InvestorActionStateHandler would.
function setUpEligibleOffer(
    state: HydratedStellarVenturesGameState,
    presidentPlayerId: string,
    resumeState: MachineState,
    declineResumeState?: MachineState
) {
    const corporation = state.getCorporation(CorporationId.PinkInc)
    corporation.issueShareToPlayer(presidentPlayerId, 0)
    state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
    state.board.buildOutpost(ALIEN_PLANET_HEX_ID_2, CorporationId.PinkInc)

    state.signTheAgreementCorporationId = CorporationId.PinkInc
    state.signTheAgreementHexId = ALIEN_PLANET_HEX_ID_2
    state.signTheAgreementResumeState = resumeState
    state.signTheAgreementDeclineResumeState = declineResumeState
    state.machineState = MachineState.OfferSignTheAgreement

    const handler = new OfferSignTheAgreementStateHandler()
    handler.enter(createMachineContext(state))
    return handler
}

describe('OfferSignTheAgreementStateHandler', () => {
    it('makes the Corporation President the only active player, even if a Shareholder built', () => {
        const state = createTestState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        // p1 is President (2 Shares); p2 is merely a Shareholder (1 Share) - as if p2's Jerry-Rig
        // is what triggered this offer during Investor Shenanigans.
        corporation.issueShareToPlayer('p1', 0)
        corporation.issueShareToPlayer('p1', 1)
        corporation.issueShareToPlayer('p2', 2)
        expect(corporation.getPresidentPlayerId()).toBe('p1')

        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_2, CorporationId.PinkInc)
        state.signTheAgreementCorporationId = CorporationId.PinkInc
        state.signTheAgreementHexId = ALIEN_PLANET_HEX_ID_2
        state.signTheAgreementResumeState = MachineState.AlienTechAction
        state.machineState = MachineState.OfferSignTheAgreement

        const handler = new OfferSignTheAgreementStateHandler()
        handler.enter(createMachineContext(state))

        expect(state.activePlayerIds).toEqual(['p1'])
        expect(handler.validActionsForPlayer('p1', createMachineContext(state))).toEqual(
            expect.arrayContaining([ActionType.SignTheAgreement, ActionType.DeclineSignTheAgreement])
        )
        expect(handler.validActionsForPlayer('p2', createMachineContext(state))).toEqual([])
    })

    it('applies every Sign The Agreement effect and resumes at the stored resume state', () => {
        const state = createTestState()
        const handler = setUpEligibleOffer(state, 'p1', MachineState.PayDividends)
        const corporation = state.getCorporation(CorporationId.PinkInc)
        const chevrons = state.board.requireHex(ALIEN_PLANET_HEX_ID_2).alienAgreementTileChevrons ?? 0
        const miningCapacityBefore = state.alienCorporation.miningCapacity
        const availableSharesBefore = corporation.availableShareCount
        const frozenFundsBefore = state.getPlayerState('p1').frozenFunds
        const context = createMachineContext(state)

        expect(corporation.hasActivePower(CorporatePowerId.AlienExplorers)).toBe(true)

        const action = new HydratedSignTheAgreement({
            id: 'sign-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.SignTheAgreement,
            playerId: 'p1',
            hexId: ALIEN_PLANET_HEX_ID_2
        } as SignTheAgreement)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        // 1. Tile flipped, Mining Capacity increased by 3 per chevron.
        expect(state.board.requireHex(ALIEN_PLANET_HEX_ID_2).alienAgreementTileHidden).toBe(false)
        expect(state.alienCorporation.miningCapacity).toBe(miningCapacityBefore + chevrons * 3)
        // Signing always reveals a hidden tile, so Undo must not be able to step back past it -
        // see GameSession.undoableAction.
        expect(action.revealsInfo).toBe(true)

        // 2. Share issued to the Aliens (not to any player, and no funds change hands).
        expect(corporation.availableShareCount).toBe(availableSharesBefore - 1)

        // 3. Agreement Token placed - 2 Alien Planets at the moment of signing.
        expect(corporation.agreement).toEqual({ planetCountAtSigning: 2 })

        // 4. Bonus Dividend paid to every Shareholder's Frozen Funds (2-Planet section: 6/share).
        expect(state.getPlayerState('p1').frozenFunds).toBe(frozenFundsBefore + 6)

        // 5. Alien Explorers discarded, then Draft Power detours here before resuming (the game's
        // default Corporate Power pool is never empty at Setup, so this always fires).
        expect(corporation.hasActivePower(CorporatePowerId.AlienExplorers)).toBe(false)
        expect(nextState).toBe(MachineState.DraftPower)
        expect(state.draftPowerCorporationId).toBe(CorporationId.PinkInc)
        expect(state.draftPowerResumeState).toBe(MachineState.PayDividends)

        // Transient Sign The Agreement fields cleared regardless.
        expect(state.signTheAgreementCorporationId).toBeUndefined()
        expect(state.signTheAgreementHexId).toBeUndefined()
        expect(state.signTheAgreementResumeState).toBeUndefined()
        expect(state.signTheAgreementDeclineResumeState).toBeUndefined()

        // Drafting the replacement Power finally resumes at PayDividends, as signing itself
        // would have.
        const draftHandler = new DraftPowerStateHandler()
        const powerId = state.availableCorporatePowerIds[0]!
        const draftAction = new HydratedDraftPower({
            id: 'draft-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DraftPower,
            playerId: 'p1',
            powerId
        } as DraftPower)
        draftAction.apply(state, context)
        const finalState = draftHandler.onAction(draftAction, context)
        expect(corporation.hasActivePower(powerId)).toBe(true)
        expect(finalState).toBe(MachineState.PayDividends)
    })

    it('signing always resumes at signTheAgreementResumeState, even if a decline resume state is also set', () => {
        const state = createTestState()
        const handler = setUpEligibleOffer(
            state,
            'p1',
            MachineState.PayDividends,
            MachineState.ExpandNetworkOrWormhole
        )
        const context = createMachineContext(state)

        const action = new HydratedSignTheAgreement({
            id: 'sign-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.SignTheAgreement,
            playerId: 'p1',
            hexId: ALIEN_PLANET_HEX_ID_2
        } as SignTheAgreement)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        // Detours through Draft Power first (see the more detailed assertions in the test above),
        // but still carries PayDividends forward as the eventual resume state.
        expect(nextState).toBe(MachineState.DraftPower)
        expect(state.draftPowerResumeState).toBe(MachineState.PayDividends)
    })

    it('resumes at AlienTechAction when that is the stored resume state', () => {
        const state = createTestState()
        const handler = setUpEligibleOffer(state, 'p1', MachineState.AlienTechAction)
        const context = createMachineContext(state)

        const action = new HydratedDeclineSignTheAgreement({
            id: 'decline-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DeclineSignTheAgreement,
            playerId: 'p1'
        } as DeclineSignTheAgreement)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.AlienTechAction)
    })

    it('declining resumes at signTheAgreementDeclineResumeState when set, looping back to keep building', () => {
        const state = createTestState()
        const handler = setUpEligibleOffer(
            state,
            'p1',
            MachineState.PayDividends,
            MachineState.ExpandNetworkOrWormhole
        )
        const context = createMachineContext(state)

        const action = new HydratedDeclineSignTheAgreement({
            id: 'decline-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DeclineSignTheAgreement,
            playerId: 'p1'
        } as DeclineSignTheAgreement)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.ExpandNetworkOrWormhole)
    })

    it('declining leaves the tile hidden and the Corporation unchanged, only clearing state', () => {
        const state = createTestState()
        const handler = setUpEligibleOffer(state, 'p1', MachineState.PayDividends)
        const corporation = state.getCorporation(CorporationId.PinkInc)
        const availableSharesBefore = corporation.availableShareCount
        const context = createMachineContext(state)

        expect(HydratedDeclineSignTheAgreement.canDeclineSignTheAgreement(state, 'p1')).toBe(true)

        const action = new HydratedDeclineSignTheAgreement({
            id: 'decline-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DeclineSignTheAgreement,
            playerId: 'p1'
        } as DeclineSignTheAgreement)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(state.board.requireHex(ALIEN_PLANET_HEX_ID_2).alienAgreementTileHidden).toBe(true)
        expect(corporation.availableShareCount).toBe(availableSharesBefore)
        expect(corporation.agreement).toBeUndefined()
        expect(corporation.hasActivePower(CorporatePowerId.AlienExplorers)).toBe(true)
        expect(nextState).toBe(MachineState.PayDividends)
        expect(state.activePlayerIds).toEqual([])
    })

    it('rejects Sign The Agreement for a hex outside the eligible set', () => {
        const state = createTestState()
        setUpEligibleOffer(state, 'p1', MachineState.PayDividends)
        expect(
            HydratedSignTheAgreement.canSignTheAgreement(state, 'p1', ALIEN_PLANET_HEX_ID_1)
        ).toBe(false)
    })

    it('rejects both actions from a non-President player', () => {
        const state = createTestState()
        setUpEligibleOffer(state, 'p1', MachineState.PayDividends)
        expect(
            HydratedSignTheAgreement.canSignTheAgreement(state, 'p2', ALIEN_PLANET_HEX_ID_2)
        ).toBe(false)
        expect(HydratedDeclineSignTheAgreement.canDeclineSignTheAgreement(state, 'p2')).toBe(false)
    })
})
