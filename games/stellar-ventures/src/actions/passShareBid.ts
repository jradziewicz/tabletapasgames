import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { nextAuctionBidderId } from '../operations/auction.js'

export type PassShareBid = Type.Static<typeof PassShareBid>
export const PassShareBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassShareBid),
            playerId: Type.String()
        })
    ])
)

export const PassShareBidValidator = Compile(PassShareBid)

export function isPassShareBid(action?: GameAction): action is PassShareBid {
    return action?.type === ActionType.PassShareBid
}

/**
 * Mirrors PassAuction (Setup's Initial Auction): the President who opened this auction (the
 * first bidder in bid order) must place an opening bid - $0 is allowed - before anyone
 * (including themselves, later) is allowed to pass. This guarantees the auction always has a
 * winner: if everyone else passes, the share goes to the President at whatever they opened
 * with (possibly $0).
 */
export class HydratedPassShareBid
    extends HydratableAction<typeof PassShareBid>
    implements PassShareBid
{
    declare type: ActionType.PassShareBid
    declare playerId: string

    constructor(data: PassShareBid) {
        super(data, PassShareBidValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonPassShareBidInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const auction = state.activeShareAuction
        const bidOrder = state.shareAuctionBidOrder
        assertExists(auction, 'Share auction should be present while passing on a bid')
        assertExists(bidOrder, 'Share auction bid order should be present while passing on a bid')

        auction.pass(this.playerId)
        state.shareAuctionCurrentBidderId =
            nextAuctionBidderId(
                bidOrder,
                this.playerId,
                auction,
                (playerId) => state.getPlayerState(playerId).liquidFunds
            ) ?? undefined
    }

    isValidPassShareBid(state: HydratedStellarVenturesGameState): boolean {
        return this.reasonPassShareBidInvalid(state) === undefined
    }

    reasonPassShareBidInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedPassShareBid.reasonPassShareBidInvalid(state, this.playerId)
    }

    static canPassShareBid(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedPassShareBid.reasonPassShareBidInvalid(state, playerId) === undefined
    }

    static reasonPassShareBidInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const auction = state.activeShareAuction
        const bidOrder = state.shareAuctionBidOrder
        if (!auction || !bidOrder) {
            return 'No Share Auction is currently active'
        }

        if (state.shareAuctionCurrentBidderId !== playerId) {
            return 'It is not your turn to bid'
        }

        const participant = auction.participants.find(
            (candidate) => candidate.playerId === playerId
        )
        if (!participant || participant.passed) {
            return 'You have already passed on this auction'
        }

        // The President must place an opening bid (even $0) before passing is allowed.
        if (bidOrder[0] === playerId && auction.highBid === undefined) {
            return 'You opened this auction and must place a bid before you can pass'
        }

        return undefined
    }
}
