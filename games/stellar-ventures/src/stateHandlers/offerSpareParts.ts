import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSpareParts, isSpareParts } from '../actions/spareParts.js'
import { HydratedDeclineSpareParts, isDeclineSpareParts } from '../actions/declineSpareParts.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

type OfferSparePartsAction = HydratedSpareParts | HydratedDeclineSpareParts

/**
 * Runs the Spare Parts offer (Corporate Power Glossary, page 29), entered whenever
 * operations/shipOrdering.ts's applyScrappingEvent detects that a Scrapping Event is about to
 * remove one of this Corporation's Delivered Ships and it still holds Spare Parts -
 * state.pendingSparePartsCorporationId / pendingSparePartsShipLevel / pendingSparePartsResumeState
 * (the last set by whichever handler detoured here - see stateHandlers/orderShips.ts,
 * stateHandlers/scrapLowestShip.ts) name the Corporation, the at-risk Ship's level, and where play
 * should resume once resolved.
 *
 * As with Sign The Agreement (see stateHandlers/offerSignTheAgreement.ts), the choice always
 * belongs to the Corporation's President, who is not necessarily whoever's turn it otherwise is -
 * so this handler always makes the President the sole active player here, regardless of whose turn
 * triggered the Scrapping Event.
 */
export class OfferSparePartsStateHandler
    implements MachineStateHandler<OfferSparePartsAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is OfferSparePartsAction {
        return isSpareParts(action) || isDeclineSpareParts(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []
        if (HydratedSpareParts.canSpareParts(state, playerId)) {
            validActions.push(ActionType.SpareParts)
        }
        if (HydratedDeclineSpareParts.canDeclineSpareParts(state, playerId)) {
            validActions.push(ActionType.DeclineSpareParts)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const corporationId = state.pendingSparePartsCorporationId
        if (!corporationId) {
            state.activePlayerIds = []
            return
        }
        const presidentPlayerId = state.getCorporation(corporationId).getPresidentPlayerId()
        state.activePlayerIds = presidentPlayerId ? [presidentPlayerId] : []
    }

    onAction(
        _action: OfferSparePartsAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState

        // Both HydratedSpareParts and HydratedDeclineSpareParts fully resolve the at-risk Ship's
        // fate themselves (see actions/spareParts.ts / declineSpareParts.ts) - just return to
        // wherever the Scrapping Event that triggered this offer came from.
        const resumeState = state.pendingSparePartsResumeState ?? MachineState.OrderShips
        state.pendingSparePartsResumeState = undefined
        state.activePlayerIds = []
        return resumeState
    }
}
