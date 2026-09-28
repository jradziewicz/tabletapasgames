import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    HydratedSimpleAuction,
    AuctionType,
    assertExists
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedPassAuction, isPassAuction } from '../actions/passAuction.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { activeAuctionParticipantCount, turnOrderStartingWith } from '../operations/auction.js'

type InitialAuctionAction = HydratedPlaceBid | HydratedPassAuction

/**
 * Runs Setup's Initial Auction: each of the five starting Corporations is auctioned off,
 * one at a time, to determine its first President. Only the very first Corporation's auction
 * bids in reverse turn order (last player in turn order bids first); every subsequent auction
 * instead starts with (and proceeds clockwise from) whoever won the immediately preceding
 * auction, per the game's co-designer.
 *
 * The first bidder in that order must place an opening bid (see PassAuction - $0 is allowed)
 * before anyone can pass, so the auction always has a winner. The winner is issued that
 * Corporation's first share and becomes its President, paying their winning bid from their
 * liquid funds into the Corporation's treasury, then (rulebook page 11, step 4) drafts a second
 * Corporate Power from the visible row before the next Corporation goes up for auction (or
 * before Corporation Round begins, for the 5th and final one) - see actions/draftPower.ts and
 * stateHandlers/draftPower.ts.
 */
export class InitialAuctionStateHandler
    implements MachineStateHandler<InitialAuctionAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is InitialAuctionAction {
        return isPlaceBid(action) || isPassAuction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []

        if (state.initialAuctionCurrentBidderId !== playerId) {
            return validActions
        }

        if (HydratedPlaceBid.canPlaceBid(state, playerId)) {
            validActions.push(ActionType.PlaceBid)
        }
        if (HydratedPassAuction.canPassAuction(state, playerId)) {
            validActions.push(ActionType.PassAuction)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState

        if (!state.activeInitialAuction) {
            const nextCorporationId = state.initialAuctionQueue.shift()
            if (!nextCorporationId) {
                // Nothing left to auction. The onAction handler should have already
                // transitioned away from InitialAuction in this case.
                state.activePlayerIds = []
                return
            }

            // Only the first auction bids in reverse turn order; every later auction starts
            // with (and proceeds clockwise from) the previous auction's winner instead.
            const bidOrder = state.previousInitialAuctionWinnerId
                ? turnOrderStartingWith(
                      state.turnManager.turnOrder,
                      state.previousInitialAuctionWinnerId
                  )
                : [...state.turnManager.turnOrder].reverse()

            state.activeInitialAuctionCorporationId = nextCorporationId
            state.activeInitialAuction = new HydratedSimpleAuction({
                id: `initial-auction-${nextCorporationId}`,
                type: AuctionType.Simple,
                participants: bidOrder.map((playerId) => ({
                    playerId,
                    passed: false
                }))
            })
            state.initialAuctionBidOrder = bidOrder
            state.initialAuctionCurrentBidderId = bidOrder[0]
        }

        state.activePlayerIds = state.initialAuctionCurrentBidderId
            ? [state.initialAuctionCurrentBidderId]
            : []
    }

    onAction(
        action: InitialAuctionAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        switch (true) {
            case isPlaceBid(action):
            case isPassAuction(action): {
                return this.resolveAuctionIfComplete(state)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private resolveAuctionIfComplete(state: HydratedStellarVenturesGameState): MachineState {
        const auction = state.activeInitialAuction
        const corporationId = state.activeInitialAuctionCorporationId
        assertExists(auction, 'Initial auction should be present while resolving it')
        assertExists(corporationId, 'Active initial auction corporation id should be present')

        if (activeAuctionParticipantCount(auction) > 1) {
            // Bidding continues.
            return MachineState.InitialAuction
        }

        // The opening bidder is never allowed to pass before placing an opening bid (see
        // PassAuction), so by this point someone has always bid - auction.highBid is guaranteed.
        const winner = auction.participants.find((participant) => !participant.passed)
        assertExists(winner, 'Initial auction winner should be present while resolving it')
        assertExists(auction.highBid, 'Initial auction should have a bid before it can resolve')

        const corporation = state.getCorporation(corporationId)
        corporation.issueShareToPlayer(winner.playerId, state.actionCount, auction.highBid)
        corporation.treasury += auction.highBid
        state.getPlayerState(winner.playerId).spendLiquidFunds(auction.highBid)

        state.previousInitialAuctionWinnerId = winner.playerId
        state.activeInitialAuctionCorporationId = undefined
        state.activeInitialAuction = undefined
        state.initialAuctionBidOrder = undefined
        state.initialAuctionCurrentBidderId = undefined

        const nextState =
            state.initialAuctionQueue.length === 0
                ? MachineState.IssueShare
                : MachineState.InitialAuction

        // Step 4 (rulebook page 11): "Chooses a second Corporate Power from the row of available
        // powers" - every winning President drafts one, alongside the "Alien Explorers" Power
        // their Corporation already started with.
        if (state.availableCorporatePowerIds.length > 0) {
            state.draftPowerCorporationId = corporationId
            state.draftPowerResumeState = nextState
            return MachineState.DraftPower
        }

        state.activePlayerIds = []
        return nextState
    }
}
