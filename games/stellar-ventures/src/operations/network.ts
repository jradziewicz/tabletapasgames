import { HydratedBoardState, HexType } from '../model/board.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { closeBordersReachedByCorporations } from './borders.js'

/**
 * Corporate Treasury cost (per Charter) for Expand Network, indexed by the total number of
 * Outposts built in a single action (1-5). Confirmed against the rulebook (pages 12-13).
 */
export const ExpandNetworkOutpostCosts: Record<number, number> = {
    1: 1,
    2: 2,
    3: 4,
    4: 7,
    5: 10
}

// Create Wormhole (rulebook page 14): ₮1 per hex skipped from the nearest existing Outpost,
// +₮4 flat for building the Outpost, plus the same ₮1-per-other-Corporation placement penalty
// Expand Network uses.
export const CreateWormholeFlatCost = 4
export const CreateWormholeCostPerHexSkipped = 1
export const PlacementPenaltyPerOtherOutpost = 1

// The ₮1-per-other-Corporation-already-present placement penalty for a single hex, evaluated at
// the moment just BEFORE this Corporation builds there (so it never counts this Corporation's
// own, about-to-be-placed Outpost). Used by Expand Network's per-Outpost accumulation
// (state.expandingPlacementPenalty - see actions/expandNetwork.ts) and by Create Wormhole, which
// still charges its cost immediately since it only ever builds 1 Outpost per action.
export function placementPenaltyForHex(board: HydratedBoardState, hexId: string): number {
    return board.otherCorporationOutpostCount(hexId) * PlacementPenaltyPerOtherOutpost
}

// Cloaking Devices (Glossary, page 29): "May build Outposts on Deep Space hexes ignoring Outpost
// Restrictions and Placement Penalties." Layered on top of placementPenaltyForHex exactly like
// Quantum Propulsion is layered on top of createWormholeCost - callers that already have the
// full game state and a specific building Corporation (Expand Network's accumulation, Create
// Wormhole's immediate charge) should use this instead of calling placementPenaltyForHex
// directly, so a Cloaking Devices Corporation is never charged to build on Deep Space.
export function placementPenaltyForHexForCorporation(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    hexId: string
): number {
    const hex = state.board.requireHex(hexId)
    if (hex.type === HexType.DeepSpace) {
        const corporation = state.getCorporation(corporationId)
        if (corporation.hasActivePower(CorporatePowerId.CloakingDevices)) {
            return 0
        }
    }
    return placementPenaltyForHex(state.board, hexId)
}

/**
 * Total Corporate Treasury cost to build the given Outposts via Expand Network in one action, on
 * a board where none of hexIds has been built on yet. Used for tests and for one-shot cost
 * previews; the real Expand Network action accumulates cost incrementally instead (see
 * actions/expandNetwork.ts), since by the time later Outposts in the same action are built, the
 * earlier ones already sit on the board and would otherwise double-count this Corporation's own
 * Outpost in the placement penalty.
 */
export function expandNetworkCost(board: HydratedBoardState, hexIds: string[]): number {
    const buildCost = ExpandNetworkOutpostCosts[hexIds.length]
    if (buildCost === undefined) {
        return Infinity
    }
    const placementPenalty = hexIds.reduce(
        (total, hexId) => total + placementPenaltyForHex(board, hexId),
        0
    )
    return buildCost + placementPenalty
}

/**
 * Total Corporate Treasury cost to build a single Outpost anywhere on the board via Create
 * Wormhole. Returns undefined if the Corporation has no existing Outpost to measure distance
 * from (shouldn't happen once Setup has placed its Home Planet Outpost).
 *
 * distanceToNearestOutpost returns the hex-grid distance (the number of steps from the existing
 * Outpost to the target, so an adjacent hex is distance 1) - but the rulebook charges per hex
 * SKIPPED OVER, i.e. the hexes strictly between the two, which is one fewer than that (an
 * adjacent hex skips 0; a hex 2 away skips the 1 hex in between, for +₮1; confirmed by the
 * game's co-designer). Floored at 0 defensively, though distance is never less than 1 here (a
 * Corporation always has at least its own Home Planet Outpost, so hexId itself, at distance 0,
 * only happens if that hex ALREADY has this Corporation's Outpost - Outpost Restriction #1 in
 * board.ts's canBuildOutpost rejects that build before cost is ever charged for it).
 */
export function createWormholeCost(
    board: HydratedBoardState,
    corporationId: CorporationId,
    hexId: string,
    placementPenalty: number = placementPenaltyForHex(board, hexId)
): number | undefined {
    const distance = board.distanceToNearestOutpost(hexId, corporationId)
    if (distance === undefined) {
        return undefined
    }
    const hexesSkipped = Math.max(0, distance - 1)
    return hexesSkipped * CreateWormholeCostPerHexSkipped + CreateWormholeFlatCost + placementPenalty
}

// Quantum Propulsion (Glossary, page 29): "Corporation Round, Ongoing. ₮2 discount on the Create
// Wormhole action (requires Active Wormhole Technology)." Layered on top of createWormholeCost
// rather than folded into it directly, so that function's unit tests (and any other caller that
// wants the Power-agnostic base cost) stay unaffected. Floored at 0 - a discount never produces a
// negative cost. actions/createWormhole.ts should call this instead of createWormholeCost
// directly wherever the real charge (or a legality check against it) happens.
export const QuantumPropulsionDiscount = 2

export function createWormholeCostForCorporation(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    hexId: string
): number | undefined {
    const placementPenalty = placementPenaltyForHexForCorporation(state, corporationId, hexId)
    const cost = createWormholeCost(state.board, corporationId, hexId, placementPenalty)
    if (cost === undefined) {
        return undefined
    }
    const corporation = state.getCorporation(corporationId)
    if (!corporation.hasActivePower(CorporatePowerId.QuantumPropulsion)) {
        return cost
    }
    return Math.max(0, cost - QuantumPropulsionDiscount)
}

/**
 * Base Charter-cost-table portion of Private Contractor's cost (rulebook page 19: builds 1-5
 * Outposts for a Corporation exactly like Expand Network - same base cost table, same adjacency
 * rules, see canBuildExpansionOutpost - but paid from the acting Investor's own Liquid Funds
 * rather than the Corporate Treasury). Unlike Jerry-Rig, Private Contractor DOES incur the same
 * ₮1-per-other-Corporation placement penalty Expand Network does - see
 * actions/privateContractor.ts, which accumulates it incrementally in
 * state.expandingPlacementPenalty exactly like actions/expandNetwork.ts does, for the same
 * double-counting reason (this base-cost function alone stays correct to call with the full
 * accumulated hexIds list even after every one of them is already built, but the penalty itself
 * cannot be recomputed that way after the fact - see finalizeExpansion below, which adds the
 * accumulated penalty on top of this).
 */
export function privateContractorCost(hexIds: string[]): number {
    return ExpandNetworkOutpostCosts[hexIds.length] ?? Infinity
}

/**
 * Whether a single Outpost can be built at hexId via Expand Network, Private Contractor or
 * Jerry-Rig: it must pass the Outpost Restrictions (see HydratedBoardState.canBuildOutpost) and
 * be adjacent to an Outpost the Corporation already has. Since Expand Network and Private
 * Contractor now submit one Outpost per action (see actions/expandNetwork.ts,
 * actions/privateContractor.ts), a hex built earlier in the same multi-step build already sits on
 * the board by the time the next one is validated, so "chaining" falls out of this adjacency
 * check for free - no separate in-progress chain list is needed. canBuildOnAlienPlanets should
 * reflect whether the Corporation currently has an active Power that allows it (e.g. Alien
 * Explorers - see model/corporation.ts's CorporatePowerId); canBuildOnSunAnomalies likewise
 * reflects Icarus Experiment.
 */
export function canBuildExpansionOutpost(
    board: HydratedBoardState,
    corporationId: CorporationId,
    hexId: string,
    canBuildOnAlienPlanets = false,
    canBuildOnSunAnomalies = false,
    ignoresDeepSpaceOutpostCap = false,
    canBuildOnNebulaAnomaly = false
): boolean {
    return (
        board.canBuildOutpost(
            hexId,
            corporationId,
            canBuildOnAlienPlanets,
            canBuildOnSunAnomalies,
            ignoresDeepSpaceOutpostCap,
            canBuildOnNebulaAnomaly
        ) && board.isAdjacentToOutpost(hexId, corporationId)
    )
}

/**
 * True if the Corporation has at least one legal Expand Network target right now (adjacent to
 * one of its existing Outposts and passing the Outpost Restrictions) - used to decide whether to
 * even offer the action, without knowing which specific hex a player might choose.
 *
 * affordability, when given (state + maxAffordablePenalty - the budget this Corporation/player
 * still has left over for a placement penalty on top of whatever build cost has already been
 * committed to), additionally requires a candidate hex's own placement penalty
 * (placementPenaltyForHexForCorporation) to fit that budget. Without it, this only checks
 * adjacency/Outpost Restrictions - correct for Jerry-Rig (which never has a penalty to worry
 * about), but NOT enough on its own for Expand Network/Private Contractor's own "should we even
 * offer this action" checks, which is why every other caller now passes it: a Corporation that's
 * only adjacent to hexes it genuinely can't afford (this hex's base cost, already reflected by
 * the caller before ever reaching here, PLUS its placement penalty) has no real target, even
 * though one exists geometrically.
 */
export function hasAnyValidExpansionTarget(
    board: HydratedBoardState,
    corporationId: CorporationId,
    canBuildOnAlienPlanets = false,
    canBuildOnSunAnomalies = false,
    ignoresDeepSpaceOutpostCap = false,
    affordability?: { state: HydratedStellarVenturesGameState; maxAffordablePenalty: number },
    canBuildOnNebulaAnomaly = false
): boolean {
    for (const hex of Object.values(board.hexes)) {
        if (!hex.outposts.includes(corporationId)) {
            continue
        }
        for (const neighbor of Object.values(board.hexes)) {
            if (
                board.isBuildAdjacent(hex.id, neighbor.id) &&
                board.canBuildOutpost(
                    neighbor.id,
                    corporationId,
                    canBuildOnAlienPlanets,
                    canBuildOnSunAnomalies,
                    ignoresDeepSpaceOutpostCap,
                    canBuildOnNebulaAnomaly
                ) &&
                (!affordability ||
                    placementPenaltyForHexForCorporation(
                        affordability.state,
                        corporationId,
                        neighbor.id
                    ) <= affordability.maxAffordablePenalty)
            ) {
                return true
            }
        }
    }
    return false
}

/**
 * Builds a single Outpost for a Corporation AND decrements its unbuiltOutposts supply (see
 * model/corporation.ts's OutpostSupplyByCorporationId) - every production build call site
 * (Expand Network, Create Wormhole, Private Contractor, Jerry-Rig, Amethyst's Formation Outpost)
 * should call this instead of state.board.buildOutpost directly, so the physical Outpost supply
 * Alien Alchemist draws down (actions/alienAlchemist.ts) is never missed at one site while being
 * tracked at another. Floored at 0 defensively - should never actually go negative, since nothing
 * builds more Outposts for a Corporation than its Charter's build rules already limit.
 */
export function buildOutpostForCorporation(
    state: HydratedStellarVenturesGameState,
    hexId: string,
    corporationId: CorporationId
): void {
    state.board.buildOutpost(hexId, corporationId)
    const corporation = state.getCorporation(corporationId)
    corporation.unbuiltOutposts = Math.max(0, corporation.unbuiltOutposts - 1)
    closeBordersReachedByCorporations(state)
}

// Nebular Explorers needs both the Power active AND at least 1 unused Alien Planet tile left to
// award (state.unusedAlienAgreementTileChevrons) before a Nebular Anomaly hex becomes a legal
// build target - shared here since every one of the 4 build actions' own canBuild.../canOffer...
// methods needs this identical check (mirrors canBuildOnSunAnomalies/IcarusExperiment, just with
// the extra tile-supply condition that Power doesn't need). See board.ts's canBuildOutpost.
export function canBuildOnNebulaAnomalyForCorporation(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId
): boolean {
    return (
        state.getCorporation(corporationId).hasActivePower(CorporatePowerId.NebularExplorers) &&
        state.unusedAlienAgreementTileChevrons.length > 0
    )
}

/**
 * Nebular Explorers (Corporate Power Glossary, page 29): "Any Build, One-Time. May build an
 * Outpost on a Nebular Anomaly hex, placing a random unused Alien Planet tile beneath it and
 * treating it as an Alien Planet from then on (for every Corporation, not just this one) -
 * including being eligible to Sign The Agreement."
 *
 * Per the co-designer, this Power needs no separate "activate" step or dedicated action - a
 * Nebular Anomaly (HexType.Anomaly) hex is simply one more valid target for Expand Network,
 * Private Contractor, Jerry-Rig or Create Wormhole alike, exactly like an Alien Planet hex
 * already is via canBuildOnAlienPlanets (see board.ts's canBuildOutpost
 * canBuildOnNebulaAnomaly parameter / canBuildOnNebulaAnomalyForCorporation above). This
 * function performs the actual one-time conversion - called from each of those 4 actions' own
 * apply(), right before buildOutpostForCorporation, so by the time that runs (and by the time
 * awardAlienExplorersCubes runs after it) the hex already reads as a real Alien Planet for every
 * other purpose this same build: Sign The Agreement eligibility, Secret Agents' own choice, etc.
 *
 * Per the co-designer, placing on the newly-revealed Alien Planet DOES still award an Alien
 * Explorers cube like any other Alien Planet build, if the building Corporation also holds Alien
 * Explorers - each of the 4 build actions' own awardAlienExplorersCubes call (right after this
 * function) already handles that correctly once the hex reads as HexType.AlienPlanet, with no
 * special-casing needed here. Returns true when a conversion actually happened (unused by every
 * current caller, but kept for callers that may want to know).
 *
 * Once a Corporation signs The Agreement, corporation.agreement is fixed forever and
 * meetsSignTheAgreementRequirements (operations/agreement.ts) already refuses any
 * already-signed Corporation outright - so a Nebular Anomaly revealed for one never changes
 * anything about its (locked-in) Agreement, with no special-casing needed here.
 */
export function resolveNebularAnomalyReveal(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    hexId: string
): boolean {
    const hex = state.board.requireHex(hexId)
    if (hex.type !== HexType.Anomaly || !canBuildOnNebulaAnomalyForCorporation(state, corporationId)) {
        return false
    }

    hex.type = HexType.AlienPlanet
    hex.alienAgreementTileHidden = true
    hex.alienAgreementTileChevrons = state.unusedAlienAgreementTileChevrons.shift()
    hex.alienAgreementTileRemoved = false

    const corporation = state.getCorporation(corporationId)
    corporation.powers = corporation.powers.filter(
        (power) => power.id !== CorporatePowerId.NebularExplorers
    )
    return true
}

/**
 * Dismantling Outposts (Corporate Power Glossary, page 29): "Corporation Round, Ongoing. Once
 * per Corporation Round, may return 1 Outpost from a Deep Space hex to the supply, paying ₮1
 * from the Treasury; the removed Outpost may immediately be placed as part of any build action."
 * The inverse of buildOutpostForCorporation: removes the physical Outpost from the board AND
 * restores it to the Corporation's unbuiltOutposts supply (see actions/dismantlingOutposts.ts),
 * so a later build action in the same turn can place it again via the normal
 * buildOutpostForCorporation path.
 */
export function removeOutpostForCorporation(
    state: HydratedStellarVenturesGameState,
    hexId: string,
    corporationId: CorporationId
): void {
    state.board.removeOutpost(hexId, corporationId)
    const corporation = state.getCorporation(corporationId)
    corporation.unbuiltOutposts += 1
}

/**
 * Alien Explorers (Corporate Power Glossary, page 29): "Allows the Corporation to build Outposts
 * on Alien Planets. The player that builds the Outpost gains an Alien Technology from the
 * Supply." Called after Outposts have already been built (via Expand Network, Create Wormhole,
 * Jerry-Rig, or Private Contractor) to award 1 Alien Technology Cube to playerId for each of the
 * given hexIds that is an Alien Planet. A no-op whenever none of the built hexes are Alien
 * Planets - which is always true for a Corporation without Alien Explorers (or an equivalent
 * Power) active, since canBuildOutpost would already have blocked building there.
 *
 * Secret Agents (Amethyst Agency's own alien-planet-building Power - see
 * HydratedCorporationState.canBuildOnAlienPlanets) explicitly grants NO Alien Technology for the
 * build ("may build Outposts on Alien Planets without the players gaining Alien Technology" -
 * Glossary page 29) - only Alien Explorers itself earns the cube, so this checks for that
 * specific Power rather than the more permissive canBuildOnAlienPlanets() every build-permission
 * check uses.
 */
export function awardAlienExplorersCubes(
    state: HydratedStellarVenturesGameState,
    playerId: string,
    corporationId: CorporationId,
    hexIds: string[]
): void {
    if (!state.getCorporation(corporationId).hasActivePower(CorporatePowerId.AlienExplorers)) {
        return
    }
    const alienPlanetCount = hexIds.filter(
        (hexId) => state.board.getHex(hexId)?.type === HexType.AlienPlanet
    ).length
    if (alienPlanetCount > 0) {
        state.getPlayerState(playerId).addAlienTechCubes(alienPlanetCount)
    }
}

/**
 * Ends an in-progress, one-Outpost-at-a-time Expand Network or Private Contractor build
 * (state.expandingCorporationId - see actions/expandNetwork.ts / actions/privateContractor.ts),
 * charging its accumulated cost as a single lump sum based on the running total Outpost count
 * (rulebook pages 12-13's table is per TOTAL Outposts built this action, not per-Outpost), plus
 * the accumulated ₮1-per-other-Corporation placement penalty - both Expand Network and Private
 * Contractor incur it (only Jerry-Rig is exempt, and it never goes through this deferred-cost
 * system at all - a single free Outpost, charged to nobody). A no-op if nothing is currently in
 * progress, so it's always safe to call (e.g. from DeclineExpandNetworkOrWormhole even when
 * nothing was ever built, or from HydratedSignTheAgreement.apply() regardless of whether signing
 * was reached via one of these builds at all).
 */
export function finalizeExpansion(state: HydratedStellarVenturesGameState): void {
    const corporationId = state.expandingCorporationId
    if (!corporationId) {
        return
    }

    const hexIds = state.expandingHexIds ?? []
    const placementPenalty = state.expandingPlacementPenalty ?? 0
    if (state.expandingKind === ActionType.PrivateContractor) {
        const cost = privateContractorCost(hexIds) + placementPenalty
        if (state.expandingBuilderId) {
            // The Outposts this cost covers are already built (irreversibly placed on the
            // board) by this point, so the charge has to go through no matter what - clamp at 0
            // by hand rather than going through PlayerState.spendLiquidFunds, which THROWS if
            // the amount exceeds liquidFunds (correct for a still-choosable action the player
            // could instead not take, but wrong here: on the rare occasion this build gets
            // finalized later than the moment the President actually stopped building - e.g. an
            // Undo, or some other step finalizing a build that was left stale rather than
            // properly declined - other spending in between can leave less on hand than this
            // deferred lump sum, and an uncaught throw here would crash whatever state
            // transition triggered it instead of just zeroing out the shortfall).
            const playerState = state.getPlayerState(state.expandingBuilderId)
            playerState.liquidFunds = Math.max(0, playerState.liquidFunds - cost)
            state.getCorporation(corporationId).addPrivateContractorExpense(state.expandingBuilderId, cost)
        }
    } else {
        const cost = (ExpandNetworkOutpostCosts[hexIds.length] ?? 0) + placementPenalty
        // Same reasoning as above - a Corporation's treasury should never go negative (it
        // isn't allowed to overspend on anything else in this game), so this deferred charge
        // clamps at 0 rather than letting a late finalization (see the Private Contractor
        // branch's comment) drive it below zero.
        const corporation = state.getCorporation(corporationId)
        corporation.treasury = Math.max(0, corporation.treasury - cost)
    }

    state.expandingCorporationId = undefined
    state.expandingBuilderId = undefined
    state.expandingKind = undefined
    state.expandingHexIds = undefined
    state.expandingPlacementPenalty = undefined
}
