import { type HydratedAction, type MachineStateHandler, MachineContext, assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedPlaceBoardroomVote,
    isPlaceBoardroomVote
} from '../actions/placeBoardroomVote.js'
import {
    HydratedDeclineBoardroomVote,
    isDeclineBoardroomVote
} from '../actions/declineBoardroomVote.js'
import {
    HydratedChooseBoardroomBattleCorporation,
    isChooseBoardroomBattleCorporation
} from '../actions/chooseBoardroomBattleCorporation.js'
import { HydratedPlaceShareBid, isPlaceShareBid } from '../actions/placeShareBid.js'
import { HydratedPassShareBid, isPassShareBid } from '../actions/passShareBid.js'
import { HydratedFinePrint, finePrintCorporation, isFinePrint } from '../actions/finePrint.js'
import { HydratedDeclineFinePrint, isDeclineFinePrint } from '../actions/declineFinePrint.js'
import { CorporationId } from '../model/corporation.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { activeAuctionParticipantCount, turnOrderStartingWith } from '../operations/auction.js'
import { resolveShareAuctionWinner, startShareAuction } from '../operations/shareAuction.js'
import {
    corporationsWithMostVotes,
    firstBoardroomVoterId,
    resetFinePrintForNextBoardroomBattle,
    resolveBoardroomVotes
} from '../operations/boardroomBattle.js'

type BoardroomBattleAction =
    | HydratedPlaceBoardroomVote
    | HydratedDeclineBoardroomVote
    | HydratedChooseBoardroomBattleCorporation
    | HydratedPlaceShareBid
    | HydratedPassShareBid
    | HydratedFinePrint
    | HydratedDeclineFinePrint

/**
 * Runs Boardroom Battle, the second step of the Investor Round (rulebook page 18), in three
 * sub-phases:
 *
 * 1. Voting: each player, starting with (and proceeding clockwise from) the Director, gets one
 *    chance to place any number of their remaining Boardroom Votes on a single Corporation
 *    (PlaceBoardroomVote) or decline (DeclineBoardroomVote).
 * 2. Tie-break (only if needed): if more than one Corporation is tied for the most Votes -
 *    including a tie at 0 if nobody voted at all - only the Director may choose which of the
 *    tied Corporations issues a Share (ChooseBoardroomBattleCorporation).
 * 3. Forced auction: the winning Corporation must issue its next Share, auctioned off starting
 *    with (and proceeding clockwise from) the Director - reusing the same PlaceShareBid /
 *    PassShareBid actions (and activeShareAuction / shareAuctionBidOrder /
 *    shareAuctionCurrentBidderId state) as the Corporation Round's own Issue Share step. See
 *    operations/shareAuction.ts.
 *
 * Confirmed by the game's co-designer: a Corporation is only a valid Boardroom Battle target -
 * for a Vote, a tie-break choice, or the forced auction - if it has at least one Share left to
 * issue (see operations/boardroomBattle.ts's eligibleBoardroomBattleCorporationIds). If literally
 * no Corporation is currently eligible, the whole Battle is a no-op and play proceeds straight to
 * Investor Shenanigans - see resolveVotingIfComplete below.
 */
export class BoardroomBattleStateHandler
    implements MachineStateHandler<BoardroomBattleAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is BoardroomBattleAction {
        return (
            isPlaceBoardroomVote(action) ||
            isDeclineBoardroomVote(action) ||
            isChooseBoardroomBattleCorporation(action) ||
            isPlaceShareBid(action) ||
            isPassShareBid(action) ||
            isFinePrint(action) ||
            isDeclineFinePrint(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []

        if (!state.finePrintOfferResolved && finePrintCorporation(state) !== undefined) {
            if (HydratedFinePrint.canFinePrint(state, playerId)) {
                validActions.push(ActionType.FinePrint)
            }
            if (HydratedDeclineFinePrint.canDeclineFinePrint(state, playerId)) {
                validActions.push(ActionType.DeclineFinePrint)
            }
            return validActions
        }

        if (state.activeShareAuction) {
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

        if ((state.boardroomBattleTiedCorporationIds?.length ?? 0) > 1) {
            if (playerId === state.directorPlayerId) {
                validActions.push(ActionType.ChooseBoardroomBattleCorporation)
            }
            return validActions
        }

        if (state.boardroomBattleCurrentVoterId !== playerId) {
            return validActions
        }
        if (HydratedPlaceBoardroomVote.canOfferPlaceBoardroomVote(state, playerId)) {
            validActions.push(ActionType.PlaceBoardroomVote)
        }
        if (HydratedDeclineBoardroomVote.canDeclineBoardroomVote(state, playerId)) {
            validActions.push(ActionType.DeclineBoardroomVote)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState

        if (!state.finePrintOfferResolved) {
            const corporation = finePrintCorporation(state)
            const presidentPlayerId = corporation?.getPresidentPlayerId()
            if (presidentPlayerId) {
                state.activePlayerIds = [presidentPlayerId]
                return
            }
            // Nobody holds Fine Print (or it has no President) - nothing to offer.
            state.finePrintOfferResolved = true
        }

        if (state.activeShareAuction) {
            state.activePlayerIds = state.shareAuctionCurrentBidderId
                ? [state.shareAuctionCurrentBidderId]
                : []
            return
        }

        if ((state.boardroomBattleTiedCorporationIds?.length ?? 0) > 1) {
            state.activePlayerIds = [state.directorPlayerId]
            return
        }

        if (!state.boardroomBattleVoteOrder) {
            // First entry into this Boardroom Battle.
            const voteOrder = turnOrderStartingWith(
                state.turnManager.turnOrder,
                state.directorPlayerId
            )
            state.boardroomBattleVoteOrder = voteOrder
            state.boardroomBattleCurrentVoterId = firstBoardroomVoterId(state, voteOrder)
            state.boardroomBattleVotes = []
        }

        state.activePlayerIds = state.boardroomBattleCurrentVoterId
            ? [state.boardroomBattleCurrentVoterId]
            : []
    }

    onAction(
        action: BoardroomBattleAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        switch (true) {
            case isFinePrint(action):
            case isDeclineFinePrint(action): {
                // Effect (or lack thereof) already applied - loop back so enter() now proceeds
                // past the resolved gate into normal voting setup.
                return MachineState.BoardroomBattle
            }
            case isPlaceBoardroomVote(action):
            case isDeclineBoardroomVote(action): {
                return this.resolveVotingIfComplete(state)
            }
            case isChooseBoardroomBattleCorporation(action): {
                return this.beginForcedAuction(state, action.corporationId)
            }
            case isPlaceShareBid(action):
            case isPassShareBid(action): {
                return this.resolveAuctionIfComplete(state)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private resolveVotingIfComplete(state: HydratedStellarVenturesGameState): MachineState {
        if (state.boardroomBattleCurrentVoterId) {
            // Voting continues.
            return MachineState.BoardroomBattle
        }

        // Every player has had their one chance to vote - tally and resolve.
        state.boardroomBattleVoteOrder = undefined

        const candidates = corporationsWithMostVotes(state)
        if (candidates.length === 0) {
            // No Corporation is currently eligible at all (none has a Share left to issue) - the
            // whole Battle is a no-op. Nobody could have placed a Vote in this state (see
            // HydratedPlaceBoardroomVote.canPlaceBoardroomVote), so there are no Votes to return.
            state.boardroomBattleVotes = []
            state.activePlayerIds = []
            resetFinePrintForNextBoardroomBattle(state)
            return MachineState.InvestorAction
        }
        if (candidates.length > 1) {
            state.boardroomBattleTiedCorporationIds = candidates
            return MachineState.BoardroomBattle
        }

        const winner = candidates[0]
        assertExists(winner, 'Boardroom Battle should always have a candidate Corporation here')
        resolveBoardroomVotes(state, winner)

        return this.beginForcedAuction(state, winner)
    }

    private beginForcedAuction(
        state: HydratedStellarVenturesGameState,
        corporationId: CorporationId
    ): MachineState {
        state.boardroomBattleTiedCorporationIds = undefined
        state.boardroomBattleCorporationId = corporationId

        // Guaranteed to have a Share available - only eligible Corporations (see
        // eligibleBoardroomBattleCorporationIds) can ever reach here, whether as the vote's
        // outright winner or as the Director's tie-break choice.
        startShareAuction(
            state,
            `boardroom-battle-share-auction-${corporationId}`,
            state.directorPlayerId
        )
        return MachineState.BoardroomBattle
    }

    private resolveAuctionIfComplete(state: HydratedStellarVenturesGameState): MachineState {
        const auction = state.activeShareAuction
        const corporationId = state.boardroomBattleCorporationId
        assertExists(auction, 'Share auction should be present while resolving it')
        assertExists(
            corporationId,
            'Boardroom Battle corporation id should be present while resolving its auction'
        )

        if (activeAuctionParticipantCount(auction) > 1) {
            // Bidding continues.
            return MachineState.BoardroomBattle
        }

        resolveShareAuctionWinner(state, corporationId)
        state.boardroomBattleCorporationId = undefined
        resetFinePrintForNextBoardroomBattle(state)

        return MachineState.InvestorAction
    }
}
