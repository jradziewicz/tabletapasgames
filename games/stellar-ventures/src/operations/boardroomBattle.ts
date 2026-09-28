import { CorporationId } from '../model/corporation.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

/**
 * Whether a player has any Boardroom Votes left to place at all - a player who's already spent
 * every Vote they had (whether in an earlier Boardroom Battle or a Black Market trade-in -
 * actions/blackMarket.ts) has nothing to place and nothing to decide, so their "turn" in the
 * voting order is skipped entirely rather than stopping on them just to make them click Pass.
 */
function playerHasBoardroomVotesLeft(
    state: HydratedStellarVenturesGameState,
    playerId: string
): boolean {
    return state.getPlayerState(playerId).boardroomVotes > 0
}

/**
 * The next player in Boardroom Battle's voting order after currentVoterId who actually has a
 * Boardroom Vote left to place - a single pass through every player once (unlike a bidding
 * auction, nobody gets a second turn), starting with (and proceeding clockwise from) the
 * Director, skipping over anyone with zero Votes left (see playerHasBoardroomVotesLeft) since
 * they have nothing to place either way. Returns undefined once nobody after currentVoterId in
 * the order has a Vote left, signaling that voting is complete.
 */
export function nextBoardroomVoterId(
    state: HydratedStellarVenturesGameState,
    voteOrder: readonly string[],
    currentVoterId: string
): string | undefined {
    const index = voteOrder.indexOf(currentVoterId)
    for (let i = index + 1; i < voteOrder.length; i++) {
        if (playerHasBoardroomVotesLeft(state, voteOrder[i]!)) {
            return voteOrder[i]
        }
    }
    return undefined
}

/**
 * The player voting FIRST in a brand new Boardroom Battle - the Director, unless they (or
 * whoever's next in line) have no Boardroom Votes left, in which case the same skip
 * nextBoardroomVoterId applies mid-Battle also applies to picking the very first voter.
 *
 * Falls back to the Director (voteOrder[0]) in the one case where skipping ahead would otherwise
 * leave nobody at all - every single player in the game already at 0 Boardroom Votes. That's a
 * real, if rare, state late in a long game (Votes only ever get spent, via Boardroom Battle
 * itself or Black Market - actions/blackMarket.ts - never replenished), and this function's only
 * caller (stateHandlers/boardroomBattle.ts's enter(), setting up state fresh with no action yet
 * pending) has no player action to process afterward - unlike nextBoardroomVoterId below, which
 * only ever runs from inside onAction and can safely hand back undefined to mean "voting's
 * already complete," returning undefined here would leave activePlayerIds empty with no action
 * in flight to ever move the game on. Falling back to the Director preserves the exact
 * pre-existing behavior for that one pathological case (one harmless Decline click, same as
 * always) while every other case - anything short of literally everyone being at 0 - now
 * correctly skips straight to whoever actually has a Vote to place.
 */
export function firstBoardroomVoterId(
    state: HydratedStellarVenturesGameState,
    voteOrder: readonly string[]
): string | undefined {
    return voteOrder.find((playerId) => playerHasBoardroomVotesLeft(state, playerId)) ?? voteOrder[0]
}

/**
 * A Corporation is only a valid Boardroom Battle target - for a Vote, a tie-break choice, or the
 * forced auction itself - if it's active (Amethyst Agency, before it's formed in Era 3, never
 * appears here - see initializer.ts / model/corporation.ts's `active` flag) AND has at least one
 * Share left to issue: "there must be a Share to issue for a Corporation to be a valid target in
 * the Boardroom Battle" (confirmed by the game's co-designer). Fine Print (Corporate Power
 * Glossary, page 29) excludes a further Corporation entirely for this specific Battle -
 * state.finePrintExemptCorporationId, set by discarding it before this Battle began (see
 * actions/finePrint.ts) - "no Votes being placed on this Corporation (and it can't be forced to
 * Issue a Share)".
 */
export function eligibleBoardroomBattleCorporationIds(
    state: HydratedStellarVenturesGameState
): CorporationId[] {
    return state.corporations
        .filter(
            (corporation) =>
                corporation.active &&
                corporation.availableShareCount > 0 &&
                corporation.id !== state.finePrintExemptCorporationId
        )
        .map((corporation) => corporation.id)
}

/**
 * Tallies the Boardroom Votes placed so far this Boardroom Battle (state.boardroomBattleVotes)
 * by Corporation. Every eligible Corporation is included, even at 0 Votes (see
 * eligibleBoardroomBattleCorporationIds above) - an ineligible Corporation (no Shares left to
 * issue) can never receive a Vote in the first place, so it never appears here either.
 */
export function tallyBoardroomVotes(
    state: HydratedStellarVenturesGameState
): Map<CorporationId, number> {
    const totals = new Map<CorporationId, number>()
    for (const corporationId of eligibleBoardroomBattleCorporationIds(state)) {
        totals.set(corporationId, 0)
    }
    for (const vote of state.boardroomBattleVotes ?? []) {
        // Defense in depth: a Vote should never exist for a Corporation that isn't currently
        // eligible (canPlaceBoardroomVote already checks eligibility before a Vote can be
        // placed), but skip it here too rather than letting it silently become a phantom
        // candidate in corporationsWithMostVotes below.
        if (!totals.has(vote.corporationId)) {
            continue
        }
        totals.set(vote.corporationId, (totals.get(vote.corporationId) ?? 0) + vote.amount)
    }
    return totals
}

/**
 * The Corporation(s) tied for the most Votes among eligible Corporations (see
 * eligibleBoardroomBattleCorporationIds above). Per the rulebook ("Director chooses in case of a
 * tie, including 0 Votes"), this can include every eligible Corporation tied at 0 if nobody
 * placed any Votes at all. A single-entry result means no tie-break is needed - that Corporation
 * is simply the winner. An empty result means no Corporation is currently eligible at all (none
 * has a Share left to issue) - see BoardroomBattleStateHandler.resolveVotingIfComplete.
 */
export function corporationsWithMostVotes(state: HydratedStellarVenturesGameState): CorporationId[] {
    const totals = tallyBoardroomVotes(state)
    let highest = -Infinity
    for (const total of totals.values()) {
        if (total > highest) {
            highest = total
        }
    }
    return [...totals.entries()]
        .filter(([, total]) => total === highest)
        .map(([corporationId]) => corporationId)
}

/**
 * Resolves the fate of every Vote placed this Boardroom Battle once the winning Corporation is
 * known (rulebook page 18): Votes placed on the winner are removed from the game for good -
 * they've already been deducted from the voter's pool by HydratedPlaceBoardroomVote, so there's
 * nothing further to do for those. Votes placed on any other Corporation are returned to their
 * owner's pool, to use in a future Boardroom Battle.
 */
export function resolveBoardroomVotes(
    state: HydratedStellarVenturesGameState,
    winningCorporationId: CorporationId
): void {
    for (const vote of state.boardroomBattleVotes ?? []) {
        if (vote.corporationId !== winningCorporationId) {
            state.getPlayerState(vote.playerId).addBoardroomVotes(vote.amount)
        }
    }
    state.boardroomBattleVotes = []
}

/**
 * Clears Fine Print's per-Battle bookkeeping (state.finePrintExemptCorporationId,
 * state.finePrintOfferResolved) once a Boardroom Battle fully resolves - a fresh Battle always
 * starts unexempted and re-offers Fine Print from scratch if its holder still has it. Called from
 * BoardroomBattleStateHandler at both of its exit points (no eligible Corporation at all; the
 * forced auction's winner resolved).
 */
export function resetFinePrintForNextBoardroomBattle(state: HydratedStellarVenturesGameState): void {
    state.finePrintExemptCorporationId = undefined
    state.finePrintOfferResolved = undefined
}
