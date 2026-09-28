import { type HydratedAction, type MachineStateHandler, MachineContext, assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedIssueShare, isIssueShare } from '../actions/issueShare.js'
import {
    DeclineIssueShare,
    HydratedDeclineIssueShare,
    isDeclineIssueShare
} from '../actions/declineIssueShare.js'
import { HydratedPlaceShareBid, isPlaceShareBid } from '../actions/placeShareBid.js'
import { HydratedPassShareBid, isPassShareBid } from '../actions/passShareBid.js'
import { HydratedLeakedResearch, isLeakedResearch } from '../actions/leakedResearch.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { activeAuctionParticipantCount } from '../operations/auction.js'
import { resolveShareAuctionWinner } from '../operations/shareAuction.js'

type IssueShareAction =
    | HydratedIssueShare
    | HydratedDeclineIssueShare
    | HydratedPlaceShareBid
    | HydratedPassShareBid
    | HydratedLeakedResearch

/**
 * Runs Issue Share, the first step of each Corporation's turn during the Corporation Round
 * (state.activeCorporationId). The Corporation's President may choose to issue its next
 * available share (IssueShare), opening it up to a bidding auction among all players in turn
 * order starting with (and going clockwise from) the President - or decline (DeclineIssueShare),
 * since issuing a share is always optional.
 *
 * Like the Initial Auction, the President must place an opening bid (see PassShareBid - $0 is
 * allowed) before anyone can pass, so the auction always has a winner: if everyone else passes,
 * the President keeps the share at whatever they opened with. The winner pays the Corporation's
 * treasury and receives the share. Either way, this Corporation then moves on to Expand
 * Network / Wormhole.
 */
export class IssueShareStateHandler
    implements MachineStateHandler<IssueShareAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is IssueShareAction {
        return (
            isIssueShare(action) ||
            isDeclineIssueShare(action) ||
            isPlaceShareBid(action) ||
            isPassShareBid(action) ||
            isLeakedResearch(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []

        if (!state.activeShareAuction) {
            if (HydratedIssueShare.canIssueShare(state, playerId)) {
                validActions.push(ActionType.IssueShare)
            }
            if (HydratedDeclineIssueShare.canDeclineIssueShare(state, playerId)) {
                validActions.push(ActionType.DeclineIssueShare)
            }
            if (HydratedLeakedResearch.canOfferLeakedResearch(state, playerId)) {
                validActions.push(ActionType.LeakedResearch)
            }
            return validActions
        }

        if (state.shareAuctionCurrentBidderId !== playerId) {
            return validActions
        }

        if (HydratedPlaceShareBid.canPlaceShareBid(state, playerId)) {
            validActions.push(ActionType.PlaceShareBid)
        }
        if (HydratedPassShareBid.canPassShareBid(state, playerId)) {
            validActions.push(ActionType.PassShareBid)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState

        if (state.activeShareAuction) {
            state.activePlayerIds = state.shareAuctionCurrentBidderId
                ? [state.shareAuctionCurrentBidderId]
                : []
            return
        }

        const corporationId = state.activeCorporationId
        if (!corporationId) {
            state.activePlayerIds = []
            return
        }

        const corporation = state.getCorporation(corporationId)
        const presidentPlayerId = corporation.getPresidentPlayerId()
        state.activePlayerIds = presidentPlayerId ? [presidentPlayerId] : []

        // A Corporation with no Shares left to issue has nothing for its President to actually
        // decide here - Issuing is never possible (HydratedIssueShare.canIssueShare already
        // requires availableShareCount > 0) and Declining is the only remaining option, so skip
        // the step automatically with a system-queued Decline (mirrors ReleaseDividends/
        // PayDividends' own System actions - see MachineContext.addSystemAction) instead of
        // stopping on the President just to make them click Decline for a Share that was never
        // available in the first place. Guarded against double-queueing if enter() somehow runs
        // more than once before the queued action is processed.
        if (
            presidentPlayerId &&
            corporation.availableShareCount <= 0 &&
            !context.getPendingActions().some((action) => isDeclineIssueShare(action))
        ) {
            context.addSystemAction(DeclineIssueShare, { playerId: presidentPlayerId })
        }
    }

    onAction(
        action: IssueShareAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        switch (true) {
            case isIssueShare(action): {
                return MachineState.IssueShare
            }
            case isDeclineIssueShare(action): {
                state.activePlayerIds = []
                return MachineState.ExpandNetworkOrWormhole
            }
            case isPlaceShareBid(action):
            case isPassShareBid(action): {
                return this.resolveShareAuctionIfComplete(state)
            }
            case isLeakedResearch(action): {
                // Leaked Research never touches the Issue Share decision itself - the President
                // simply remains here, still free to Issue/Decline as normal.
                return MachineState.IssueShare
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private resolveShareAuctionIfComplete(state: HydratedStellarVenturesGameState): MachineState {
        const auction = state.activeShareAuction
        const corporationId = state.activeCorporationId
        assertExists(auction, 'Share auction should be present while resolving it')
        assertExists(corporationId, 'Active corporation id should be present while resolving share auction')

        if (activeAuctionParticipantCount(auction) > 1) {
            // Bidding continues.
            return MachineState.IssueShare
        }

        resolveShareAuctionWinner(state, corporationId)

        return MachineState.ExpandNetworkOrWormhole
    }
}
