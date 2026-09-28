import { GameResult } from '@tabletop/common'
import { CorporatePowerId, HydratedCorporationState } from '../model/corporation.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { agreementTrackEntryForPlanetCount } from './agreement.js'
import { effectiveMiningCapacityForCorporation } from './corporatePowers.js'

/**
 * Hostile Takeover (rulebook page 21): a Corporation that signed The Agreement, whose Mining
 * Capacity is now less than or equal to the Alien Corporation's, has its Shares "flip... to Alien
 * Shares." Confirmed against the game's co-designer: this describes how the physical board marks
 * it, not a literal reassignment away from whoever holds each Share - the Key Concepts summary
 * (page 8) states the actual outcome plainly: "its Shares are worth only 1." So every Share of
 * such a Corporation (however it's currently owned) simply pays out at the flat Alien Share rate
 * during Share Liquidation (see shareValuePerShare) instead of via the normal Corporate Share
 * Value formula. A Corporation that never signed can never trigger this - "Corporations that
 * signed" scopes the check to corporation.agreement being set. Takes miningCapacity as a plain
 * number (rather than a board + corporation id) purely so the formula functions below stay easy
 * to unit test in isolation, matching operations/dividends.ts's dividendPayoutPerShare - callers
 * (see liquidateShares) look it up via board.miningCapacityForCorporation.
 */
export function hostileTakeoverApplies(
    miningCapacity: number,
    corporation: HydratedCorporationState,
    alienMiningCapacity: number
): boolean {
    if (corporation.agreement === undefined) {
        return false
    }
    return miningCapacity <= alienMiningCapacity
}

// Rulebook page 21: "Alien Shares = ₮1 each" - both for Shares genuinely held by the Alien
// Shareholdings in a Corporation that avoided Hostile Takeover, and for every Share (including
// player-held ones) of a Corporation that didn't - see hostileTakeoverApplies.
export const AlienShareValue = 1

// Rulebook page 21: "- ₮3 per Loan."
export const LoanPenaltyPerShare = 3

/**
 * Corporate Share Value (rulebook page 21), for a Corporation that avoided Hostile Takeover:
 *   (Mining Capacity + CARGO) / Shares Issued, rounded up
 *   + Agreement Bonus (₮3-₮15, only if signed - see operations/agreement.ts's
 *     AgreementTrackByPlanetCount, keyed by the Alien Planet Outpost count at the moment of
 *     signing, same figure the Bonus Dividend was already paid from)
 *   - ₮3 per Loan
 * Floored at ₮0 - confirmed against the game's co-designer: a heavily-indebted Corporation's
 * Shares are simply worthless, Liquidation should never actually cost a player Credits. Matches
 * the rulebook's worked example exactly: Frost Federated at Cargo 13, Mining Capacity 40, 4
 * Shares Issued -> ceil(53/4) = 14, +6 (signed at 3 Planets), -3 (1 Loan) = ₮17/share.
 */
export function corporateShareValuePerShare(
    miningCapacity: number,
    corporation: HydratedCorporationState
): number {
    const sharesIssued = corporation.issuedShareCount
    if (sharesIssued === 0) {
        return 0
    }

    const baseValue = Math.ceil((miningCapacity + corporation.cargo) / sharesIssued)
    const agreementBonus = corporation.agreement
        ? agreementTrackEntryForPlanetCount(corporation.agreement.planetCountAtSigning)
              .agreementBonusPerShare
        : 0
    const loanPenalty = corporation.loanCount * LoanPenaltyPerShare

    return Math.max(0, baseValue + agreementBonus - loanPenalty)
}

// Accounting Gimmick (Glossary, page 29): "Liquidation. During Hostile Takeover, appears to have
// +5 Mining Capacity (doesn't move the token, and doesn't change the actual value used for Share
// Value calculation)." Confirmed against the game's co-designer: the +5 applies ONLY to the
// Hostile Takeover comparison below - corporateShareValuePerShare always keeps using the
// unmodified value, even for a Corporation whose +5 was what let it avoid Hostile Takeover in the
// first place. No player decision or discard involved (Ongoing, automatic) - purely a formula
// change, applied here rather than in hostileTakeoverApplies/corporateShareValuePerShare
// themselves so those stay simple pure functions of a single plain miningCapacity number.
export const AccountingGimmickTakeoverBonus = 5

// What a single Share of this Corporation actually pays out during Share Liquidation, to
// whoever currently holds it - the Corporate Share Value formula above, unless Hostile Takeover
// flattens every Share to the same ₮1 an Alien Share is worth.
export function shareValuePerShare(
    miningCapacity: number,
    corporation: HydratedCorporationState,
    alienMiningCapacity: number
): number {
    const takeoverMiningCapacity = corporation.hasActivePower(CorporatePowerId.AccountingGimmick)
        ? miningCapacity + AccountingGimmickTakeoverBonus
        : miningCapacity
    if (hostileTakeoverApplies(takeoverMiningCapacity, corporation, alienMiningCapacity)) {
        return AlienShareValue
    }
    return corporateShareValuePerShare(miningCapacity, corporation)
}

/**
 * Share Liquidation (rulebook page 21, step 3): "All players trade in Shares for Credits." Pays
 * every player-held Share, across every active Corporation, straight into that player's Liquid
 * Funds. Alien-held Shares aren't paid to anyone - there's no player to receive them, whether
 * they were issued to the Aliens by an earlier Sign The Agreement or flipped there by this
 * Corporation's own Hostile Takeover.
 */
export function liquidateShares(state: HydratedStellarVenturesGameState): void {
    const alienMiningCapacity = state.alienCorporation.miningCapacity

    for (const corporation of state.corporations) {
        if (!corporation.active) {
            continue
        }

        const miningCapacity = effectiveMiningCapacityForCorporation(state, corporation.id)
        const perShare = shareValuePerShare(miningCapacity, corporation, alienMiningCapacity)
        if (perShare <= 0) {
            continue
        }

        for (const share of corporation.shares) {
            if (share.owner?.type === 'player') {
                state.getPlayerState(share.owner.playerId).addLiquidFunds(perShare)
            }
        }
    }
}

// A player's final Credit total (rulebook page 21's Determine Winner step: "most Credits (incl.
// Liquid + Frozen Funds)"). Counts Frozen Funds directly rather than requiring they be Released
// first - Era 5 has no Investor Round to do that in, so whatever's still Frozen at game end
// (e.g. from a Bonus Dividend paid during Era 5's own Corporation Round) still counts in full.
export function totalCredits(state: HydratedStellarVenturesGameState, playerId: string): number {
    const player = state.getPlayerState(playerId)
    return player.liquidFunds + player.frozenFunds
}

/**
 * Determine Winner (rulebook page 21, step 4). Tiebreak chain:
 *   1. Most Credits (Liquid + Frozen Funds combined, including this Era's Share Liquidation
 *      proceeds - see liquidateShares, which must run before this).
 *   2. Among players still tied, whoever presides over the highest-Mining-Capacity Corporation.
 *   3. The rulebook's last resort - "whoever gets to Outer Space next" - is a physical race with
 *      no digital equivalent. Confirmed with the game's co-designer: if step 2 doesn't produce a
 *      single winner either (none of the tied players presides over any Corporation, or two tied
 *      players preside over Corporations that are themselves tied for highest Mining Capacity),
 *      the game simply ends in a Draw between whoever is still tied, rather than inventing an
 *      arbitrary further tiebreak.
 */
export function determineWinners(state: HydratedStellarVenturesGameState): {
    result: GameResult
    winningPlayerIds: string[]
} {
    const creditsByPlayerId = new Map(
        state.players.map((player) => [player.playerId, totalCredits(state, player.playerId)])
    )
    const highestCredits = Math.max(...creditsByPlayerId.values())
    const tied = state.players
        .filter((player) => creditsByPlayerId.get(player.playerId) === highestCredits)
        .map((player) => player.playerId)

    if (tied.length === 1) {
        return { result: GameResult.Win, winningPlayerIds: tied }
    }

    const activeCorporations = state.corporations.filter((corporation) => corporation.active)
    let highestMiningCapacity = -Infinity
    let presidentIdsAtHighest = new Set<string>()
    for (const corporation of activeCorporations) {
        const presidentId = corporation.getPresidentPlayerId()
        if (!presidentId || !tied.includes(presidentId)) {
            continue
        }
        const miningCapacity = effectiveMiningCapacityForCorporation(state, corporation.id)
        if (miningCapacity > highestMiningCapacity) {
            highestMiningCapacity = miningCapacity
            presidentIdsAtHighest = new Set([presidentId])
        } else if (miningCapacity === highestMiningCapacity) {
            presidentIdsAtHighest.add(presidentId)
        }
    }

    if (presidentIdsAtHighest.size === 1) {
        return { result: GameResult.Win, winningPlayerIds: [...presidentIdsAtHighest] }
    }

    return { result: GameResult.Draw, winningPlayerIds: tied }
}
