import { HydratedAuction } from '@tabletop/common'

/**
 * Reorders turnOrder so it starts at startingPlayerId and proceeds clockwise from there,
 * wrapping around. Used for every "starts with (and proceeds clockwise from) a specific player"
 * rule in this game - e.g. a Share auction's bid order starting with the Corporation's President
 * (Issue Share) or the Director (a Boardroom Battle's forced auction - see
 * operations/shareAuction.ts), and Boardroom Battle's voting order starting with the Director
 * (see operations/boardroomBattle.ts).
 */
export function turnOrderStartingWith(
    turnOrder: readonly string[],
    startingPlayerId: string
): string[] {
    const index = turnOrder.indexOf(startingPlayerId)
    if (index < 0) {
        return [...turnOrder]
    }
    return [...turnOrder.slice(index), ...turnOrder.slice(0, index)]
}

/**
 * Counts how many participants in the given auction have not yet passed.
 * Mirrors games/indonesia's activeAuctionParticipantCount.
 *
 * Shared by every SimpleAuction-based mechanic in Stellar Ventures (the Initial Auction and
 * the Issue Share auction so far).
 */
export function activeAuctionParticipantCount(auction: HydratedAuction<any>): number {
    return auction.participants.filter((participant) => !participant.passed).length
}

/**
 * Finds the next player in bid order, after currentBidderId, who is still an active
 * (non-passed) participant in the auction AND could actually place a legal bid. Returns null
 * when no such player exists (i.e. the auction is effectively over).
 *
 * Mirrors games/indonesia's nextMergerBidderId.
 *
 * Confirmed by the game's co-designer: a player who mathematically cannot cover the next
 * minimum bid (their liquid funds are below auction.highBid + 1) should be skipped over
 * automatically rather than forced to click Pass manually every time it comes back around to
 * them - since the price only ever goes up during a single auction, once they can't afford it
 * they can never afford it again for the rest of this auction, so skipping them is equivalent
 * to (and implemented as) auto-passing them. Pass getLiquidFunds to enable this; omit it (or
 * leave it undefined) to fall back to the old skip-only-the-already-passed behavior. This never
 * affects the opening bidder - the minimum before any highBid exists is $0, which every player
 * can always afford - so it only ever kicks in after the first real bid is placed.
 *
 * The player who currently holds auction.highBid (participant.bid === auction.highBid) is
 * always skipped too, but WITHOUT being auto-passed - they're already winning, and asking them
 * to beat their own leading bid only makes sense again once someone else has actually outbid
 * them (at which point their own participant.bid no longer equals auction.highBid, and this
 * exemption stops applying to them). Before this exemption existed, a wraparound back to the
 * high bidder fell into the affordability check above instead, and a bidder who opened at
 * exactly their own full Liquid Funds could no longer afford minimumBid (highBid + 1) to
 * "re-bid against themselves" - incorrectly auto-passing the auction's own winner and leaving
 * zero non-passed participants for resolveShareAuctionWinner to find.
 */
export function nextAuctionBidderId(
    bidOrder: readonly string[],
    currentBidderId: string,
    auction: HydratedAuction<any>,
    getLiquidFunds?: (playerId: string) => number
): string | null {
    if (bidOrder.length === 0) {
        return null
    }

    const currentIndex = bidOrder.indexOf(currentBidderId)
    if (currentIndex < 0) {
        return null
    }

    const minimumBid = (auction.highBid ?? -1) + 1

    for (let offset = 1; offset <= bidOrder.length; offset += 1) {
        const bidderId = bidOrder[(currentIndex + offset) % bidOrder.length]
        if (!bidderId) {
            continue
        }
        const participant = auction.participants.find((entry) => entry.playerId === bidderId)
        if (!participant || participant.passed) {
            continue
        }
        if (auction.highBid !== undefined && participant.bid === auction.highBid) {
            continue
        }
        if (
            getLiquidFunds &&
            auction.highBid !== undefined &&
            getLiquidFunds(bidderId) < minimumBid
        ) {
            auction.pass(bidderId)
            continue
        }
        return bidderId
    }

    return null
}
