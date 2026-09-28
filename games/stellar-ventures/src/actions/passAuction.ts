import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { nextAuctionBidderId } from '../operations/auction.js'

export type PassAuction = Type.Static<typeof PassAuction>
export const PassAuction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassAuction),
            playerId: Type.String()
        })
    ])
)

export const PassAuctionValidator = Compile(PassAuction)

export function isPassAuction(action?: GameAction): action is PassAuction {
    return action?.type === ActionType.PassAuction
}

/**
 * The player whose turn it is to bid may pass, EXCEPT for the player who opened this auction
 * (the first bidder in bid order): they must place an opening bid - $0 is allowed - before
 * anyone (including themselves, later) is allowed to pass. This guarantees the auction always
 * has a winner: if everyone else passes, it goes to the opening bidder at whatever they opened
 * with (possibly $0).
 */
export class HydratedPassAuction
    extends HydratableAction<typeof PassAuction>
    implements PassAuction
{
    declare type: ActionType.PassAuction
    declare playerId: string

    constructor(data: PassAuction) {
        super(data, PassAuctionValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonPassAuctionInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const auction = state.activeInitialAuction
        const bidOrder = state.initialAuctionBidOrder
        assertExists(auction, 'Initial auction should be present while passing on a bid')
        assertExists(bidOrder, 'Initial auction bid order should be present while passing on a bid')

        auction.pass(this.playerId)
        state.initialAuctionCurrentBidderId =
            nextAuctionBidderId(
                bidOrder,
                this.playerId,
                auction,
                (playerId) => state.getPlayerState(playerId).liquidFunds
            ) ?? undefined
    }

    isValidPassAuction(state: HydratedStellarVenturesGameState): boolean {
        return this.reasonPassAuctionInvalid(state) === undefined
    }

    reasonPassAuctionInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedPassAuction.reasonPassAuctionInvalid(state, this.playerId)
    }

    static canPassAuction(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedPassAuction.reasonPassAuctionInvalid(state, playerId) === undefined
    }

    static reasonPassAuctionInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const auction = state.activeInitialAuction
        const bidOrder = state.initialAuctionBidOrder
        if (!auction || !bidOrder) {
            return 'No Initial Auction is currently active'
        }

        if (state.initialAuctionCurrentBidderId !== playerId) {
            return 'It is not your turn to bid'
        }

        const participant = auction.participants.find(
            (candidate) => candidate.playerId === playerId
        )
        if (!participant || participant.passed) {
            return 'You have already passed on this auction'
        }

        // The opening bidder must place an opening bid (even $0) before passing is allowed.
        if (bidOrder[0] === playerId && auction.highBid === undefined) {
            return 'You opened this auction and must place a bid before you can pass'
        }

        return undefined
    }
}
