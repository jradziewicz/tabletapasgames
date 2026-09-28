import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { nextAuctionBidderId } from '../operations/auction.js'

export type PlaceBidMetadata = Type.Static<typeof PlaceBidMetadata>
export const PlaceBidMetadata = Type.Object({
    previousHighBid: Type.Optional(Type.Number()),
    newHighBid: Type.Number()
})

export type PlaceBid = Type.Static<typeof PlaceBid>
export const PlaceBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBid),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceBidMetadata),
            amount: Type.Number()
        })
    ])
)

export const PlaceBidValidator = Compile(PlaceBid)

export function isPlaceBid(action?: GameAction): action is PlaceBid {
    return action?.type === ActionType.PlaceBid
}

export class HydratedPlaceBid extends HydratableAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare playerId: string
    declare metadata?: PlaceBidMetadata
    declare amount: number

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonPlaceBidInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const auction = state.activeInitialAuction
        const bidOrder = state.initialAuctionBidOrder
        assertExists(auction, 'Initial auction should be present while placing a bid')
        assertExists(bidOrder, 'Initial auction bid order should be present while placing a bid')

        const previousHighBid = auction.highBid
        auction.placeBid(this.playerId, this.amount)
        auction.highBid = this.amount
        state.initialAuctionCurrentBidderId =
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

    isValidPlaceBid(state: HydratedStellarVenturesGameState): boolean {
        return this.reasonPlaceBidInvalid(state) === undefined
    }

    reasonPlaceBidInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedPlaceBid.reasonPlaceBidInvalid(state, this.playerId, this.amount)
    }

    static reasonPlaceBidInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        amount: number
    ): string | undefined {
        const auction = state.activeInitialAuction
        if (!auction) {
            return 'No Initial Auction is currently active'
        }

        if (state.initialAuctionCurrentBidderId !== playerId) {
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

    static canPlaceBid(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        const auction = state.activeInitialAuction
        if (!auction) {
            return false
        }
        if (state.initialAuctionCurrentBidderId !== playerId) {
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
