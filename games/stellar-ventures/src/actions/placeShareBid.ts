import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { nextAuctionBidderId } from '../operations/auction.js'

export type PlaceShareBidMetadata = Type.Static<typeof PlaceShareBidMetadata>
export const PlaceShareBidMetadata = Type.Object({
    previousHighBid: Type.Optional(Type.Number()),
    newHighBid: Type.Number()
})

export type PlaceShareBid = Type.Static<typeof PlaceShareBid>
export const PlaceShareBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceShareBid),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceShareBidMetadata),
            amount: Type.Number()
        })
    ])
)

export const PlaceShareBidValidator = Compile(PlaceShareBid)

export function isPlaceShareBid(action?: GameAction): action is PlaceShareBid {
    return action?.type === ActionType.PlaceShareBid
}

export class HydratedPlaceShareBid
    extends HydratableAction<typeof PlaceShareBid>
    implements PlaceShareBid
{
    declare type: ActionType.PlaceShareBid
    declare playerId: string
    declare metadata?: PlaceShareBidMetadata
    declare amount: number

    constructor(data: PlaceShareBid) {
        super(data, PlaceShareBidValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonPlaceShareBidInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const auction = state.activeShareAuction
        const bidOrder = state.shareAuctionBidOrder
        assertExists(auction, 'Share auction should be present while placing a bid')
        assertExists(bidOrder, 'Share auction bid order should be present while placing a bid')

        const previousHighBid = auction.highBid
        auction.placeBid(this.playerId, this.amount)
        auction.highBid = this.amount
        state.shareAuctionCurrentBidderId =
            nextAuctionBidderId(
                bidOrder,
                this.playerId,
                auction,
                (playerId) => state.getPlayerState(playerId).liquidFunds
            ) ?? undefined

        this.metadata = {
            previousHighBid,
            newHighBid: this.amount
        }
    }

    isValidPlaceShareBid(state: HydratedStellarVenturesGameState): boolean {
        return this.reasonPlaceShareBidInvalid(state) === undefined
    }

    reasonPlaceShareBidInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedPlaceShareBid.reasonPlaceShareBidInvalid(state, this.playerId, this.amount)
    }

    static reasonPlaceShareBidInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        amount: number
    ): string | undefined {
        const auction = state.activeShareAuction
        if (!auction) {
            return 'No Share Auction is currently active'
        }

        if (state.shareAuctionCurrentBidderId !== playerId) {
            return 'It is not your turn to bid'
        }

        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) {
            return 'Bid amount must be a non-negative whole number'
        }

        const currentHighBid = auction.highBid ?? -1
        if (amount <= currentHighBid) {
            return 'Bid must be higher than the current high bid'
        }

        const participant = auction.participants.find(
            (candidate) => candidate.playerId === playerId
        )
        if (!participant || participant.passed) {
            return 'You have already passed on this auction'
        }

        const bidderFunds = state.getPlayerState(playerId).liquidFunds
        if (amount > bidderFunds) {
            return 'Insufficient Funds'
        }
        return undefined
    }

    static canPlaceShareBid(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        const auction = state.activeShareAuction
        if (!auction) {
            return false
        }
        if (state.shareAuctionCurrentBidderId !== playerId) {
            return false
        }

        const participant = auction.participants.find(
            (candidate) => candidate.playerId === playerId
        )
        if (!participant || participant.passed) {
            return false
        }

        const minimumBid = (auction.highBid ?? -1) + 1
        const bidderFunds = state.getPlayerState(playerId).liquidFunds
        return minimumBid <= bidderFunds
    }
}
