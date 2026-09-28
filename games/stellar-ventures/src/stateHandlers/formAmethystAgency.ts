import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceShareBid, isPlaceShareBid } from '../actions/placeShareBid.js'
import { HydratedPassShareBid, isPassShareBid } from '../actions/passShareBid.js'
import {
    HydratedChooseAmethystHomePlanet,
    isChooseAmethystHomePlanet
} from '../actions/chooseAmethystHomePlanet.js'
import { CorporationId } from '../model/corporation.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { activeAuctionParticipantCount } from '../operations/auction.js'
import { resolveShareAuctionWinner, startShareAuction } from '../operations/shareAuction.js'

type FormAmethystAgencyAction =
    | HydratedPlaceShareBid
    | HydratedPassShareBid
    | HydratedChooseAmethystHomePlanet

/**
 * Runs Form Amethyst Agency (rulebook page 9), reached once Assign Turn Order advances into
 * Era 3 (see stateHandlers/assignTurnOrder.ts). Two sub-phases:
 *
 * 1. Formation Auction: Amethyst Agency's first Share is auctioned off starting with (and
 *    proceeding clockwise from) the Director - "the Amethyst Agency is formed via Auction
 *    (Director initiates)" / "Director places first bid." This reuses the exact same
 *    PlaceShareBid/PassShareBid actions and activeShareAuction state as the Corporation Round's
 *    own Issue Share step and Boardroom Battle's forced auction (see operations/shareAuction.ts)
 *    - it's simply a third "opening bidder" rule for the same generic Share auction. Per the
 *    Amethyst Agency FAQ (page 23), its President does NOT get to choose a second Corporate
 *    Power the way a President from the Initial Auction would.
 * 2. Home Planet choice: the winning President chooses one of Amethyst Agency's 3 candidate Home
 *    Planets, placing a free Outpost there and fully activating the Corporation, including
 *    gaining its "Secret Agents" Formation Power (see actions/chooseAmethystHomePlanet.ts). Play
 *    then resumes with a fresh Corporation Round, starting from the first Corporation in the
 *    (now 6-entry) turn order.
 *
 * Not modeled yet: placing the Agreement Token on Amethyst Agency's Charter (Amethyst can still
 * Sign The Agreement like any other Corporation - operations/agreement.ts's
 * isEligibleToSignTheAgreement doesn't exclude it - but nothing currently visualizes the token's
 * board position, since this engine only tracks planetCountAtSigning once it's actually placed).
 */
export class FormAmethystAgencyStateHandler
    implements MachineStateHandler<FormAmethystAgencyAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is FormAmethystAgencyAction {
        return (
            isPlaceShareBid(action) || isPassShareBid(action) || isChooseAmethystHomePlanet(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []

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

        if (HydratedChooseAmethystHomePlanet.canChooseAmethystHomePlanet(state, playerId)) {
            validActions.push(ActionType.ChooseAmethystHomePlanet)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const corporation = state.getCorporation(CorporationId.AmethystAgency)

        if (!state.activeShareAuction && corporation.issuedShareCount === 0) {
            startShareAuction(state, 'amethyst-agency-formation', state.directorPlayerId)
        }

        if (state.activeShareAuction) {
            state.activePlayerIds = state.shareAuctionCurrentBidderId
                ? [state.shareAuctionCurrentBidderId]
                : []
            return
        }

        // Auction resolved - awaiting the new President's Home Planet choice.
        const presidentPlayerId = corporation.getPresidentPlayerId()
        state.activePlayerIds = presidentPlayerId ? [presidentPlayerId] : []
    }

    onAction(
        action: FormAmethystAgencyAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        switch (true) {
            case isPlaceShareBid(action):
            case isPassShareBid(action): {
                return this.resolveAuctionIfComplete(state)
            }
            case isChooseAmethystHomePlanet(action): {
                state.activeCorporationIndex = 0
                return MachineState.IssueShare
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private resolveAuctionIfComplete(state: HydratedStellarVenturesGameState): MachineState {
        const auction = state.activeShareAuction
        assertExists(
            auction,
            'Amethyst Agency formation auction should be present while resolving it'
        )

        if (activeAuctionParticipantCount(auction) > 1) {
            // Bidding continues.
            return MachineState.FormAmethystAgency
        }

        resolveShareAuctionWinner(state, CorporationId.AmethystAgency)
        // Stay in this state - the newly-elected President still needs to choose a Home Planet.
        return MachineState.FormAmethystAgency
    }
}
