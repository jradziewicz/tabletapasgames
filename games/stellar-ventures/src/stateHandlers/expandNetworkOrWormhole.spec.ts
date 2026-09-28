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
import { ExpandNetworkOrWormholeStateHandler } from './expandNetworkOrWormhole.js'
import { OfferSignTheAgreementStateHandler } from './offerSignTheAgreement.js'
import { OfferSecretAgentsChoiceStateHandler } from './offerSecretAgentsChoice.js'
import { HydratedExpandNetwork, ExpandNetwork } from '../actions/expandNetwork.js'
import { HydratedCreateWormhole, CreateWormhole } from '../actions/createWormhole.js'
import {
    HydratedDeclineExpandNetworkOrWormhole,
    DeclineExpandNetworkOrWormhole
} from '../actions/declineExpandNetworkOrWormhole.js'
import {
    HydratedDeclineSignTheAgreement,
    DeclineSignTheAgreement
} from '../actions/declineSignTheAgreement.js'
import {
    HydratedIncreaseAlienMiningCapacity,
    IncreaseAlienMiningCapacity
} from '../actions/increaseAlienMiningCapacity.js'
import {
    HydratedIncreaseAmethystMiningCapacity,
    IncreaseAmethystMiningCapacity
} from '../actions/increaseAmethystMiningCapacity.js'
import { HydratedAlienAlchemist, AlienAlchemist } from '../actions/alienAlchemist.js'
import { HydratedLeakedResearch, LeakedResearch } from '../actions/leakedResearch.js'
import { HydratedDismantlingOutposts, DismantlingOutposts } from '../actions/dismantlingOutposts.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { HexType } from '../model/board.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'
import {
    buildOutpostForCorporation,
    createWormholeCostForCorporation
} from '../operations/network.js'

// A real Alien Planet hex on the Alpha map (data/alphaBoard.ts), far enough from PinkInc's
// network that it's only reachable via Create Wormhole, not Expand Network's adjacency chaining.
const ALIEN_PLANET_HEX_ID = '6,0'

// PinkInc's Home Planet on the Alpha map is '3,0'. '2,0', '2,1' and '3,1' are all directly
// adjacent to it; '3,2' is only adjacent to '3,1' (chaining), not to '3,0' itself.
const PINK_INC_HOME_HEX_ID = '3,0'

// '2,0' is a Deep Space hex directly adjacent to PinkInc's Home Planet - used as a Dismantling
// Outposts target.
const DEEP_SPACE_HEX_ID = '2,0'

// '11,1' is a Nebular Anomaly (HexType.Anomaly, no Sun) hex on the Alpha map - used as a Nebular
// Explorers target. Far enough from PinkInc's network that (like ALIEN_PLANET_HEX_ID above) it's
// only reachable via Create Wormhole, not Expand Network's adjacency chaining.
const ANOMALY_HEX_ID = '11,1'

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

    // Skip straight to Expand Network / Wormhole for PinkInc's turn: make PinkInc the active
    // Corporation, issue it a share so player 1 becomes its President, and fund its treasury.
    const pinkIncIndex = initialState.corporationTurnOrder.indexOf(CorporationId.PinkInc)
    initialState.activeCorporationIndex = pinkIncIndex
    const corporation = initialState.getCorporation(CorporationId.PinkInc)
    corporation.issueShareToPlayer('p1', 0)
    corporation.treasury = 20
    initialState.machineState = MachineState.ExpandNetworkOrWormhole

    const handler = new ExpandNetworkOrWormholeStateHandler()
    handler.enter(createMachineContext(initialState))

    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function expandNetwork(
    state: HydratedStellarVenturesGameState,
    handler: ExpandNetworkOrWormholeStateHandler,
    playerId: string,
    hexId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedExpandNetwork({
        id: `expand-${playerId}-${hexId}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.ExpandNetwork,
        playerId,
        hexId
    } as ExpandNetwork)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.ExpandNetworkOrWormhole) {
        handler.enter(context)
    }
}

// Finds a hex on the real board adjacent to hexId - used to give PinkInc's network a foothold
// next to a fixed Alien Planet hex without depending on the Alpha map's exact topology.
function neighborOf(state: HydratedStellarVenturesGameState, hexId: string): string {
    const neighbor = Object.keys(state.board.hexes).find(
        (candidateId) => candidateId !== hexId && state.board.isAdjacent(hexId, candidateId)
    )
    if (!neighbor) {
        throw Error(`No neighbor found for ${hexId}`)
    }
    return neighbor
}

function createWormhole(
    state: HydratedStellarVenturesGameState,
    handler: ExpandNetworkOrWormholeStateHandler,
    playerId: string,
    hexId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedCreateWormhole({
        id: `wormhole-${playerId}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.CreateWormhole,
        playerId,
        hexId
    } as CreateWormhole)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.ExpandNetworkOrWormhole) {
        handler.enter(context)
    }
}

function decline(
    state: HydratedStellarVenturesGameState,
    handler: ExpandNetworkOrWormholeStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedDeclineExpandNetworkOrWormhole({
        id: `decline-${playerId}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DeclineExpandNetworkOrWormhole,
        playerId
    } as DeclineExpandNetworkOrWormhole)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.ExpandNetworkOrWormhole) {
        handler.enter(context)
    }
}

function alienAlchemist(
    state: HydratedStellarVenturesGameState,
    handler: ExpandNetworkOrWormholeStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedAlienAlchemist({
        id: `alien-alchemist-${playerId}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.AlienAlchemist,
        playerId
    } as AlienAlchemist)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.ExpandNetworkOrWormhole) {
        handler.enter(context)
    }
}

function leakedResearch(
    state: HydratedStellarVenturesGameState,
    handler: ExpandNetworkOrWormholeStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedLeakedResearch({
        id: `leaked-research-${playerId}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.LeakedResearch,
        playerId,
        corporationId: CorporationId.PinkInc
    } as LeakedResearch)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.ExpandNetworkOrWormhole) {
        handler.enter(context)
    }
}

function dismantlingOutposts(
    state: HydratedStellarVenturesGameState,
    handler: ExpandNetworkOrWormholeStateHandler,
    playerId: string,
    hexId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedDismantlingOutposts({
        id: `dismantling-outposts-${playerId}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DismantlingOutposts,
        playerId,
        hexId
    } as DismantlingOutposts)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.ExpandNetworkOrWormhole) {
        handler.enter(context)
    }
}

describe('ExpandNetworkOrWormholeStateHandler', () => {
    it('starts with the active Corporation President as the only active player', () => {
        const state = createTestState()
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
    })

    it("places each of the 5 starting Corporations' Setup Outpost on its Home Planet", () => {
        const state = createTestState()
        expect(state.board.hasOutpost(PINK_INC_HOME_HEX_ID, CorporationId.PinkInc)).toBe(true)
        expect(state.board.getHex(PINK_INC_HOME_HEX_ID)?.outposts).toEqual([CorporationId.PinkInc])
    })

    it('builds a single Outpost adjacent to the Home Planet, deferring cost and staying open to build more', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()

        expandNetwork(state, handler, 'p1', '2,0')

        const corporation = state.getCorporation(CorporationId.PinkInc)
        expect(state.board.hasOutpost('2,0', CorporationId.PinkInc)).toBe(true)
        // Cost is deferred until the build ends (see finalizeExpansion) - not charged yet, and
        // the President may keep building via another ExpandNetwork action.
        expect(corporation.treasury).toBe(20)
        expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
        expect(state.activePlayerIds).toEqual(['p1'])

        decline(state, handler, 'p1')

        expect(corporation.treasury).toBe(20 - 1) // ExpandNetworkOutpostCosts[1]
        expect(state.machineState).toBe(MachineState.PayDividends)
        expect(state.activePlayerIds).toEqual([])
    })

    it('allows placing a 2nd Outpost adjacent to the one just built, one at a time', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()

        // '3,2' is only adjacent to '3,1', not to the Home Planet itself - valid only once '3,1'
        // is already built.
        expandNetwork(state, handler, 'p1', '3,1')
        expandNetwork(state, handler, 'p1', '3,2')

        const corporation = state.getCorporation(CorporationId.PinkInc)
        expect(state.board.hasOutpost('3,1', CorporationId.PinkInc)).toBe(true)
        expect(state.board.hasOutpost('3,2', CorporationId.PinkInc)).toBe(true)
        expect(corporation.treasury).toBe(20) // still deferred
        expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)

        decline(state, handler, 'p1')
        expect(corporation.treasury).toBe(20 - 2) // ExpandNetworkOutpostCosts[2], charged once
    })

    it('rejects an ExpandNetwork hex that is not adjacent to the network', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        expect(HydratedExpandNetwork.canExpandNetwork(state, 'p1', '3,2')).toBe(false)
        expect(() => expandNetwork(state, handler, 'p1', '3,2')).toThrow()
    })

    it('rejects ExpandNetwork from a non-President player', () => {
        const state = createTestState()
        expect(HydratedExpandNetwork.canExpandNetwork(state, 'p2', '2,0')).toBe(false)
    })

    it('builds a Create Wormhole Outpost anywhere once Wormhole Technology is active', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.wormholeActive = true

        expect(HydratedCreateWormhole.canCreateWormhole(state, 'p1', '12,0')).toBe(true)
        createWormhole(state, handler, 'p1', '12,0')

        expect(state.board.hasOutpost('12,0', CorporationId.PinkInc)).toBe(true)
        expect(state.machineState).toBe(MachineState.PayDividends)
    })

    it('rejects Create Wormhole without active Wormhole Technology', () => {
        const state = createTestState()
        expect(HydratedCreateWormhole.canCreateWormhole(state, 'p1', '12,0')).toBe(false)
    })

    it('allows declining, moving straight on to Pay Dividends with no build', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        const treasuryBefore = corporation.treasury

        decline(state, handler, 'p1')

        expect(corporation.treasury).toBe(treasuryBefore)
        expect(state.machineState).toBe(MachineState.PayDividends)
        expect(state.activePlayerIds).toEqual([])
    })

    it('builds on an Alien Planet via Create Wormhole and awards 1 Alien Technology Cube (Alien Explorers)', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.wormholeActive = true

        // Every starting Corporation begins with Alien Explorers active (Setup step 15b).
        expect(corporation.hasActivePower(CorporatePowerId.AlienExplorers)).toBe(true)
        expect(HydratedCreateWormhole.canCreateWormhole(state, 'p1', ALIEN_PLANET_HEX_ID)).toBe(
            true
        )
        // Every player starts with 1 Alien Technology Cube already (Setup - see
        // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts), so this asserts the award
        // relative to that starting count rather than assuming it starts at 0.
        const cubesBefore = state.getPlayerState('p1').alienTechCubes

        createWormhole(state, handler, 'p1', ALIEN_PLANET_HEX_ID)

        expect(state.board.hasOutpost(ALIEN_PLANET_HEX_ID, CorporationId.PinkInc)).toBe(true)
        expect(state.getPlayerState('p1').alienTechCubes).toBe(cubesBefore + 1)
    })

    it('rejects building on an Alien Planet once Alien Explorers is no longer active', () => {
        const state = createTestState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.wormholeActive = true
        corporation.powers = []

        expect(HydratedCreateWormhole.canCreateWormhole(state, 'p1', ALIEN_PLANET_HEX_ID)).toBe(
            false
        )
    })

    it('rejects a Sun hex via Create Wormhole without Icarus Experiment', () => {
        const state = createTestState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.wormholeActive = true
        expect(state.board.getHex('4,0')?.type).toBe(HexType.Sun)

        expect(HydratedCreateWormhole.canCreateWormhole(state, 'p1', '4,0')).toBe(false)
    })

    it('allows building on a Sun hex via Create Wormhole once Icarus Experiment is active', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.wormholeActive = true
        corporation.powers.push({ id: CorporatePowerId.IcarusExperiment })

        expect(HydratedCreateWormhole.canCreateWormhole(state, 'p1', '4,0')).toBe(true)
        createWormhole(state, handler, 'p1', '4,0')

        expect(state.board.hasOutpost('4,0', CorporationId.PinkInc)).toBe(true)
    })

    it('allows building on an adjacent Sun hex via Expand Network once Icarus Experiment is active', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.powers.push({ id: CorporatePowerId.IcarusExperiment })
        // '4,0' [Sun] is directly adjacent to PinkInc's Home Planet ('3,0').
        expect(state.board.isAdjacent(PINK_INC_HOME_HEX_ID, '4,0')).toBe(true)

        expect(HydratedExpandNetwork.canExpandNetwork(state, 'p1', '4,0')).toBe(true)
        expandNetwork(state, handler, 'p1', '4,0')

        expect(state.board.hasOutpost('4,0', CorporationId.PinkInc)).toBe(true)
    })

    it('applies a ₮2 Quantum Propulsion discount to the Create Wormhole cost', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.wormholeActive = true
        corporation.treasury = 20

        // Create Wormhole charges its cost immediately (unlike Expand Network's deferred lump
        // sum), so the Treasury delta right after apply() is the real cost paid.
        createWormhole(state, handler, 'p1', '12,0')
        const treasuryWithoutDiscount = 20 - corporation.treasury

        const state2 = createTestState()
        const handler2 = new ExpandNetworkOrWormholeStateHandler()
        const corporation2 = state2.getCorporation(CorporationId.PinkInc)
        corporation2.wormholeActive = true
        corporation2.treasury = 20
        corporation2.powers.push({ id: CorporatePowerId.QuantumPropulsion })

        createWormhole(state2, handler2, 'p1', '12,0')
        const treasuryWithDiscount = 20 - corporation2.treasury

        expect(treasuryWithDiscount).toBe(treasuryWithoutDiscount - 2)
    })

    it('detours to OfferSignTheAgreement when a build qualifies the Corporation to sign', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.wormholeActive = true
        // Pre-place an Outpost on a 2nd Alien Planet - '6,0' (built below) will be the 2nd,
        // satisfying "Outposts on 2+ Alien Planets".
        state.board.buildOutpost('1,1', CorporationId.PinkInc)

        createWormhole(state, handler, 'p1', ALIEN_PLANET_HEX_ID)

        expect(state.machineState).toBe(MachineState.OfferSignTheAgreement)
        expect(state.signTheAgreementCorporationId).toBe(CorporationId.PinkInc)
        expect(state.signTheAgreementHexId).toBe(ALIEN_PLANET_HEX_ID)
        expect(state.signTheAgreementResumeState).toBe(MachineState.PayDividends)
        // Create Wormhole is one-shot - nothing to continue, so declining also just resumes at
        // PayDividends (declineResumeState stays unset, defaulting to resumeState).
        expect(state.signTheAgreementDeclineResumeState).toBeUndefined()
        expect(state.activePlayerIds).toEqual(['p1']) // the President
    })

    it('detours an ExpandNetwork build to OfferSignTheAgreement too, remembering how to resume if declined', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        state.board.buildOutpost('1,1', CorporationId.PinkInc) // PinkInc's 1st Alien Planet Outpost
        const neighbor = neighborOf(state, ALIEN_PLANET_HEX_ID)
        state.board.buildOutpost(neighbor, CorporationId.PinkInc) // gives it a foothold to chain from

        expandNetwork(state, handler, 'p1', ALIEN_PLANET_HEX_ID)

        expect(state.machineState).toBe(MachineState.OfferSignTheAgreement)
        expect(state.signTheAgreementCorporationId).toBe(CorporationId.PinkInc)
        expect(state.signTheAgreementHexId).toBe(ALIEN_PLANET_HEX_ID)
        expect(state.signTheAgreementResumeState).toBe(MachineState.PayDividends)
        // Expand Network has more it could build - declining should loop back here.
        expect(state.signTheAgreementDeclineResumeState).toBe(MachineState.ExpandNetworkOrWormhole)
    })

    it('declining the Sign The Agreement offer lets the Expand Network build continue instead of ending it', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const offerHandler = new OfferSignTheAgreementStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        state.board.buildOutpost('1,1', CorporationId.PinkInc)
        const neighbor = neighborOf(state, ALIEN_PLANET_HEX_ID)
        state.board.buildOutpost(neighbor, CorporationId.PinkInc)

        expandNetwork(state, handler, 'p1', ALIEN_PLANET_HEX_ID)
        expect(state.machineState).toBe(MachineState.OfferSignTheAgreement)

        const offerContext = createMachineContext(state)
        const declineAction = new HydratedDeclineSignTheAgreement({
            id: 'decline-sign-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DeclineSignTheAgreement,
            playerId: 'p1'
        } as DeclineSignTheAgreement)
        declineAction.apply(state, offerContext)
        state.machineState = offerHandler.onAction(declineAction, offerContext) as MachineState
        handler.enter(offerContext)

        // The build continues - nothing charged yet, and the tile stays hidden (never re-offered
        // for this hex again since it already has PinkInc's Outpost).
        expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(corporation.treasury).toBe(20)
        expect(state.board.requireHex(ALIEN_PLANET_HEX_ID).alienAgreementTileHidden).toBe(true)

        // Stopping now finally charges the lump sum for the 1 Outpost built this action.
        decline(state, handler, 'p1')
        expect(corporation.treasury).toBe(20 - 1) // ExpandNetworkOutpostCosts[1]
        expect(state.machineState).toBe(MachineState.PayDividends)
    })

    it('does not detour to OfferSignTheAgreement with only 1 Alien Planet Outpost', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.wormholeActive = true

        createWormhole(state, handler, 'p1', ALIEN_PLANET_HEX_ID)

        expect(state.machineState).toBe(MachineState.PayDividends)
        expect(state.signTheAgreementCorporationId).toBeUndefined()
    })

    it('offers ExpandNetwork, CreateWormhole (if active) and Decline to the President only', () => {
        const state = createTestState()
        const handler = new ExpandNetworkOrWormholeStateHandler()
        const context = createMachineContext(state)

        let validActions = handler.validActionsForPlayer('p1', context)
        expect(validActions).toContain(ActionType.ExpandNetwork)
        expect(validActions).toContain(ActionType.DeclineExpandNetworkOrWormhole)
        expect(validActions).not.toContain(ActionType.CreateWormhole)

        state.getCorporation(CorporationId.PinkInc).wormholeActive = true
        validActions = handler.validActionsForPlayer('p1', context)
        expect(validActions).toContain(ActionType.CreateWormhole)

        expect(handler.validActionsForPlayer('p2', context)).toEqual([])
    })

    describe('Secret Agents Mining Capacity choice', () => {
        it('detours to OfferSecretAgentsChoice when a Secret Agents Corporation builds on an Alien Planet with a hidden tile', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.wormholeActive = true
            // Give PinkInc Secret Agents instead of its starting Alien Explorers, so only the
            // Secret Agents detour fires here, not Sign The Agreement.
            corporation.powers = [{ id: CorporatePowerId.SecretAgents }]

            createWormhole(state, handler, 'p1', ALIEN_PLANET_HEX_ID)

            expect(state.machineState).toBe(MachineState.OfferSecretAgentsChoice)
            expect(state.secretAgentsCorporationId).toBe(CorporationId.PinkInc)
            expect(state.secretAgentsHexId).toBe(ALIEN_PLANET_HEX_ID)
            expect(state.secretAgentsResumeState).toBe(MachineState.PayDividends)
            expect(state.activePlayerIds).toEqual(['p1']) // the President
            // The build isn't finalized yet - cost is still deferred/pending resolution.
            expect(state.board.hasOutpost(ALIEN_PLANET_HEX_ID, CorporationId.PinkInc)).toBe(true)
        })

        it('auto-awards Increase Amethyst without interrupting the build once the tile is already used up', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.wormholeActive = true
            corporation.powers = [{ id: CorporatePowerId.SecretAgents }]
            // alienAgreementTileHidden (not alienAgreementTileRemoved - that flag is purely
            // Sign The Agreement's board-rendering bookkeeping, see model/board.ts) is what
            // hasHiddenAlienAgreementTile actually checks, so this is what simulates a tile
            // that's already been revealed/used up by the time this Corporation builds here.
            state.board.requireHex(ALIEN_PLANET_HEX_ID).alienAgreementTileHidden = false

            createWormhole(state, handler, 'p1', ALIEN_PLANET_HEX_ID)

            // No detour at all - Create Wormhole resumes straight at PayDividends as normal.
            expect(state.machineState).toBe(MachineState.PayDividends)
            expect(state.secretAgentsCorporationId).toBeUndefined()
            expect(corporation.secretAgentsMiningCapacityBonus).toBe(3)
        })

        it('Increase Alien flips the tile, grants the Alien Corporation Mining Capacity, and resumes building', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers = [{ id: CorporatePowerId.SecretAgents }]
            const neighbor = neighborOf(state, ALIEN_PLANET_HEX_ID)
            state.board.buildOutpost(neighbor, CorporationId.PinkInc)

            expandNetwork(state, handler, 'p1', ALIEN_PLANET_HEX_ID)
            expect(state.machineState).toBe(MachineState.OfferSecretAgentsChoice)

            const chevrons =
                state.board.requireHex(ALIEN_PLANET_HEX_ID).alienAgreementTileChevrons ?? 0
            const miningCapacityBefore = state.alienCorporation.miningCapacity

            const offerHandler = new OfferSecretAgentsChoiceStateHandler()
            const context = createMachineContext(state)
            const action = new HydratedIncreaseAlienMiningCapacity({
                id: 'increase-alien-p1',
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.IncreaseAlienMiningCapacity,
                playerId: 'p1'
            } as IncreaseAlienMiningCapacity)
            action.apply(state, context)
            state.machineState = offerHandler.onAction(action, context) as MachineState
            handler.enter(context)

            expect(state.board.requireHex(ALIEN_PLANET_HEX_ID).alienAgreementTileHidden).toBe(false)
            expect(state.board.requireHex(ALIEN_PLANET_HEX_ID).alienAgreementTileRemoved).toBe(true)
            expect(state.alienCorporation.miningCapacity).toBe(miningCapacityBefore + chevrons * 3)
            // "Increase Alien" always reveals a hidden tile, so Undo must not be able to step
            // back past it - see GameSession.undoableAction.
            expect(action.revealsInfo).toBe(true)
            expect(corporation.secretAgentsMiningCapacityBonus ?? 0).toBe(0)
            // Amethyst still holds Secret Agents (unlike Sign The Agreement, nothing is discarded).
            expect(corporation.hasActivePower(CorporatePowerId.SecretAgents)).toBe(true)
            // Expand Network had more it could build - resumes back at this same step.
            expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
            expect(state.activePlayerIds).toEqual(['p1'])
            expect(state.secretAgentsCorporationId).toBeUndefined()
            expect(state.secretAgentsHexId).toBeUndefined()
            expect(state.secretAgentsResumeState).toBeUndefined()
        })

        it('Increase Amethyst grants +3 Mining Capacity to the Corporation itself and discards the tile', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.wormholeActive = true
            corporation.powers = [{ id: CorporatePowerId.SecretAgents }]

            createWormhole(state, handler, 'p1', ALIEN_PLANET_HEX_ID)
            expect(state.machineState).toBe(MachineState.OfferSecretAgentsChoice)

            const offerHandler = new OfferSecretAgentsChoiceStateHandler()
            const context = createMachineContext(state)
            const action = new HydratedIncreaseAmethystMiningCapacity({
                id: 'increase-amethyst-p1',
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.IncreaseAmethystMiningCapacity,
                playerId: 'p1'
            } as IncreaseAmethystMiningCapacity)
            action.apply(state, context)
            state.machineState = offerHandler.onAction(action, context) as MachineState

            expect(corporation.secretAgentsMiningCapacityBonus).toBe(3)
            expect(state.board.requireHex(ALIEN_PLANET_HEX_ID).alienAgreementTileRemoved).toBe(true)
            // Create Wormhole is one-shot - resumes at PayDividends.
            expect(state.machineState).toBe(MachineState.PayDividends)
            expect(state.secretAgentsCorporationId).toBeUndefined()
            // Unlike Increase Alien, this discards the tile without ever revealing its chevrons -
            // nothing hidden was exposed, so this action stays freely undoable.
            expect(action.revealsInfo).toBeUndefined()
        })
    })

    describe('Alien Alchemist', () => {
        it('removes 2 unbuilt Outposts, grants 1 Alien Technology Cube, and loops back to the same step', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.AlienAlchemist })
            const unbuiltOutpostsBefore = corporation.unbuiltOutposts
            // Every player starts with 1 Alien Technology Cube already (Setup - see
            // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - assert relative to that.
            const cubesBefore = state.getPlayerState('p1').alienTechCubes

            expect(HydratedAlienAlchemist.canAlienAlchemist(state, 'p1')).toBe(true)
            alienAlchemist(state, handler, 'p1')

            expect(corporation.unbuiltOutposts).toBe(unbuiltOutpostsBefore - 2)
            expect(state.getPlayerState('p1').alienTechCubes).toBe(cubesBefore + 1)
            expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
            expect(state.activePlayerIds).toEqual(['p1'])
        })

        it('rejects Alien Alchemist without the power active', () => {
            const state = createTestState()
            expect(HydratedAlienAlchemist.canAlienAlchemist(state, 'p1')).toBe(false)
        })

        it('rejects a 2nd Alien Alchemist use within the same Corporation Round', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.AlienAlchemist })

            alienAlchemist(state, handler, 'p1')

            expect(HydratedAlienAlchemist.canAlienAlchemist(state, 'p1')).toBe(false)
            expect(() => alienAlchemist(state, handler, 'p1')).toThrow()
        })

        it('rejects Alien Alchemist once fewer than 2 unbuilt Outposts remain', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.AlienAlchemist })
            corporation.unbuiltOutposts = 1

            expect(HydratedAlienAlchemist.canAlienAlchemist(state, 'p1')).toBe(false)
        })

        it('rejects Alien Alchemist from a non-President player', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.AlienAlchemist })

            expect(HydratedAlienAlchemist.canAlienAlchemist(state, 'p2')).toBe(false)
        })

        it('offers Alien Alchemist as a valid action once active', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.AlienAlchemist })
            const context = createMachineContext(state)

            expect(handler.validActionsForPlayer('p1', context)).toContain(
                ActionType.AlienAlchemist
            )
        })

        it('resets the once-per-Corporation-Round limit only when the round advances to the next Corporation', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.AlienAlchemist })

            alienAlchemist(state, handler, 'p1')
            expect(state.alienAlchemistUsedThisCorporationRound).toBe(true)

            // Re-entering the same state (as happens after every Outpost built) must NOT reset it.
            handler.enter(createMachineContext(state))
            expect(state.alienAlchemistUsedThisCorporationRound).toBe(true)
            expect(HydratedAlienAlchemist.canAlienAlchemist(state, 'p1')).toBe(false)
        })
    })

    describe('Leaked Research ("Anytime")', () => {
        it('activates Wormhole Technology, loops back to this step, and stays discardable/One-Time', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            state.getPlayerState('p1').addAlienTechCubes(1)
            // Every player starts with 1 Alien Technology Cube already (Setup - see
            // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts), on top of the 1 just
            // added above - assert Leaked Research's own 1-Cube cost relative to that total
            // rather than assuming it started at 0.
            const cubesBeforeSpend = state.getPlayerState('p1').alienTechCubes
            const context = createMachineContext(state)

            expect(handler.validActionsForPlayer('p1', context)).toContain(
                ActionType.LeakedResearch
            )

            leakedResearch(state, handler, 'p1')

            expect(corporation.wormholeActive).toBe(true)
            expect(state.getPlayerState('p1').alienTechCubes).toBe(cubesBeforeSpend - 1)
            expect(corporation.powers).not.toContainEqual({ id: CorporatePowerId.LeakedResearch })
            expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
            expect(state.activePlayerIds).toEqual(['p1'])

            // Not offered a 2nd time now that Wormhole Technology is already active.
            expect(HydratedLeakedResearch.canOfferLeakedResearch(state, 'p1')).toBe(false)
        })

        it('is not offered to a non-President, even with the power active', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            state.getPlayerState('p2').addAlienTechCubes(1)

            expect(HydratedLeakedResearch.canOfferLeakedResearch(state, 'p2')).toBe(false)
        })
    })

    describe('Dismantling Outposts', () => {
        it('returns the Outpost to the supply, charges ₮1, and loops back to the same step', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DismantlingOutposts })
            buildOutpostForCorporation(state, DEEP_SPACE_HEX_ID, CorporationId.PinkInc)
            const unbuiltOutpostsBefore = corporation.unbuiltOutposts
            const treasuryBefore = corporation.treasury

            expect(
                HydratedDismantlingOutposts.canDismantlingOutposts(state, 'p1', DEEP_SPACE_HEX_ID)
            ).toBe(true)
            dismantlingOutposts(state, handler, 'p1', DEEP_SPACE_HEX_ID)

            expect(state.board.hasOutpost(DEEP_SPACE_HEX_ID, CorporationId.PinkInc)).toBe(false)
            expect(corporation.unbuiltOutposts).toBe(unbuiltOutpostsBefore + 1)
            expect(corporation.treasury).toBe(treasuryBefore - 1)
            expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
            expect(state.activePlayerIds).toEqual(['p1'])
        })

        it('rejects Dismantling Outposts without the power active', () => {
            const state = createTestState()
            buildOutpostForCorporation(state, DEEP_SPACE_HEX_ID, CorporationId.PinkInc)
            expect(
                HydratedDismantlingOutposts.canDismantlingOutposts(state, 'p1', DEEP_SPACE_HEX_ID)
            ).toBe(false)
        })

        it('rejects targeting a hex with no Outpost belonging to this Corporation', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DismantlingOutposts })
            expect(
                HydratedDismantlingOutposts.canDismantlingOutposts(state, 'p1', DEEP_SPACE_HEX_ID)
            ).toBe(false)
        })

        it('rejects targeting a non-Deep-Space hex', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DismantlingOutposts })
            expect(
                HydratedDismantlingOutposts.canDismantlingOutposts(
                    state,
                    'p1',
                    PINK_INC_HOME_HEX_ID
                )
            ).toBe(false)
        })

        it('rejects a 2nd Dismantling Outposts use within the same Corporation Round', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DismantlingOutposts })
            buildOutpostForCorporation(state, DEEP_SPACE_HEX_ID, CorporationId.PinkInc)

            dismantlingOutposts(state, handler, 'p1', DEEP_SPACE_HEX_ID)

            expect(
                HydratedDismantlingOutposts.canDismantlingOutposts(state, 'p1', DEEP_SPACE_HEX_ID)
            ).toBe(false)
            expect(() => dismantlingOutposts(state, handler, 'p1', DEEP_SPACE_HEX_ID)).toThrow()
        })

        it('rejects Dismantling Outposts without enough Treasury funds', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DismantlingOutposts })
            buildOutpostForCorporation(state, DEEP_SPACE_HEX_ID, CorporationId.PinkInc)
            corporation.treasury = 0

            expect(
                HydratedDismantlingOutposts.canDismantlingOutposts(state, 'p1', DEEP_SPACE_HEX_ID)
            ).toBe(false)
        })

        it('rejects Dismantling Outposts from a non-President player', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DismantlingOutposts })
            buildOutpostForCorporation(state, DEEP_SPACE_HEX_ID, CorporationId.PinkInc)

            expect(
                HydratedDismantlingOutposts.canDismantlingOutposts(state, 'p2', DEEP_SPACE_HEX_ID)
            ).toBe(false)
        })

        it('offers Dismantling Outposts as a valid action once active', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DismantlingOutposts })
            buildOutpostForCorporation(state, DEEP_SPACE_HEX_ID, CorporationId.PinkInc)
            const context = createMachineContext(state)

            expect(handler.validActionsForPlayer('p1', context)).toContain(
                ActionType.DismantlingOutposts
            )
        })

        it('does not offer Dismantling Outposts when no Deep Space Outpost is available to reclaim', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DismantlingOutposts })
            const context = createMachineContext(state)

            expect(handler.validActionsForPlayer('p1', context)).not.toContain(
                ActionType.DismantlingOutposts
            )
        })

        it('resets the once-per-Corporation-Round limit only when the round advances to the next Corporation', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.DismantlingOutposts })
            buildOutpostForCorporation(state, DEEP_SPACE_HEX_ID, CorporationId.PinkInc)

            dismantlingOutposts(state, handler, 'p1', DEEP_SPACE_HEX_ID)
            expect(state.dismantlingOutpostsUsedThisCorporationRound).toBe(true)

            // Re-entering the same state (as happens after every Outpost built) must NOT reset it.
            handler.enter(createMachineContext(state))
            expect(state.dismantlingOutpostsUsedThisCorporationRound).toBe(true)
        })
    })

    // Nebular Explorers (Corporate Power Glossary, page 29) is no longer its own action - see
    // model/board.ts's canBuildOutpost canBuildOnNebulaAnomaly parameter and
    // operations/network.ts's resolveNebularAnomalyReveal/canBuildOnNebulaAnomalyForCorporation.
    // A Nebular Anomaly hex is simply one more legal target for Expand Network, Private
    // Contractor, Jerry-Rig and Create Wormhole alike whenever the building Corporation holds
    // this Power - exercised here through Create Wormhole (ANOMALY_HEX_ID isn't adjacent to
    // PinkInc's network, same reason ALIEN_PLANET_HEX_ID's own tests above use it instead of
    // Expand Network); the shared board.ts permission check itself is confirmed directly for
    // all 4 actions in the last test below.
    describe('Nebular Explorers', () => {
        it('converts a Nebular Anomaly hex to an Alien Planet, builds there, assigns a tile, and discards the power', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.NebularExplorers })
            corporation.wormholeActive = true
            const unusedTilesBefore = [...state.unusedAlienAgreementTileChevrons]
            const expectedTile = unusedTilesBefore[0]
            const cost = createWormholeCostForCorporation(
                state,
                CorporationId.PinkInc,
                ANOMALY_HEX_ID
            )
            const treasuryBefore = corporation.treasury
            const unbuiltOutpostsBefore = corporation.unbuiltOutposts
            // PinkInc (like every non-Amethyst starting Corporation) already holds Alien
            // Explorers at Setup - per the co-designer, this specific hex's conversion DOES still
            // award an Alien Technology Cube for it, exactly like any other Alien Planet build.
            const cubesBefore = state.getPlayerState('p1').alienTechCubes

            expect(HydratedCreateWormhole.canCreateWormhole(state, 'p1', ANOMALY_HEX_ID)).toBe(true)
            createWormhole(state, handler, 'p1', ANOMALY_HEX_ID)

            const hex = state.board.requireHex(ANOMALY_HEX_ID)
            expect(hex.type).toBe(HexType.AlienPlanet)
            expect(hex.alienAgreementTileHidden).toBe(true)
            expect(hex.alienAgreementTileChevrons).toBe(expectedTile)
            expect(state.unusedAlienAgreementTileChevrons).toEqual(unusedTilesBefore.slice(1))
            expect(state.board.hasOutpost(ANOMALY_HEX_ID, CorporationId.PinkInc)).toBe(true)
            expect(corporation.unbuiltOutposts).toBe(unbuiltOutpostsBefore - 1)
            expect(corporation.treasury).toBe(treasuryBefore - cost!)
            expect(corporation.powers).not.toContainEqual({ id: CorporatePowerId.NebularExplorers })
            expect(state.getPlayerState('p1').alienTechCubes).toBe(cubesBefore + 1)
            expect(state.machineState).toBe(MachineState.PayDividends)
        })

        it('rejects a Nebular Anomaly target without the power active', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.wormholeActive = true
            expect(HydratedCreateWormhole.canCreateWormhole(state, 'p1', ANOMALY_HEX_ID)).toBe(false)
        })

        it('rejects a Nebular Anomaly target once every unused Alien Planet tile is gone, even with the power active', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.NebularExplorers })
            corporation.wormholeActive = true
            state.unusedAlienAgreementTileChevrons = []
            expect(HydratedCreateWormhole.canCreateWormhole(state, 'p1', ANOMALY_HEX_ID)).toBe(false)
        })

        it('is exhausted (One-Time) after a single use, even with tiles still available', () => {
            const state = createTestState()
            const handler = new ExpandNetworkOrWormholeStateHandler()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.NebularExplorers })
            corporation.wormholeActive = true

            createWormhole(state, handler, 'p1', ANOMALY_HEX_ID)

            expect(corporation.hasActivePower(CorporatePowerId.NebularExplorers)).toBe(false)
        })

        it('is a legal target for all 4 build actions (Expand Network, Private Contractor, Jerry-Rig, Create Wormhole alike) via the shared board permission check, not just Create Wormhole', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.NebularExplorers })
            expect(
                state.board.canBuildOutpost(
                    ANOMALY_HEX_ID,
                    CorporationId.PinkInc,
                    corporation.canBuildOnAlienPlanets(),
                    corporation.hasActivePower(CorporatePowerId.IcarusExperiment),
                    corporation.hasActivePower(CorporatePowerId.CloakingDevices),
                    true
                )
            ).toBe(true)
            expect(
                state.board.canBuildOutpost(
                    PINK_INC_HOME_HEX_ID,
                    CorporationId.PinkInc,
                    corporation.canBuildOnAlienPlanets(),
                    corporation.hasActivePower(CorporatePowerId.IcarusExperiment),
                    corporation.hasActivePower(CorporatePowerId.CloakingDevices),
                    true
                )
            ).toBe(false) // canBuildOnNebulaAnomaly never applies to a hex that isn't an Anomaly.
        })
    })
})
