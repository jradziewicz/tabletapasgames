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
import { AlienTechActionStateHandler } from './alienTechAction.js'
import { HydratedLaunder, Launder } from '../actions/launder.js'
import { HydratedPassAlienTechAction, PassAlienTechAction } from '../actions/passAlienTechAction.js'
import { HydratedCargoBoost, CargoBoost } from '../actions/cargoBoost.js'
import { HydratedResearchWormhole, ResearchWormhole } from '../actions/researchWormhole.js'
import { HydratedDevelopPlanets, DevelopPlanets } from '../actions/developPlanets.js'
import { HydratedLeakedResearch, LeakedResearch } from '../actions/leakedResearch.js'
import { HydratedAlienEngineering, AlienEngineering } from '../actions/alienEngineering.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { AlienTechActionId } from '../model/investorBoard.js'
import { turnOrderStartingWith } from '../operations/auction.js'
import { MAX_CARGO } from '../operations/shipOrdering.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

// '5,0' is a Neutral Planet on the Alpha map (see data/alphaBoard.ts) - Develop Planet(s) only
// cares about hex type, not adjacency to any Corporation's network, so no particular position is
// needed here.
const NEUTRAL_PLANET_HEX_ID = '5,0'

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
    initialState.machineState = MachineState.AlienTechAction
    // Simulates this player's Investor Action having already run (see
    // InvestorActionStateHandler.enter) - Alien Tech Action always follows it for the same
    // player, using the same player order and current-player pointer.
    const playerOrder = turnOrderStartingWith(initialState.turnManager.turnOrder, initialState.directorPlayerId)
    initialState.investorShenanigansPlayerOrder = playerOrder
    initialState.investorShenanigansCurrentPlayerId = playerOrder[0]

    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

describe('AlienTechActionStateHandler', () => {
    it("re-activates the same player Investor Action already chose for", () => {
        const state = createTestState()
        const handler = new AlienTechActionStateHandler()
        handler.enter(createMachineContext(state))

        expect(state.activePlayerIds).toEqual([state.directorPlayerId])
    })

    it('only allows the current player to act, and always offers Pass', () => {
        const state = createTestState()
        const handler = new AlienTechActionStateHandler()
        handler.enter(createMachineContext(state))

        const [current, other] = state.investorShenanigansPlayerOrder!
        // Every player starts with 1 Alien Technology Cube already (Setup - see
        // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - zero it out here so this
        // test's "no cubes to spend -> only Pass offered" premise actually holds.
        state.getPlayerState(current!).alienTechCubes = 0
        const context = createMachineContext(state)

        expect(handler.validActionsForPlayer(other!, context)).toEqual([])
        expect(handler.validActionsForPlayer(current!, context)).toEqual([
            ActionType.PassAlienTechAction
        ])
    })

    it('offers Launder once the player has a cube to spend, applies its effect, and advances to the next player', () => {
        const state = createTestState()
        const handler = new AlienTechActionStateHandler()
        handler.enter(createMachineContext(state))

        const currentPlayerId = state.investorShenanigansCurrentPlayerId!
        const player = state.getPlayerState(currentPlayerId)
        // Every player starts with 1 Alien Technology Cube already (Setup - see
        // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +2/-2
        // below nets back to that starting count instead of assuming it started at 0.
        const cubesBeforeAdd = player.alienTechCubes
        player.addAlienTechCubes(2)
        const context = createMachineContext(state)

        expect(handler.validActionsForPlayer(currentPlayerId, context)).toEqual(
            expect.arrayContaining([ActionType.PassAlienTechAction, ActionType.Launder])
        )

        const fundsBefore = player.liquidFunds
        const action = new HydratedLaunder({
            id: `launder-${currentPlayerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.Launder,
            playerId: currentPlayerId,
            amount: 2
        } as Launder)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.InvestorAction)
        expect(player.alienTechCubes).toBe(cubesBeforeAdd)
        expect(player.liquidFunds).toBe(fundsBefore + 5)
        expect(player.lastAlienTechActionId).toBe(AlienTechActionId.Launder)

        const nextPlayerId = state.investorShenanigansPlayerOrder![1]
        expect(state.investorShenanigansCurrentPlayerId).toBe(nextPlayerId)
    })

    it('completes Investor Shenanigans once every player has passed, moving on to the Administration Round', () => {
        const state = createTestState()
        const handler = new AlienTechActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerOrder = state.investorShenanigansPlayerOrder!
        let nextState: string = MachineState.AlienTechAction

        for (const playerId of playerOrder) {
            const context = createMachineContext(state)
            const action = new HydratedPassAlienTechAction({
                id: `pass-alien-tech-${playerId}`,
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.PassAlienTechAction,
                playerId
            } as PassAlienTechAction)
            action.apply(state, context)
            // onAction advances investorShenanigansCurrentPlayerId directly (real play would
            // route through InvestorActionStateHandler for the next player in between, but that
            // handler doesn't change this pointer - see its enter()), so each loop iteration's
            // Pass is already valid for the next player without re-entering this handler.
            nextState = handler.onAction(action, context)
            state.machineState = nextState as MachineState
        }

        expect(nextState).toBe(MachineState.ScrapLowestShip)
        expect(state.investorShenanigansPlayerOrder).toBeUndefined()
        expect(state.investorShenanigansCurrentPlayerId).toBeUndefined()
        expect(state.activePlayerIds).toEqual([])
    })

    it('increases CARGO via Cargo Boost for any Shareholder, spending cubes 1-for-1', () => {
        const state = createTestState()
        const handler = new AlienTechActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        corporation.cargo = 5
        const player = state.getPlayerState(playerId)
        // Every player starts with 1 Alien Technology Cube already (Setup - see
        // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +2/-2
        // below nets back to that starting count instead of assuming it started at 0.
        const cubesBeforeAdd = player.alienTechCubes
        player.addAlienTechCubes(2)
        const context = createMachineContext(state)

        expect(handler.validActionsForPlayer(playerId, context)).toContain(ActionType.CargoBoost)

        const action = new HydratedCargoBoost({
            id: `cargo-boost-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.CargoBoost,
            playerId,
            corporationId: CorporationId.PinkInc,
            amount: 2
        } as CargoBoost)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.InvestorAction)
        expect(corporation.cargo).toBe(7)
        expect(player.alienTechCubes).toBe(cubesBeforeAdd)
        expect(player.lastAlienTechActionId).toBe(AlienTechActionId.CargoBoost)
    })

    it('still allows a wasted Cargo Boost once a Corporation is at the CARGO Track maximum, clamping the gain', () => {
        const state = createTestState()
        const handler = new AlienTechActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        corporation.cargo = MAX_CARGO
        const player = state.getPlayerState(playerId)
        // Every player starts with 1 Alien Technology Cube already (Setup - see
        // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +2/-2
        // below nets back to that starting count instead of assuming it started at 0.
        const cubesBeforeAdd = player.alienTechCubes
        player.addAlienTechCubes(2)
        const context = createMachineContext(state)

        // Confirmed by the game's co-designer: a wasted boost is legal - still offered and
        // allowed, but the actual CARGO gain is clamped at MAX_CARGO.
        expect(HydratedCargoBoost.canOfferCargoBoost(state, playerId)).toBe(true)
        expect(HydratedCargoBoost.canCargoBoost(state, playerId, CorporationId.PinkInc, 2)).toBe(true)
        expect(handler.validActionsForPlayer(playerId, context)).toContain(ActionType.CargoBoost)

        const action = new HydratedCargoBoost({
            id: `cargo-boost-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.CargoBoost,
            playerId,
            corporationId: CorporationId.PinkInc,
            amount: 2
        } as CargoBoost)
        action.apply(state, context)

        expect(corporation.cargo).toBe(MAX_CARGO)
        expect(player.alienTechCubes).toBe(cubesBeforeAdd) // both cubes still spent, even though wasted
    })

    it('still clamps at the flat MAX_CARGO even with Hyperdrive active on the boosted Corporation', () => {
        const state = createTestState()
        const handler = new AlienTechActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        corporation.powers.push({ id: CorporatePowerId.Hyperdrive })
        corporation.cargo = MAX_CARGO
        const player = state.getPlayerState(playerId)
        player.addAlienTechCubes(2)
        const context = createMachineContext(state)

        const action = new HydratedCargoBoost({
            id: `cargo-boost-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.CargoBoost,
            playerId,
            corporationId: CorporationId.PinkInc,
            amount: 2
        } as CargoBoost)
        action.apply(state, context)

        expect(corporation.cargo).toBe(MAX_CARGO)
    })

    it('activates Wormhole Technology via Research Wormhole for any Shareholder', () => {
        const state = createTestState()
        const handler = new AlienTechActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        const player = state.getPlayerState(playerId)
        // Every player starts with 1 Alien Technology Cube already (Setup - see
        // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +1/-1
        // below nets back to that starting count instead of assuming it started at 0.
        const cubesBeforeAdd = player.alienTechCubes
        player.addAlienTechCubes(1)
        const context = createMachineContext(state)

        const action = new HydratedResearchWormhole({
            id: `research-wormhole-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.ResearchWormhole,
            playerId,
            corporationId: CorporationId.PinkInc
        } as ResearchWormhole)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.InvestorAction)
        expect(corporation.wormholeActive).toBe(true)
        expect(player.alienTechCubes).toBe(cubesBeforeAdd)
        expect(player.lastAlienTechActionId).toBe(AlienTechActionId.ResearchWormhole)
    })

    it('does not offer Research Wormhole once a Corporation already has it active', () => {
        const state = createTestState()
        const playerId = state.investorShenanigansCurrentPlayerId!
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer(playerId, state.actionCount)
        corporation.wormholeActive = true
        state.getPlayerState(playerId).addAlienTechCubes(1)

        expect(HydratedResearchWormhole.canOfferResearchWormhole(state, playerId)).toBe(false)
    })

    it("doubles a Neutral Planet's value via Develop Planet(s), immediately raising Mining Capacity", () => {
        const state = createTestState()
        const handler = new AlienTechActionStateHandler()
        handler.enter(createMachineContext(state))

        const playerId = state.investorShenanigansCurrentPlayerId!
        const player = state.getPlayerState(playerId)
        // Every player starts with 1 Alien Technology Cube already (Setup - see
        // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +1/-1
        // below nets back to that starting count instead of assuming it started at 0.
        const cubesBeforeAdd = player.alienTechCubes
        player.addAlienTechCubes(1)
        // Give PinkInc an Outpost on the target Neutral Planet so its Mining Capacity actually
        // reflects the doubled value.
        state.board.buildOutpost(NEUTRAL_PLANET_HEX_ID, CorporationId.PinkInc)
        const miningCapacityBefore = state.board.miningCapacityForCorporation(CorporationId.PinkInc)
        const context = createMachineContext(state)

        const action = new HydratedDevelopPlanets({
            id: `develop-planets-${playerId}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DevelopPlanets,
            playerId,
            hexIds: [NEUTRAL_PLANET_HEX_ID]
        } as DevelopPlanets)
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.InvestorAction)
        expect(state.board.getHex(NEUTRAL_PLANET_HEX_ID)?.valueDoubled).toBe(true)
        expect(player.alienTechCubes).toBe(cubesBeforeAdd)
        expect(player.lastAlienTechActionId).toBe(AlienTechActionId.DevelopPlanets)
        expect(state.board.miningCapacityForCorporation(CorporationId.PinkInc)).toBeGreaterThan(
            miningCapacityBefore
        )
    })

    it('rejects Develop Planet(s) on a Neutral Planet that already has a cube', () => {
        const state = createTestState()
        const playerId = state.investorShenanigansCurrentPlayerId!
        state.getPlayerState(playerId).addAlienTechCubes(1)
        state.board.requireHex(NEUTRAL_PLANET_HEX_ID).valueDoubled = true

        expect(
            HydratedDevelopPlanets.canDevelopPlanets(state, playerId, [NEUTRAL_PLANET_HEX_ID])
        ).toBe(false)
    })

    describe('Leaked Research', () => {
        it("activates Wormhole Technology for free, WITHOUT advancing to the next player, discarding the power after use", () => {
            const state = createTestState()
            const handler = new AlienTechActionStateHandler()
            handler.enter(createMachineContext(state))

            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount) // makes playerId President
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            const player = state.getPlayerState(playerId)
            // Every player starts with 1 Alien Technology Cube already (Setup - see
            // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +1/-1
            // below nets back to that starting count instead of assuming it started at 0.
            const cubesBeforeAdd = player.alienTechCubes
            player.addAlienTechCubes(1)
            const context = createMachineContext(state)

            expect(handler.validActionsForPlayer(playerId, context)).toContain(
                ActionType.LeakedResearch
            )

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

            // Unlike every other Alien Tech Action, this does NOT advance the turn - it's a
            // genuinely extra action, so the same player remains current, still free to take (or
            // pass on) their normal Alien Tech Action.
            expect(nextState).toBe(MachineState.AlienTechAction)
            expect(state.investorShenanigansCurrentPlayerId).toBe(playerId)
            expect(corporation.wormholeActive).toBe(true)
            expect(player.alienTechCubes).toBe(cubesBeforeAdd) // "still spending Alien Technology as normal"
            expect(corporation.powers).not.toContainEqual({ id: CorporatePowerId.LeakedResearch })

            // The player can still take (or pass on) their normal Alien Tech Action afterward.
            const passAction = new HydratedPassAlienTechAction({
                id: `pass-alien-tech-${playerId}`,
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.PassAlienTechAction,
                playerId
            } as PassAlienTechAction)
            passAction.apply(state, context)
            const afterPass = handler.onAction(passAction, context)
            expect(afterPass).toBe(MachineState.InvestorAction)
            expect(state.investorShenanigansCurrentPlayerId).toBe(
                state.investorShenanigansPlayerOrder![1]
            )
        })

        it('rejects Leaked Research from a Shareholder who is not President', () => {
            const state = createTestState()
            const playerId = state.investorShenanigansCurrentPlayerId!
            const otherPlayerId = state.investorShenanigansPlayerOrder![1]!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(otherPlayerId, state.actionCount) // otherPlayerId is President
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            state.getPlayerState(playerId).addAlienTechCubes(1)

            expect(HydratedLeakedResearch.canOfferLeakedResearch(state, playerId)).toBe(false)
            expect(
                HydratedLeakedResearch.canLeakedResearch(state, playerId, CorporationId.PinkInc)
            ).toBe(false)
        })

        it('rejects Leaked Research once Wormhole Technology is already active', () => {
            const state = createTestState()
            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            corporation.wormholeActive = true
            state.getPlayerState(playerId).addAlienTechCubes(1)

            expect(HydratedLeakedResearch.canOfferLeakedResearch(state, playerId)).toBe(false)
        })

        it('does not offer Leaked Research without enough Alien Technology Cubes', () => {
            const state = createTestState()
            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            // Every player starts with 1 Alien Technology Cube already (Setup - see
            // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - exactly enough to afford
            // Leaked Research's own 1-Cube cost, so this "not enough Cubes" scenario needs it
            // spent down to 0 first.
            state.getPlayerState(playerId).alienTechCubes = 0

            expect(HydratedLeakedResearch.canOfferLeakedResearch(state, playerId)).toBe(false)
        })
    })

    describe('Alien Engineering', () => {
        it('reclaims Cargo Boost cubes for free, reducing CARGO 1-for-1, WITHOUT advancing to the next player', () => {
            const state = createTestState()
            const handler = new AlienTechActionStateHandler()
            handler.enter(createMachineContext(state))

            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount) // makes playerId President
            corporation.powers.push({ id: CorporatePowerId.AlienEngineering })
            corporation.cargo = 5
            corporation.cargoBoostCubesOnCharter = 3
            const player = state.getPlayerState(playerId)
            // Every player starts with 1 Alien Technology Cube already (Setup - see
            // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +2
            // reclaimed below is asserted relative to that starting count.
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

            // Unlike every other Alien Tech Action, this does NOT advance the turn - it's a
            // genuinely extra, free action.
            expect(nextState).toBe(MachineState.AlienTechAction)
            expect(state.investorShenanigansCurrentPlayerId).toBe(playerId)
            expect(corporation.cargo).toBe(3) // 5 - 2
            expect(corporation.cargoBoostCubesOnCharter).toBe(1) // 3 - 2
            expect(player.alienTechCubes).toBe(cubesBefore + 2)
            // Ongoing (not One-Time) - the Power itself is never discarded.
            expect(corporation.powers).toContainEqual({ id: CorporatePowerId.AlienEngineering })
        })

        it('reclaims Wormhole access as an all-or-nothing boolean, alongside any Cargo Boost cubes', () => {
            const state = createTestState()
            const handler = new AlienTechActionStateHandler()
            handler.enter(createMachineContext(state))

            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.AlienEngineering })
            corporation.wormholeActive = true
            const player = state.getPlayerState(playerId)
            // Every player starts with 1 Alien Technology Cube already (Setup - see
            // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +1
            // reclaimed below is asserted relative to that starting count.
            const cubesBefore = player.alienTechCubes
            const context = createMachineContext(state)

            const action = new HydratedAlienEngineering({
                id: `alien-engineering-${playerId}`,
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.AlienEngineering,
                playerId,
                corporationId: CorporationId.PinkInc,
                cargoBoostCubesToReclaim: 0,
                reclaimWormhole: true
            } as AlienEngineering)
            action.apply(state, context)

            expect(corporation.wormholeActive).toBe(false)
            expect(player.alienTechCubes).toBe(cubesBefore + 1)
        })

        it('rejects reclaiming more Cargo Boost cubes than are on the Charter', () => {
            const state = createTestState()
            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.AlienEngineering })
            corporation.cargoBoostCubesOnCharter = 1

            expect(
                HydratedAlienEngineering.canAlienEngineering(
                    state,
                    playerId,
                    CorporationId.PinkInc,
                    2,
                    false
                )
            ).toBe(false)
        })

        it('rejects reclaiming Wormhole access when it is not active', () => {
            const state = createTestState()
            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.AlienEngineering })

            expect(
                HydratedAlienEngineering.canAlienEngineering(
                    state,
                    playerId,
                    CorporationId.PinkInc,
                    0,
                    true
                )
            ).toBe(false)
        })

        it('rejects a no-op reclaim (nothing to reclaim)', () => {
            const state = createTestState()
            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.AlienEngineering })

            expect(
                HydratedAlienEngineering.canAlienEngineering(
                    state,
                    playerId,
                    CorporationId.PinkInc,
                    0,
                    false
                )
            ).toBe(false)
        })

        it('rejects Alien Engineering from a Shareholder who is not President', () => {
            const state = createTestState()
            const playerId = state.investorShenanigansCurrentPlayerId!
            const otherPlayerId = state.investorShenanigansPlayerOrder![1]!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(otherPlayerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.AlienEngineering })
            corporation.cargoBoostCubesOnCharter = 2

            expect(
                HydratedAlienEngineering.canAlienEngineering(
                    state,
                    playerId,
                    CorporationId.PinkInc,
                    1,
                    false
                )
            ).toBe(false)
        })

        it('does not offer Alien Engineering without the power active', () => {
            const state = createTestState()
            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.cargoBoostCubesOnCharter = 2

            expect(HydratedAlienEngineering.canOfferAlienEngineering(state, playerId)).toBe(false)
        })

        it('does not offer Alien Engineering when there is nothing to reclaim', () => {
            const state = createTestState()
            const playerId = state.investorShenanigansCurrentPlayerId!
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.issueShareToPlayer(playerId, state.actionCount)
            corporation.powers.push({ id: CorporatePowerId.AlienEngineering })

            expect(HydratedAlienEngineering.canOfferAlienEngineering(state, playerId)).toBe(false)
        })
    })
})
