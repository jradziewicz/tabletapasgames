import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { BoardState, Hex, HexType, HydratedBoardState, hexDistance } from '../model/board.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import {
    ExpandNetworkOutpostCosts,
    awardAlienExplorersCubes,
    buildOutpostForCorporation,
    canBuildExpansionOutpost,
    createWormholeCost,
    createWormholeCostForCorporation,
    expandNetworkCost,
    finalizeExpansion,
    hasAnyValidExpansionTarget,
    placementPenaltyForHex,
    placementPenaltyForHexForCorporation
} from './network.js'
import { ActionType } from '../definition/actions.js'

// A minimal real game state (via the initializer, so it has a real board with real Alien Planet
// hexes - e.g. '6,0' on the Alpha map - and real player state), for tests that need more than the
// synthetic test board below provides.
function createTestGameState(playerCount = 4) {
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

// A small synthetic line-shaped board, isolated from the real Alpha map, so these tests exercise
// the cost/restriction logic itself rather than depending on real board coordinates.
//
//   A(0,0) - B(1,0) - C(2,0) - D(3,0)
//     |
//   E(0,1) [Anomaly]
//     |
//   F(1,-1) [Alien Planet]
//
//   G(-1,0) [Sun], also adjacent to A
//
// A is CorpX's Home Planet (with its Setup Outpost already there). D already has CorpY's Outpost
// (for placement-penalty tests). F is adjacent to A too, for Alien Explorers tests, and G for
// Icarus Experiment tests. Two disconnected Mega-Earth hexes are also included.
function createTestBoard(): HydratedBoardState {
    const hexes: Hex[] = [
        {
            id: '0,0',
            coordinate: { q: 0, r: 0 },
            type: HexType.HomePlanet,
            baseValue: 1,
            homeCorporationId: CorporationId.PinkInc,
            outposts: [CorporationId.PinkInc]
        },
        { id: '1,0', coordinate: { q: 1, r: 0 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
        { id: '2,0', coordinate: { q: 2, r: 0 }, type: HexType.DeepSpace, outposts: [] },
        {
            id: '3,0',
            coordinate: { q: 3, r: 0 },
            type: HexType.NeutralPlanet,
            baseValue: 3,
            outposts: [CorporationId.FrostFederated]
        },
        { id: '0,1', coordinate: { q: 0, r: 1 }, type: HexType.Anomaly, outposts: [] },
        { id: '1,-1', coordinate: { q: 1, r: -1 }, type: HexType.AlienPlanet, outposts: [] },
        { id: '-1,0', coordinate: { q: -1, r: 0 }, type: HexType.Sun, outposts: [] },
        { id: '5,5', coordinate: { q: 5, r: 5 }, type: HexType.MegaEarth, outposts: [] },
        { id: '6,5', coordinate: { q: 6, r: 5 }, type: HexType.MegaEarth, outposts: [] }
    ]

    const board: BoardState = {
        hexes: Object.fromEntries(hexes.map((hex) => [hex.id, hex])),
        megaEarth: { valueTrack: [6, 9, 12, 15], fillOrder: [] }
    }
    return new HydratedBoardState(board)
}

describe('hexDistance', () => {
    it('computes standard axial hex distances', () => {
        expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0)
        expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3)
        expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 3 })).toBe(3)
        expect(hexDistance({ q: 0, r: 0 }, { q: -2, r: 1 })).toBe(2)
        expect(hexDistance({ q: 1, r: -1 }, { q: -1, r: 2 })).toBe(3)
    })
})

describe('HydratedBoardState.canBuildOutpost (Outpost Restrictions)', () => {
    it('blocks a Corporation from building a 2nd Outpost on a hex it already occupies', () => {
        const board = createTestBoard()
        expect(board.canBuildOutpost('0,0', CorporationId.PinkInc)).toBe(false)
    })

    it('blocks other Corporations from building on a Home Planet, but not the owner', () => {
        const board = createTestBoard()
        expect(board.canBuildOutpost('0,0', CorporationId.FrostFederated)).toBe(false)
        // The owner already has its Setup Outpost there, so it's blocked too (max 1 per hex).
        expect(board.canBuildOutpost('0,0', CorporationId.PinkInc)).toBe(false)
    })

    it('allows up to 2 Outposts on a Neutral Planet / Deep Space hex, then blocks a 3rd', () => {
        const board = createTestBoard()
        expect(board.canBuildOutpost('3,0', CorporationId.PinkInc)).toBe(true)
        board.buildOutpost('3,0', CorporationId.PinkInc)
        expect(board.canBuildOutpost('3,0', CorporationId.ScarletSyndicate)).toBe(false)
    })

    it('always blocks Anomaly hexes', () => {
        const board = createTestBoard()
        expect(board.canBuildOutpost('0,1', CorporationId.PinkInc)).toBe(false)
    })

    it('blocks Sun hexes unless canBuildOnSunAnomalies is true (e.g. Icarus Experiment)', () => {
        const board = createTestBoard()
        expect(board.canBuildOutpost('-1,0', CorporationId.PinkInc)).toBe(false)
        expect(board.canBuildOutpost('-1,0', CorporationId.PinkInc, false, true)).toBe(true)
    })

    it('canBuildOnSunAnomalies also lifts the block on plain Anomaly hexes', () => {
        const board = createTestBoard()
        expect(board.canBuildOutpost('0,1', CorporationId.PinkInc, false, true)).toBe(true)
    })

    it('blocks Alien Planet hexes unless canBuildOnAlienPlanets is true (e.g. Alien Explorers)', () => {
        const board = createTestBoard()
        expect(board.canBuildOutpost('1,-1', CorporationId.PinkInc)).toBe(false)
        expect(board.canBuildOutpost('1,-1', CorporationId.PinkInc, true)).toBe(true)
    })

    it('allows Mega-Earth builds until its 4-Corporation capacity is reached', () => {
        const board = createTestBoard()
        expect(board.canBuildOutpost('5,5', CorporationId.PinkInc)).toBe(true)
        board.buildOutpost('5,5', CorporationId.PinkInc)
        board.buildOutpost('6,5', CorporationId.FrostFederated)
        board.buildOutpost('5,5', CorporationId.ScarletSyndicate)
        board.buildOutpost('6,5', CorporationId.CeruleanCouncil)
        // 4 Corporations now present (shared across both physical hexes) - no room for a 5th.
        expect(board.canBuildOutpost('5,5', CorporationId.GambogeGuild)).toBe(false)
        expect(board.canBuildOutpost('6,5', CorporationId.GambogeGuild)).toBe(false)
    })

    it("blocks a Corporation from a 2nd Mega-Earth Outpost on the OTHER physical hex", () => {
        const board = createTestBoard()
        board.buildOutpost('5,5', CorporationId.PinkInc)
        expect(board.canBuildOutpost('6,5', CorporationId.PinkInc)).toBe(false)
    })

    it('blocks a 3rd Outpost on Deep Space unless ignoresDeepSpaceOutpostCap is true (Cloaking Devices)', () => {
        const board = createTestBoard()
        board.buildOutpost('2,0', CorporationId.FrostFederated)
        board.buildOutpost('2,0', CorporationId.CeruleanCouncil)
        expect(board.canBuildOutpost('2,0', CorporationId.PinkInc)).toBe(false)
        expect(board.canBuildOutpost('2,0', CorporationId.PinkInc, false, false, true)).toBe(true)
    })

    it('ignoresDeepSpaceOutpostCap does not lift the cap on Neutral Planet hexes', () => {
        const board = createTestBoard()
        board.buildOutpost('3,0', CorporationId.CeruleanCouncil) // '3,0' now has 2 Corporations
        expect(board.canBuildOutpost('3,0', CorporationId.PinkInc, false, false, true)).toBe(false)
    })

    it('ignoresDeepSpaceOutpostCap still blocks a 2nd Outpost of the SAME Corporation on one hex', () => {
        const board = createTestBoard()
        board.buildOutpost('2,0', CorporationId.PinkInc)
        expect(board.canBuildOutpost('2,0', CorporationId.PinkInc, false, false, true)).toBe(false)
    })
})

describe('currentMegaEarthValue / miningCapacityForCorporation (ripple effect)', () => {
    it('matches the rulebook worked example: 9 -> 12 when a 3rd Corporation builds there', () => {
        const board = createTestBoard()
        // Use Corporations with no other Outposts on this test board, so their whole Mining
        // Capacity comes from Mega-Earth alone (PinkInc and FrostFederated both already have
        // an unrelated Outpost elsewhere on this synthetic board).
        board.buildOutpost('5,5', CorporationId.ScarletSyndicate)
        board.buildOutpost('6,5', CorporationId.CeruleanCouncil)
        expect(board.miningCapacityForCorporation(CorporationId.ScarletSyndicate)).toBe(9)
        expect(board.miningCapacityForCorporation(CorporationId.CeruleanCouncil)).toBe(9)

        board.buildOutpost('5,5', CorporationId.GambogeGuild)

        // The new 3rd Corporation gains the new shared value outright...
        expect(board.miningCapacityForCorporation(CorporationId.GambogeGuild)).toBe(12)
        // ...and the 2 existing Corporations ripple up from 9 to 12 as well.
        expect(board.miningCapacityForCorporation(CorporationId.ScarletSyndicate)).toBe(12)
        expect(board.miningCapacityForCorporation(CorporationId.CeruleanCouncil)).toBe(12)
    })
})

describe('expandNetworkCost', () => {
    it('charges the Charter cost table plus a placement penalty per other Corporation present', () => {
        const board = createTestBoard()
        expect(expandNetworkCost(board, ['1,0'])).toBe(ExpandNetworkOutpostCosts[1])
        // '3,0' already has 1 other Corporation's Outpost (FrostFederated) -> +1 penalty.
        expect(expandNetworkCost(board, ['3,0'])).toBe(ExpandNetworkOutpostCosts[1]! + 1)
        expect(expandNetworkCost(board, ['1,0', '2,0'])).toBe(ExpandNetworkOutpostCosts[2])
    })
})

describe('createWormholeCost', () => {
    it('matches the rulebook worked example: 2 hexes skipped, +4 flat, +2 placement penalty = 8', () => {
        const board = createTestBoard()
        // Give PinkInc a 2nd Outpost 1 hex from '3,0' isn't needed - measure straight from Home
        // Planet '0,0' to a hex 3 away with 2 other Corporations' Outposts already present.
        board.buildOutpost('3,0', CorporationId.CeruleanCouncil) // '3,0' now has 2 Corporations
        const target: Hex = {
            id: '3,-3',
            coordinate: { q: 3, r: -3 },
            type: HexType.DeepSpace,
            outposts: []
        }
        board.hexes[target.id] = target
        // distance from PinkInc's only Outpost (0,0) to (3,-3): (|3|+|3-3|+|-3|)/2 = 3 - but the
        // cost only charges for hexes SKIPPED (the ones strictly in between), which is distance -
        // 1 = 2 (confirmed by the co-designer: skipping over 1 hex costs +₮1, i.e. an adjacent
        // hex at distance 1 skips 0 and costs just the +₮4 flat fee).
        expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -3 })).toBe(3)
        expect(createWormholeCost(board, CorporationId.PinkInc, target.id)).toBe(2 + 4 + 0)
        expect(createWormholeCost(board, CorporationId.PinkInc, '3,0')).toBe(2 + 4 + 2)
    })

    it('charges 0 for an adjacent hex (0 hexes skipped) and +1 for skipping over 1 hex', () => {
        const board = createTestBoard()
        // PinkInc's Home Planet Outpost sits at '0,0' (see createTestBoard below).
        expect(createWormholeCost(board, CorporationId.PinkInc, '1,0')).toBe(0 + 4 + 0)
        expect(createWormholeCost(board, CorporationId.PinkInc, '2,0')).toBe(1 + 4 + 0)
    })

    it('returns undefined if the Corporation has no Outpost anywhere to measure from', () => {
        const board = createTestBoard()
        expect(createWormholeCost(board, CorporationId.GambogeGuild, '2,0')).toBeUndefined()
    })
})

describe('createWormholeCostForCorporation (Quantum Propulsion)', () => {
    it('matches the base cost when Quantum Propulsion is not active', () => {
        const state = createTestGameState()
        const corporationId = CorporationId.PinkInc
        const baseCost = createWormholeCost(state.board, corporationId, '2,0')
        expect(createWormholeCostForCorporation(state, corporationId, '2,0')).toBe(baseCost)
    })

    it('applies a ₮2 discount once Quantum Propulsion is active', () => {
        const state = createTestGameState()
        const corporationId = CorporationId.PinkInc
        state.getCorporation(corporationId).powers.push({ id: CorporatePowerId.QuantumPropulsion })
        const baseCost = createWormholeCost(state.board, corporationId, '2,0')!
        expect(createWormholeCostForCorporation(state, corporationId, '2,0')).toBe(baseCost - 2)
    })

    it('never goes below 0, even if a hypothetical larger discount would', () => {
        // With today's single ₮2 discount and a ₮4 flat cost floor, the discount can never
        // actually push a real cost below 0 - but createWormholeCostForCorporation floors
        // defensively via Math.max(0, ...) regardless, so verify the formula directly.
        const state = createTestGameState()
        const corporationId = CorporationId.PinkInc
        state.getCorporation(corporationId).powers.push({ id: CorporatePowerId.QuantumPropulsion })
        const baseCost = createWormholeCost(state.board, corporationId, '2,0')!
        expect(createWormholeCostForCorporation(state, corporationId, '2,0')).toBe(
            Math.max(0, baseCost - 2)
        )
    })

    it('returns undefined if the Corporation has no Outpost anywhere to measure from', () => {
        const state = createTestGameState()
        const corporationId = CorporationId.PinkInc
        state.getCorporation(corporationId).powers.push({ id: CorporatePowerId.QuantumPropulsion })
        // Wipe every Outpost belonging to this Corporation off the board.
        for (const hex of Object.values(state.board.hexes)) {
            hex.outposts = hex.outposts.filter((id) => id !== corporationId)
        }
        state.board.megaEarth.fillOrder = state.board.megaEarth.fillOrder.filter((id) => id !== corporationId)
        expect(createWormholeCostForCorporation(state, corporationId, '2,0')).toBeUndefined()
    })
})

describe('placementPenaltyForHexForCorporation (Cloaking Devices)', () => {
    it('matches the base penalty when Cloaking Devices is not active', () => {
        const state = createTestGameState()
        const corporationId = CorporationId.PinkInc
        // '6,0' is a real Alien Planet hex on the Alpha map with no Outposts yet - use a Deep
        // Space hex instead so this test is meaningful: build another Corporation there first.
        const deepSpaceHexId = Object.values(state.board.hexes).find(
            (hex) => hex.type === HexType.DeepSpace
        )!.id
        state.board.buildOutpost(deepSpaceHexId, CorporationId.FrostFederated)
        expect(
            placementPenaltyForHexForCorporation(state, corporationId, deepSpaceHexId)
        ).toBe(placementPenaltyForHex(state.board, deepSpaceHexId))
        expect(placementPenaltyForHexForCorporation(state, corporationId, deepSpaceHexId)).toBe(1)
    })

    it('is always 0 on Deep Space hexes once Cloaking Devices is active', () => {
        const state = createTestGameState()
        const corporationId = CorporationId.PinkInc
        state.getCorporation(corporationId).powers.push({ id: CorporatePowerId.CloakingDevices })
        const deepSpaceHexId = Object.values(state.board.hexes).find(
            (hex) => hex.type === HexType.DeepSpace
        )!.id
        state.board.buildOutpost(deepSpaceHexId, CorporationId.FrostFederated)
        state.board.buildOutpost(deepSpaceHexId, CorporationId.CeruleanCouncil)
        expect(placementPenaltyForHexForCorporation(state, corporationId, deepSpaceHexId)).toBe(0)
    })

    it('does not affect the penalty on non-Deep-Space hexes, even with Cloaking Devices active', () => {
        const state = createTestGameState()
        const corporationId = CorporationId.PinkInc
        state.getCorporation(corporationId).powers.push({ id: CorporatePowerId.CloakingDevices })
        const neutralPlanetHexId = Object.values(state.board.hexes).find(
            (hex) => hex.type === HexType.NeutralPlanet
        )!.id
        state.board.buildOutpost(neutralPlanetHexId, CorporationId.FrostFederated)
        expect(placementPenaltyForHexForCorporation(state, corporationId, neutralPlanetHexId)).toBe(
            placementPenaltyForHex(state.board, neutralPlanetHexId)
        )
    })
})

describe('canBuildExpansionOutpost', () => {
    it('accepts a single hex adjacent to an existing Outpost', () => {
        const board = createTestBoard()
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '1,0')).toBe(true)
    })

    it('accepts a hex adjacent to an Outpost built earlier in the same in-progress build', () => {
        const board = createTestBoard()
        // '2,0' is not adjacent to '0,0' (PinkInc's only Outpost)...
        expect(board.isAdjacentToOutpost('2,0', CorporationId.PinkInc)).toBe(false)
        // ...but once '1,0' is itself built (one Outpost at a time - see actions/expandNetwork.ts),
        // '2,0' becomes adjacent to PinkInc's network for free, with no separate chain list needed.
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '1,0')).toBe(true)
        board.buildOutpost('1,0', CorporationId.PinkInc)
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '2,0')).toBe(true)
    })

    it('rejects a hex not adjacent to the existing network', () => {
        const board = createTestBoard()
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '2,0')).toBe(false)
    })

    it('rejects a hex that fails the Outpost Restrictions even if adjacency is fine', () => {
        const board = createTestBoard()
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '0,1')).toBe(false)
    })

    it('rejects an Alien Planet hex unless canBuildOnAlienPlanets is true', () => {
        const board = createTestBoard()
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '1,-1')).toBe(false)
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '1,-1', true)).toBe(true)
    })

    it('rejects a Sun hex unless canBuildOnSunAnomalies is true (Icarus Experiment)', () => {
        const board = createTestBoard()
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '-1,0')).toBe(false)
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '-1,0', false, true)).toBe(true)
    })

    it('allows chaining through a 2nd Alien Planet once the 1st has been built', () => {
        // "End Expansion" (rulebook page 22) no longer stops the chain itself at build-validation
        // time - a Corporation may keep building past an Alien Planet it built on (see
        // stateHandlers/expandNetworkOrWormhole.ts's looping and operations/agreement.ts's
        // isEligibleToSignTheAgreement, which is what actually offers/ends the build).
        const board = createTestBoard()
        const secondAlienPlanet: Hex = {
            id: '2,-1',
            coordinate: { q: 2, r: -1 },
            type: HexType.AlienPlanet,
            outposts: []
        }
        board.hexes[secondAlienPlanet.id] = secondAlienPlanet
        expect(board.isAdjacent('1,-1', '2,-1')).toBe(true)
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '1,-1', true)).toBe(true)
        board.buildOutpost('1,-1', CorporationId.PinkInc)
        expect(canBuildExpansionOutpost(board, CorporationId.PinkInc, '2,-1', true)).toBe(true)
    })
})

describe('placementPenaltyForHex', () => {
    it('charges ₮1 per other Corporation already present, evaluated before this build', () => {
        const board = createTestBoard()
        expect(placementPenaltyForHex(board, '1,0')).toBe(0)
        // '3,0' already has FrostFederated's Outpost.
        expect(placementPenaltyForHex(board, '3,0')).toBe(1)
    })
})

describe('finalizeExpansion', () => {
    it('is a no-op when no build is in progress', () => {
        const state = createTestGameState()
        const treasuryBefore = state.getCorporation(CorporationId.PinkInc).treasury
        finalizeExpansion(state)
        expect(state.getCorporation(CorporationId.PinkInc).treasury).toBe(treasuryBefore)
    })

    it('charges the Corporate Treasury the lump sum for an in-progress Expand Network build', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        // A freshly-initialized (pre-auction) test Corporation starts with 0 Treasury - see
        // StellarVenturesGameInitializer, which only assigns each Corporation's real starting
        // Treasury once it's actually auctioned to a President. Give it enough here to afford
        // this build, so the assertion below exercises the lump-sum charge itself rather than
        // finalizeExpansion's separate 0-floor safety clamp - a real game can never reach this
        // call already short of funds, since HydratedExpandNetwork.canExpandNetwork refuses to
        // let a build proceed past what the Corporation can currently afford.
        corporation.treasury = 20
        const treasuryBefore = corporation.treasury
        state.expandingCorporationId = CorporationId.PinkInc
        state.expandingBuilderId = 'p1'
        state.expandingKind = ActionType.ExpandNetwork
        state.expandingHexIds = ['a', 'b']
        state.expandingPlacementPenalty = 3
        finalizeExpansion(state)
        expect(corporation.treasury).toBe(treasuryBefore - (ExpandNetworkOutpostCosts[2]! + 3))
        expect(state.expandingCorporationId).toBeUndefined()
        expect(state.expandingBuilderId).toBeUndefined()
        expect(state.expandingKind).toBeUndefined()
        expect(state.expandingHexIds).toBeUndefined()
        expect(state.expandingPlacementPenalty).toBeUndefined()
    })

    it("charges the builder's Liquid Funds for an in-progress Private Contractor build, including the placement penalty", () => {
        const state = createTestGameState()
        const fundsBefore = state.getPlayerState('p1').liquidFunds
        state.expandingCorporationId = CorporationId.PinkInc
        state.expandingBuilderId = 'p1'
        state.expandingKind = ActionType.PrivateContractor
        state.expandingHexIds = ['a']
        state.expandingPlacementPenalty = 3
        finalizeExpansion(state)
        expect(state.getPlayerState('p1').liquidFunds).toBe(
            fundsBefore - (ExpandNetworkOutpostCosts[1]! + 3)
        )
    })
})

describe('hasAnyValidExpansionTarget', () => {
    it('is true when at least one adjacent, buildable hex exists', () => {
        const board = createTestBoard()
        expect(hasAnyValidExpansionTarget(board, CorporationId.PinkInc)).toBe(true)
    })

    it('is false once no adjacent hex is buildable, even counting the adjacent Alien Planet without the Power', () => {
        const board = createTestBoard()
        // PinkInc's only Outpost (0,0) is adjacent to '1,0', '0,1', and '1,-1' on this test
        // board. '0,1' is an Anomaly (always blocked); '1,-1' is an Alien Planet (blocked without
        // canBuildOnAlienPlanets); filling '1,0' to its 2-Outpost cap with 2 other Corporations
        // blocks it too, leaving no valid adjacent target.
        board.buildOutpost('1,0', CorporationId.FrostFederated)
        board.buildOutpost('1,0', CorporationId.ScarletSyndicate)
        expect(hasAnyValidExpansionTarget(board, CorporationId.PinkInc)).toBe(false)
    })

    it('is true for the same board once canBuildOnAlienPlanets is true, via the adjacent Alien Planet', () => {
        const board = createTestBoard()
        board.buildOutpost('1,0', CorporationId.FrostFederated)
        board.buildOutpost('1,0', CorporationId.ScarletSyndicate)
        expect(hasAnyValidExpansionTarget(board, CorporationId.PinkInc, true)).toBe(true)
    })

    it('is true for the same board once canBuildOnSunAnomalies is true, via the adjacent Sun', () => {
        const board = createTestBoard()
        board.buildOutpost('1,0', CorporationId.FrostFederated)
        board.buildOutpost('1,0', CorporationId.ScarletSyndicate)
        expect(hasAnyValidExpansionTarget(board, CorporationId.PinkInc, false, true)).toBe(true)
    })
})

describe('buildOutpostForCorporation', () => {
    it('builds the Outpost on the board and decrements unbuiltOutposts by 1', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        const before = corporation.unbuiltOutposts
        expect(before).toBeGreaterThan(0)

        buildOutpostForCorporation(state, '2,0', CorporationId.PinkInc)

        expect(state.board.hasOutpost('2,0', CorporationId.PinkInc)).toBe(true)
        expect(corporation.unbuiltOutposts).toBe(before - 1)
    })

    it('floors unbuiltOutposts at 0 defensively rather than going negative', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.unbuiltOutposts = 0

        buildOutpostForCorporation(state, '2,0', CorporationId.PinkInc)

        expect(corporation.unbuiltOutposts).toBe(0)
    })
})

// Every player starts with 1 Alien Technology Cube already (Setup - see
// STARTING_ALIEN_TECH_CUBES in definition/initializer.ts), so every assertion below is relative
// to a freshly-captured cubesBefore rather than assuming a 0 starting count.
describe('awardAlienExplorersCubes', () => {
    it('awards 1 Alien Technology Cube per Alien Planet hex built, to the given player', () => {
        const state = createTestGameState()
        // '6,0' and '1,1' are both real Alien Planet hexes on the Alpha map (data/alphaBoard.ts).
        expect(state.board.getHex('6,0')?.type).toBe(HexType.AlienPlanet)
        expect(state.board.getHex('1,1')?.type).toBe(HexType.AlienPlanet)
        // Every starting Corporation begins with Alien Explorers active (model/corporation.ts),
        // so PinkInc here earns the cube same as any of them would.
        const cubesBefore = state.getPlayerState('p1').alienTechCubes
        awardAlienExplorersCubes(state, 'p1', CorporationId.PinkInc, ['6,0', '1,1'])
        expect(state.getPlayerState('p1').alienTechCubes).toBe(cubesBefore + 2)
    })

    it('awards nothing when none of the built hexes are Alien Planets', () => {
        const state = createTestGameState()
        const nonAlienPlanetHexId = Object.values(state.board.hexes).find(
            (hex) => hex.type !== HexType.AlienPlanet
        )!.id
        const cubesBefore = state.getPlayerState('p1').alienTechCubes
        awardAlienExplorersCubes(state, 'p1', CorporationId.PinkInc, [nonAlienPlanetHexId])
        expect(state.getPlayerState('p1').alienTechCubes).toBe(cubesBefore)
    })

    it('awards nothing for a Corporation without Alien Explorers active, even on an Alien Planet hex', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.AlienExplorers
        )
        const cubesBefore = state.getPlayerState('p1').alienTechCubes
        awardAlienExplorersCubes(state, 'p1', CorporationId.PinkInc, ['6,0'])
        expect(state.getPlayerState('p1').alienTechCubes).toBe(cubesBefore)
    })

    it('awards nothing for Secret Agents specifically - Amethyst Agency builds on Alien Planets without gaining Alien Technology', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.AmethystAgency)
        corporation.powers = [{ id: CorporatePowerId.SecretAgents }]
        const cubesBefore = state.getPlayerState('p1').alienTechCubes
        awardAlienExplorersCubes(state, 'p1', CorporationId.AmethystAgency, ['6,0'])
        expect(state.getPlayerState('p1').alienTechCubes).toBe(cubesBefore)
    })
})

describe('HydratedCorporationState.canBuildOnAlienPlanets', () => {
    it('is true for a Corporation with Alien Explorers active', () => {
        const state = createTestGameState()
        expect(state.getCorporation(CorporationId.PinkInc).canBuildOnAlienPlanets()).toBe(true)
    })

    it('is true for Amethyst Agency with Secret Agents active, even without Alien Explorers', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.AmethystAgency)
        corporation.powers = [{ id: CorporatePowerId.SecretAgents }]
        expect(corporation.canBuildOnAlienPlanets()).toBe(true)
    })

    it('is false for a Corporation with neither Power', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.AlienExplorers
        )
        expect(corporation.canBuildOnAlienPlanets()).toBe(false)
    })
})
