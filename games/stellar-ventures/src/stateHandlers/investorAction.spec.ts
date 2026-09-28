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
import { InvestorActionStateHandler } from './investorAction.js'
import { HydratedBlackMarket, BlackMarket } from '../actions/blackMarket.js'
import { HydratedPassInvestorAction, PassInvestorAction } from '../actions/passInvestorAction.js'
import { HydratedJerryRig, JerryRig } from '../actions/jerryRig.js'
import { HydratedPrivateContractor, PrivateContractor } from '../actions/privateContractor.js'
import { HydratedInsuranceFraud, InsuranceFraud } from '../actions/insuranceFraud.js'
import { HydratedFinishExpansion, FinishExpansion } from '../actions/finishExpansion.js'
import {
    HydratedDeclineSignTheAgreement,
    DeclineSignTheAgreement
} from '../actions/declineSignTheAgreement.js'
import { OfferSignTheAgreementStateHandler } from './offerSignTheAgreement.js'
import { ActionType } from '../definition/actions.js'
import { ExpandNetworkOutpostCosts } from '../operations/network.js'
import { HydratedAlienEngineering, AlienEngineering } from '../actions/alienEngineering.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { InvestorActionId } from '../model/investorBoard.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

// PinkInc's Home Planet on the Alpha map is '3,0'; '2,0' is a directly adjacent Deep Space hex
// (a valid Expand-Network-style build target, same as a Neutral Planet would be) - see
// stateHandlers/expandNetworkOrWormhole.spec.ts for the same fixed hex ids.
const ADJACENT_BUILDABLE_HEX_ID = '2,0'

// '6,0' is a real Alien Planet on the Alpha map (data/alphaBoard.ts), only chain-reachable from
// PinkInc's Home Planet ('3,0') by first building on '5,0' (a Neutral Planet directly adjacent to
// both) - '4,0' in between is a Sun and can never be built on. The JerryRig/PrivateContractor
// tests below pre-place an Outpost on '5,0' directly (bypassing the action machinery, since only
// the final build onto the Alien Planet is under test) to make '6,0' chain-adjacent.
const ALIEN_PLANET_HEX_ID = '6,0'
const ALIEN_PLANET_ADJACENT_HEX_ID = '5,0'

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
    initialState.machineState = MachineState.InvestorAction
    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

// Finds a real, currently buildable hex on the board adjacent to hexId - used to chain a 2nd
// Outpost build without depending on more of the Alpha map's exact topology than necessary.
function buildableNeighborOf(state: HydratedStellarVenturesGameState, hexId: string): string {
    const neighbor = Object.values(state.board.hexes).find(
        (hex) =>
            hex.id !== hexId &&
            state.board.isAdjacent(hexId, hex.id) &&
            state.board.canBuildOutpost(hex.id, CorporationId.PinkInc)
    )
    if (!neighbor) {
        throw Error(`No buildable neighbor found for ${hexId}`)
    }
    return neighbor.id
}

describe('InvestorActionStateHandler', () => {
    it('starts Investor Shenanigans with the Director as the only active player', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        expect(state.activePlayerIds).toEqual([state.directorPlayerId])
        expect(state.investorShenanigansPlayerOrder?.[0]).toBe(state.directorPlayerId)
        expect(state.investorShenanigansCurrentPlayerId).toBe(state.directorPlayerId)
    })

    it('only allows the current player to act, and always offers Pass', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const [current, other] = state.investorShenanigansPlayerOrder!
        // Drain the current player's Boardroom Votes so Black Market isn't offered either -
        // isolates this test to just the "only the current player, and Pass is always there"
        // behavior (Black Market's own gating is covered separately below).
        const currentPlayer = state.getPlayerState(current!)
        currentPlayer.spendBoardroomVotes(currentPlayer.boardroomVotes)
        const context = createMachineContext(state)

        expect(handler.validActionsForPlayer(other!, context)).toEqual([])
        expect(handler.validActionsForPlayer(current!, context)).toEqual([
            ActionType.PassInvestorAction
        ])
    })

    it('offers Black Market once the player has a Boardroom Vote to spend, and applies its effect', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const currentPlayerId = state.investorShenanigansCurrentPlayerId!
        const player = state.getPlayerState(currentPlayerId)
        const context = createMachineContext(state)

        expect(handler.validActionsForPlayer(currentPlayerId, context)).toEqual(
            expect.arrayContaining([ActionType.PassInvestorAction, ActionType.BlackMarket])
        )

        const votesBefore = player.boardroomVotes
        const cubesBefore = player.alienTechCubes

        const action = new HydratedBlackMarket({
            id: `black-market-${currentPlayerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.BlackMarket,
            playerId: currentPlayerId
        } as BlackMarket)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.AlienTechAction)
        expect(player.boardroomVotes).toBe(votesBefore - 1)
        expect(player.alienTechCubes).toBe(cubesBefore + 1)
        expect(player.lastInvestorActionId).toBe(InvestorActionId.BlackMarket)
    })

    it("rejects Black Market again next time until the player's disc leaves that action", () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))
        const playerId = state.investorShenanigansCurrentPlayerId!
        state.getPlayerState(playerId).lastInvestorActionId = InvestorActionId.BlackMarket

        expect(HydratedBlackMarket.canBlackMarket(state, playerId)).toBe(false)
        expect(
            handler.validActionsForPlayer(playerId, createMachineContext(state))
        ).not.toContain(ActionType.BlackMarket)
    })

    it("passing clears the player's Investor Action disc and moves on to their Alien Tech Action", () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        state.getPlayerState(playerId).lastInvestorActionId = InvestorActionId.JerryRig
        const context = createMachineContext(state)

        const action = new HydratedPassInvestorAction({
            id: `pass-investor-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.PassInvestorAction,
            playerId
        } as PassInvestorAction)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.AlienTechAction)
        expect(state.getPlayerState(playerId).lastInvestorActionId).toBeUndefined()
    })

    it('builds a free Outpost via Jerry-Rig for any Shareholder, not just the President', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        // A single Share makes them a Shareholder - Jerry-Rig doesn't require the President.
        corporation.issueShareToPlayer(playerId, state.actionCount)
        const treasuryBefore = corporation.treasury
        const context = createMachineContext(state)

        expect(handler.validActionsForPlayer(playerId, context)).toContain(ActionType.JerryRig)

        const action = new HydratedJerryRig({
            id: `jerry-rig-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.JerryRig,
            playerId,
            corporationId: CorporationId.PinkInc,
            hexId: ADJACENT_BUILDABLE_HEX_ID
        } as JerryRig)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.AlienTechAction)
        expect(state.board.hasOutpost(ADJACENT_BUILDABLE_HEX_ID, CorporationId.PinkInc)).toBe(true)
        expect(corporation.treasury).toBe(treasuryBefore) // free - no cost at all
        expect(state.getPlayerState(playerId).lastInvestorActionId).toBe(InvestorActionId.JerryRig)
    })

    it('awards an Alien Technology Cube for a Jerry-Rig build on an Alien Planet (Alien Explorers)', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        state.board.buildOutpost(ALIEN_PLANET_ADJACENT_HEX_ID, CorporationId.PinkInc)
        const cubesBefore = state.getPlayerState(playerId).alienTechCubes
        const context = createMachineContext(state)

        const action = new HydratedJerryRig({
            id: `jerry-rig-alien-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.JerryRig,
            playerId,
            corporationId: CorporationId.PinkInc,
            hexId: ALIEN_PLANET_HEX_ID
        } as JerryRig)
        action.apply(state, context)
        handler.onAction(action, context)

        expect(state.board.hasOutpost(ALIEN_PLANET_HEX_ID, CorporationId.PinkInc)).toBe(true)
        expect(state.getPlayerState(playerId).alienTechCubes).toBe(cubesBefore + 1)
    })

    it('builds Outposts one at a time via Private Contractor, deferring cost until FinishExpansion', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        const player = state.getPlayerState(playerId)
        const fundsBefore = player.liquidFunds
        const treasuryBefore = corporation.treasury
        const context = createMachineContext(state)

        const action = new HydratedPrivateContractor({
            id: `private-contractor-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.PrivateContractor,
            playerId,
            corporationId: CorporationId.PinkInc,
            hexId: ADJACENT_BUILDABLE_HEX_ID
        } as PrivateContractor)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        // The build stays open - not eligible to sign, so play loops back to InvestorAction
        // rather than advancing, and the cost is deferred.
        expect(nextState).toBe(MachineState.InvestorAction)
        expect(state.board.hasOutpost(ADJACENT_BUILDABLE_HEX_ID, CorporationId.PinkInc)).toBe(true)
        expect(player.liquidFunds).toBe(fundsBefore)
        expect(corporation.treasury).toBe(treasuryBefore)

        // Only PrivateContractor (continue) and FinishExpansion (stop) remain valid mid-build.
        expect(handler.validActionsForPlayer(playerId, context)).toEqual(
            expect.arrayContaining([ActionType.FinishExpansion, ActionType.PrivateContractor])
        )
        expect(handler.validActionsForPlayer(playerId, context)).not.toContain(
            ActionType.PassInvestorAction
        )

        const finishAction = new HydratedFinishExpansion({
            id: `finish-expansion-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.FinishExpansion,
            playerId
        } as FinishExpansion)
        finishAction.apply(state, context)
        const finalState = handler.onAction(finishAction, context)

        expect(finalState).toBe(MachineState.AlienTechAction)
        expect(player.liquidFunds).toBe(fundsBefore - ExpandNetworkOutpostCosts[1]!)
        expect(corporation.treasury).toBe(treasuryBefore) // paid personally, not from the Treasury
    })

    it('allows placing a 2nd Private Contractor Outpost before finishing, charged as one lump sum', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        const player = state.getPlayerState(playerId)
        const fundsBefore = player.liquidFunds
        const context = createMachineContext(state)

        const buildAt = (hexId: string) => {
            const action = new HydratedPrivateContractor({
                id: `private-contractor-${playerId}-${hexId}`,
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.PrivateContractor,
                playerId,
                corporationId: CorporationId.PinkInc,
                hexId
            } as PrivateContractor)
            action.apply(state, context)
            return handler.onAction(action, context)
        }

        expect(buildAt(ADJACENT_BUILDABLE_HEX_ID)).toBe(MachineState.InvestorAction)
        // Chain a 2nd Outpost off the one just built.
        const secondHexId = buildableNeighborOf(state, ADJACENT_BUILDABLE_HEX_ID)
        expect(buildAt(secondHexId)).toBe(MachineState.InvestorAction)
        expect(player.liquidFunds).toBe(fundsBefore) // still deferred

        const finishAction = new HydratedFinishExpansion({
            id: `finish-expansion-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.FinishExpansion,
            playerId
        } as FinishExpansion)
        finishAction.apply(state, context)
        handler.onAction(finishAction, context)

        expect(player.liquidFunds).toBe(fundsBefore - ExpandNetworkOutpostCosts[2]!)
    })

    it('awards an Alien Technology Cube for a Private Contractor build on an Alien Planet', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        state.board.buildOutpost(ALIEN_PLANET_ADJACENT_HEX_ID, CorporationId.PinkInc)
        const player = state.getPlayerState(playerId)
        const cubesBefore = player.alienTechCubes
        const context = createMachineContext(state)

        const action = new HydratedPrivateContractor({
            id: `private-contractor-alien-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.PrivateContractor,
            playerId,
            corporationId: CorporationId.PinkInc,
            hexId: ALIEN_PLANET_HEX_ID
        } as PrivateContractor)
        action.apply(state, context)
        handler.onAction(action, context)

        expect(state.board.hasOutpost(ALIEN_PLANET_HEX_ID, CorporationId.PinkInc)).toBe(true)
        expect(player.alienTechCubes).toBe(cubesBefore + 1)
    })

    it('detours to OfferSignTheAgreement after a qualifying Jerry-Rig build, offering it to the President even if a different Shareholder built', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const actingPlayerId = state.investorShenanigansCurrentPlayerId!
        const presidentPlayerId = state.players.find((p) => p.playerId !== actingPlayerId)!.playerId
        const corporation = state.getCorporation(CorporationId.PinkInc)
        // presidentPlayerId holds 2 Shares (President); actingPlayerId holds just 1 (a
        // Shareholder, enough to Jerry-Rig, but not enough to be President).
        corporation.issueShareToPlayer(presidentPlayerId, 0)
        corporation.issueShareToPlayer(presidentPlayerId, 1)
        corporation.issueShareToPlayer(actingPlayerId, 2)
        expect(corporation.getPresidentPlayerId()).toBe(presidentPlayerId)

        // Pre-place an Outpost on a 2nd Alien Planet - ALIEN_PLANET_HEX_ID (built below) will be
        // the 2nd, satisfying "Outposts on 2+ Alien Planets".
        state.board.buildOutpost('1,1', CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_ADJACENT_HEX_ID, CorporationId.PinkInc)
        const context = createMachineContext(state)

        const action = new HydratedJerryRig({
            id: `jerry-rig-${actingPlayerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.JerryRig,
            playerId: actingPlayerId,
            corporationId: CorporationId.PinkInc,
            hexId: ALIEN_PLANET_HEX_ID
        } as JerryRig)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.OfferSignTheAgreement)
        expect(state.signTheAgreementCorporationId).toBe(CorporationId.PinkInc)
        expect(state.signTheAgreementHexId).toBe(ALIEN_PLANET_HEX_ID)
        expect(state.signTheAgreementResumeState).toBe(MachineState.AlienTechAction)
        // Jerry-Rig is one-shot - nothing to continue, so declining also just resumes at
        // AlienTechAction (declineResumeState stays unset, defaulting to resumeState).
        expect(state.signTheAgreementDeclineResumeState).toBeUndefined()
    })

    it('detours to OfferSignTheAgreement after a qualifying Private Contractor build, remembering how to resume if declined', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        state.board.buildOutpost('1,1', CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_ADJACENT_HEX_ID, CorporationId.PinkInc)
        const context = createMachineContext(state)

        const action = new HydratedPrivateContractor({
            id: `private-contractor-sign-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.PrivateContractor,
            playerId,
            corporationId: CorporationId.PinkInc,
            hexId: ALIEN_PLANET_HEX_ID
        } as PrivateContractor)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.OfferSignTheAgreement)
        expect(state.signTheAgreementHexId).toBe(ALIEN_PLANET_HEX_ID)
        expect(state.signTheAgreementResumeState).toBe(MachineState.AlienTechAction)
        // Private Contractor has more it could build - declining should loop back to InvestorAction.
        expect(state.signTheAgreementDeclineResumeState).toBe(MachineState.InvestorAction)
    })

    it('declining the Sign The Agreement offer lets the Private Contractor build continue instead of ending it', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        const offerHandler = new OfferSignTheAgreementStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        state.board.buildOutpost('1,1', CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_ADJACENT_HEX_ID, CorporationId.PinkInc)
        const player = state.getPlayerState(playerId)
        const fundsBefore = player.liquidFunds
        const context = createMachineContext(state)

        const action = new HydratedPrivateContractor({
            id: `private-contractor-decline-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.PrivateContractor,
            playerId,
            corporationId: CorporationId.PinkInc,
            hexId: ALIEN_PLANET_HEX_ID
        } as PrivateContractor)
        action.apply(state, context)
        state.machineState = handler.onAction(action, context) as MachineState
        expect(state.machineState).toBe(MachineState.OfferSignTheAgreement)

        const declineAction = new HydratedDeclineSignTheAgreement({
            id: `decline-sign-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DeclineSignTheAgreement,
            playerId
        } as DeclineSignTheAgreement)
        declineAction.apply(state, context)
        state.machineState = offerHandler.onAction(declineAction, context) as MachineState
        handler.enter(context)

        expect(state.machineState).toBe(MachineState.InvestorAction)
        expect(player.liquidFunds).toBe(fundsBefore) // still deferred
        expect(state.board.requireHex(ALIEN_PLANET_HEX_ID).alienAgreementTileHidden).toBe(true)

        const finishAction = new HydratedFinishExpansion({
            id: `finish-expansion-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.FinishExpansion,
            playerId
        } as FinishExpansion)
        finishAction.apply(state, context)
        const finalState = handler.onAction(finishAction, context)

        expect(finalState).toBe(MachineState.AlienTechAction)
        expect(player.liquidFunds).toBe(fundsBefore - ExpandNetworkOutpostCosts[1]!)
    })

    it('does not detour to OfferSignTheAgreement for non-build Investor Actions', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const player = state.getPlayerState(playerId)
        const context = createMachineContext(state)
        // Every player starts with 1 Alien Technology Cube already (Setup - see
        // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts), on top of whatever Black
        // Market itself grants - assert relative to that rather than assuming a 0 starting count.
        const cubesBefore = player.alienTechCubes

        const action = new HydratedBlackMarket({
            id: `black-market-no-detour-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.BlackMarket,
            playerId
        } as BlackMarket)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.AlienTechAction)
        expect(state.signTheAgreementCorporationId).toBeUndefined()
        expect(player.alienTechCubes).toBe(cubesBefore + 1)
    })

    it('scraps a Delivered Ship via Insurance Fraud, reimbursing the Corporate Treasury', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount) // their only Share - President
        corporation.deliveredShipLevels = [3]
        corporation.cargo = 5
        const treasuryBefore = corporation.treasury
        const context = createMachineContext(state)

        expect(corporation.getPresidentPlayerId()).toBe(playerId)

        const action = new HydratedInsuranceFraud({
            id: `insurance-fraud-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.InsuranceFraud,
            playerId,
            corporationId: CorporationId.PinkInc,
            shipLevel: 3
        } as InsuranceFraud)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.AlienTechAction)
        expect(corporation.deliveredShipLevels).toEqual([])
        expect(corporation.cargo).toBe(4)
        expect(corporation.treasury).toBe(treasuryBefore + 3)
    })

    it('does not offer Insurance Fraud to a Shareholder who is not President', () => {
        const state = createTestState()
        const handler = new InvestorActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const otherPlayerId = state.players.find((p) => p.playerId !== playerId)!.playerId
        const corporation = state.getCorporation(CorporationId.PinkInc)
        // otherPlayerId holds more Shares and is President; playerId holds just 1 - a Shareholder,
        // but not President.
        corporation.issueShareToPlayer(otherPlayerId, state.actionCount)
        corporation.issueShareToPlayer(otherPlayerId, state.actionCount + 1)
        corporation.issueShareToPlayer(playerId, state.actionCount + 2)
        corporation.deliveredShipLevels = [3]

        expect(corporation.getPresidentPlayerId()).toBe(otherPlayerId)
        expect(HydratedInsuranceFraud.canOfferInsuranceFraud(state, playerId)).toBe(false)
    })

    describe('Alien Engineering', () => {
        it('reclaims Cargo Boost cubes for free during Investor Action, WITHOUT advancing to Alien Tech Action', () => {
            const state = createTestState()
            const handler = new InvestorActionStateHandler()
            handler.enter(createMachineContext(state))

            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.AlienEngineering })
            corporation.cargo = 5
            corporation.cargoBoostCubesOnCharter = 3
            const player = state.getPlayerState(playerId)
            const cubesBefore = player.alienTechCubes
            const context = createMachineContext(state)

            expect(handler.validActionsForPlayer(playerId, context)).toContain(
                ActionType.AlienEngineering
            )

            const action = new HydratedAlienEngineering({
                id: `alien-engineering-${playerId}`,
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.AlienEngineering,
                playerId,
                corporationId: CorporationId.PinkInc,
                cargoBoostCubesToReclaim: 2,
                reclaimWormhole: false
            } as AlienEngineering)
            action.apply(state, context)
            const nextState = handler.onAction(action, context)

            // Same "genuinely extra, free action" treatment as the Alien Tech Action half (see
            // stateHandlers/alienTechAction.spec.ts) - loops back here rather than advancing.
            expect(nextState).toBe(MachineState.InvestorAction)
            expect(state.investorShenanigansCurrentPlayerId).toBe(playerId)
            expect(corporation.cargo).toBe(3)
            expect(corporation.cargoBoostCubesOnCharter).toBe(1)
            expect(player.alienTechCubes).toBe(cubesBefore + 2)
        })

        it('is still offered mid-Private-Contractor-build', () => {
            const state = createTestState()
            const handler = new InvestorActionStateHandler()
            handler.enter(createMachineContext(state))

            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.AlienEngineering })
            corporation.cargoBoostCubesOnCharter = 1
            // Simulate a Private Contractor build already in progress by this same player.
            state.expandingKind = ActionType.PrivateContractor
            state.expandingBuilderId = playerId
            state.expandingCorporationId = CorporationId.PinkInc
            const context = createMachineContext(state)

            const validActions = handler.validActionsForPlayer(playerId, context)
            expect(validActions).toContain(ActionType.AlienEngineering)
            expect(validActions).toContain(ActionType.FinishExpansion)
        })
    })
})
