import { HydratedBoardState, HexType } from '../model/board.js'
import { CorporationId, CorporatePowerId, HydratedCorporationState } from '../model/corporation.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

/**
 * The Agreement track (rulebook pages 22-23), printed in 4 sections keyed by how many Alien
 * Planets the signing Corporation has Outposts on (including the one that triggered signing) at
 * the moment of signing - 2, 3, 4 or 5+. Confirmed against both worked examples in the
 * rulebook: Pink Inc. signing at 3 Planets pays a 9-per-share Bonus Dividend (page 23's
 * example), and a Corporation that had signed at 3 Planets later shows a 6-per-share Agreement
 * Bonus during Liquidation (page 21's Frost Federated example).
 */
export const AgreementTrackMaxPlanets = 5

export type AgreementTrackEntry = {
    bonusDividendPerShare: number
    agreementBonusPerShare: number
}

export const AgreementTrackByPlanetCount: Record<number, AgreementTrackEntry> = {
    2: { bonusDividendPerShare: 6, agreementBonusPerShare: 3 },
    3: { bonusDividendPerShare: 9, agreementBonusPerShare: 6 },
    4: { bonusDividendPerShare: 11, agreementBonusPerShare: 9 },
    5: { bonusDividendPerShare: 12, agreementBonusPerShare: 15 } // "5+ Planets"
}

// Looks up the Agreement track entry for a given Alien Planet Outpost count, clamping to the
// printed range (a count below 2 is meaningless here - signing itself requires 2+ - and 5+ all
// share the same top section).
export function agreementTrackEntryForPlanetCount(planetCount: number): AgreementTrackEntry {
    const clamped = Math.min(Math.max(planetCount, 2), AgreementTrackMaxPlanets)
    return AgreementTrackByPlanetCount[clamped]!
}

// The number of Alien Planet hexes this Corporation currently has an Outpost on - the figure
// used both for the Sign The Agreement requirement ("Outposts on 2+ Alien Planets") and for
// placing the Agreement Token ("based on the number of Alien Planets with this Corporation's
// Outposts, including this one").
export function alienPlanetOutpostCount(
    board: HydratedBoardState,
    corporationId: CorporationId
): number {
    return Object.values(board.hexes).filter(
        (hex) => hex.type === HexType.AlienPlanet && hex.outposts.includes(corporationId)
    ).length
}

// True if hexId is an Alien Planet this Corporation could reveal a tile at right now - it has
// an Outpost there and the tile hasn't already been flipped.
export function hasHiddenAlienAgreementTile(board: HydratedBoardState, hexId: string): boolean {
    const hex = board.getHex(hexId)
    return hex?.type === HexType.AlienPlanet && hex.alienAgreementTileHidden === true
}

/**
 * Sign The Agreement requirements (rulebook page 22), aside from timing (see
 * isEligibleToSignTheAgreement below) and "all build costs are paid before signing" (guaranteed
 * once signing itself finalizes the in-progress build - see actions/signTheAgreement.ts):
 *   - Corporation has Outposts on 2+ Alien Planets
 *   - Corporation has 1+ Share(s) available on Charter
 *   - 'Alien Explorers' Corporate Power is Active
 * A Corporation can never sign more than once (rulebook page 25) - corporation.agreement being
 * set is how this implementation remembers that.
 */
export function meetsSignTheAgreementRequirements(
    board: HydratedBoardState,
    corporation: HydratedCorporationState
): boolean {
    if (corporation.agreement !== undefined) {
        return false
    }
    if (!corporation.hasActivePower(CorporatePowerId.AlienExplorers)) {
        return false
    }
    if (corporation.availableShareCount < 1) {
        return false
    }
    return alienPlanetOutpostCount(board, corporation.id) >= 2
}

/**
 * Whether the Corporation's President could choose to Sign The Agreement right now at the hex
 * that was just built on - i.e. it's an Alien Planet with a still-hidden tile, built in THIS
 * single-Outpost build action. Per the rulebook, "Immediately after building on an Alien Planet
 * with a face-down Alien Agreement Tile, the Corporation President may choose to sign the
 * Agreement there" - so builds from earlier actions never re-offer this, only the hex from the
 * build action that just ran. Since Outposts are now placed one at a time (see
 * actions/expandNetwork.ts, actions/privateContractor.ts), this is checked once per build rather
 * than across a whole batch. Returns false unless the Corporation also meets every other
 * requirement above.
 */
export function isEligibleToSignTheAgreement(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    builtHexId: string
): boolean {
    if (!hasHiddenAlienAgreementTile(state.board, builtHexId)) {
        return false
    }
    return meetsSignTheAgreementRequirements(state.board, state.getCorporation(corporationId))
}

// Secret Agents (Amethyst Agency's own Formation Power - Glossary page 29): "may build Outposts
// on Alien Planets without the players gaining Alien Technology; after building on one with a
// still-hidden tile, the President chooses to either increase Amethyst's own Mining Capacity +3
// or increase the Alien Corporation's Mining Capacity by the tile's chevrons, discarding the tile
// either way (or, if the Alien Planet has no tile, may only choose the +3)." Unlike Sign The
// Agreement, this has no other requirements (no minimum Alien Planet count, no Share
// availability) - it's simply "did a Secret Agents build just land on an Alien Planet at all,
// tile hidden or not". Whether that hex still has a hidden tile to choose between (vs. already
// used up, where the only legal choice is auto-resolved instead) is checked separately by the
// caller via hasHiddenAlienAgreementTile - see stateHandlers/offerSecretAgentsChoice.ts's callers.
export function isEligibleForSecretAgentsChoice(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    builtHexId: string
): boolean {
    const hex = state.board.getHex(builtHexId)
    if (hex?.type !== HexType.AlienPlanet) {
        return false
    }
    return state.getCorporation(corporationId).hasActivePower(CorporatePowerId.SecretAgents)
}

// The Mining Capacity gain from choosing "Increase Amethyst" (Secret Agents' own +3, distinct
// from "Increase Alien"'s +3-per-chevron - actions/signTheAgreement.ts's identical constant is
// kept separate since the two aren't the same rule, even though they share a value).
export const SECRET_AGENTS_MINING_CAPACITY_BONUS = 3

// Resolves "Increase Amethyst": permanently increases the Corporation's own Mining Capacity by
// SECRET_AGENTS_MINING_CAPACITY_BONUS (see model/corporation.ts's
// secretAgentsMiningCapacityBonus / operations/corporatePowers.ts's
// effectiveMiningCapacityForCorporation) and discards the Alien Planet's tile - whether or not it
// was still hidden (a hex with no tile left has nothing further to discard, so this is a no-op
// on alienAgreementTileRemoved in that case). Used both by actions/increaseAmethystMiningCapacity.ts
// (the President's explicit choice) and by the auto-resolve path for a hex whose tile is already
// used up, where "Increase Amethyst" is the only legal option and no choice needs to be offered.
export function awardSecretAgentsMiningCapacityBonus(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    hexId: string
): void {
    const hex = state.board.requireHex(hexId)
    hex.alienAgreementTileRemoved = true
    const corporation = state.getCorporation(corporationId)
    corporation.secretAgentsMiningCapacityBonus =
        (corporation.secretAgentsMiningCapacityBonus ?? 0) + SECRET_AGENTS_MINING_CAPACITY_BONUS
}
