import { assertExists, AuctionType, HydratedSimpleAuction } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { CorporationId } from '../model/corporation.js'
import { turnOrderStartingWith } from './auction.js'

/**
 * Opens a Share auction (state.activeShareAuction / shareAuctionBidOrder /
 * shareAuctionCurrentBidderId) with bidding starting at, and proceeding clockwise from,
 * openingBidderId. Shared by every place this game issues a Share via auction: the Corporation
 * Round's own Issue Share step (opening bidder: the Corporation's President - see
 * actions/issueShare.ts) and a Boardroom Battle's forced auction (opening bidder: the Director -
 * see stateHandlers/boardroomBattle.ts). Both reuse the same PlaceShareBid/PassShareBid actions,
 * which require this opening bidder to bid (even $0) before anyone may pass - see
 * actions/passShareBid.ts.
 */
export function startShareAuction(
    state: HydratedStellarVenturesGameState,
    auctionIdPrefix: string,
    openingBidderId: string
): void {
    const bidOrder = turnOrderStartingWith(state.turnManager.turnOrder, openingBidderId)

    state.activeShareAuction = new HydratedSimpleAuction({
        id: `${auctionIdPrefix}-${state.actionCount}`,
        type: AuctionType.Simple,
        participants: bidOrder.map((playerId) => ({
            playerId,
            passed: false
        }))
    })
    state.shareAuctionBidOrder = bidOrder
    state.shareAuctionCurrentBidderId = bidOrder[0]
}

/**
 * Resolves a completed Share auction (state.activeShareAuction) once only one participant
 * remains un-passed: that participant is the winner, who pays their bid into the given
 * Corporation's treasury and receives its next available Share. Clears the auction fields
 * afterward. Shared by the Corporation Round's own Issue Share step and a Boardroom Battle's
 * forced auction (see startShareAuction above).
 */
export function resolveShareAuctionWinner(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId
): void {
    const auction = state.activeShareAuction
    assertExists(auction, 'Share auction should be present while resolving it')

    // The opening bidder is never allowed to pass before placing an opening bid (see
    // HydratedPassShareBid), so by this point someone has always bid - auction.highBid is
    // guaranteed, and so is a winner.
    const winner = auction.participants.find((participant) => !participant.passed)
    assertExists(winner, 'Share auction winner should be present while resolving it')
    assertExists(auction.highBid, 'Share auction should have a bid before it can resolve')

    const corporation = state.getCorporation(corporationId)
    corporation.issueShareToPlayer(winner.playerId, state.actionCount, auction.highBid)
    corporation.treasury += auction.highBid
    state.getPlayerState(winner.playerId).spendLiquidFunds(auction.highBid)

    state.activeShareAuction = undefined
    state.shareAuctionBidOrder = undefined
    state.shareAuctionCurrentBidderId = undefined
    state.activePlayerIds = []
}
