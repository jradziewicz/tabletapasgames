import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedOrderShip, isOrderShip } from '../actions/orderShip.js'
import {
    HydratedForcedShipPurchase,
    isForcedShipPurchaseAction
} from '../actions/forcedShipPurchase.js'
import { HydratedDeclineOrderShips, isDeclineOrderShips } from '../actions/declineOrderShips.js'
import { HydratedLeakedResearch, isLeakedResearch } from '../actions/leakedResearch.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { advanceToNextCorporationOrInvestorRound } from '../operations/corporationRound.js'

type OrderShipsAction =
    | HydratedOrderShip
    | HydratedForcedShipPurchase
    | HydratedDeclineOrderShips
    | HydratedLeakedResearch

/**
 * Runs Order Ships, the fourth and final step of each Corporation's turn during the Corporation
 * Round. Order Ships is "Conditionally Mandatory" (rulebook page 16): the President must Order
 * at least 1 Ship if the Corporation currently has none at all (Forced Purchase), and otherwise
 * may Order 0 or more Ships, up to 1 per empty Ship column (Standard Purchase) - see
 * operations/shipOrdering.ts. Ships are Ordered one at a time: after each OrderShip action, this
 * state is re-entered so the President can either Order another or Decline (once the Forced
 * Purchase minimum, if any, has been met). Declining - or running out of room/funds to Order
 * more - moves this Corporation's turn on to the next Corporation, or to the Investor Round if
 * this was the last Corporation in turn order this Era.
 */
export class OrderShipsStateHandler
    implements MachineStateHandler<OrderShipsAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is OrderShipsAction {
        return (
            isOrderShip(action) ||
            isForcedShipPurchaseAction(action) ||
            isDeclineOrderShips(action) ||
            isLeakedResearch(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []

        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return validActions
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return validActions
        }

        if (HydratedOrderShip.canOfferOrderShip(state, playerId)) {
            validActions.push(ActionType.OrderShip)
        }
        if (HydratedForcedShipPurchase.canOfferForcedShipPurchase(state, playerId)) {
            validActions.push(ActionType.ForcedShipPurchase)
        }
        if (HydratedDeclineOrderShips.canDeclineOrderShips(state, playerId)) {
            validActions.push(ActionType.DeclineOrderShips)
        }
        if (HydratedLeakedResearch.canOfferLeakedResearch(state, playerId)) {
            validActions.push(ActionType.LeakedResearch)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            state.activePlayerIds = []
            return
        }

        const presidentPlayerId = state.getCorporation(corporationId).getPresidentPlayerId()
        state.activePlayerIds = presidentPlayerId ? [presidentPlayerId] : []
    }

    onAction(
        action: OrderShipsAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        switch (true) {
            case isOrderShip(action): {
                // Ordering a section's first-ever Ship can trigger a Scrapping Event
                // (resolveFirstShipOrderedEffects), which may in turn have paused awaiting a
                // Spare Parts decision - see operations/shipOrdering.ts's applyScrappingEvent. If
                // so, detour there first, resuming back here once it's resolved either way.
                if (state.pendingSparePartsCorporationId) {
                    state.pendingSparePartsResumeState = MachineState.OrderShips
                    return MachineState.OfferSpareParts
                }
                // Stay in this state - the President may Order another Ship, or Decline once
                // any Forced Purchase minimum has been satisfied (re-entering re-checks both).
                return MachineState.OrderShips
            }
            case isForcedShipPurchaseAction(action): {
                // Same Scrapping Event / Spare Parts detour as plain OrderShip above - the Ship
                // this resolves to Ordering can trigger one exactly the same way.
                if (state.pendingSparePartsCorporationId) {
                    state.pendingSparePartsResumeState = MachineState.OrderShips
                    return MachineState.OfferSpareParts
                }
                // The Forced Purchase minimum is now satisfied (this Corporation just Ordered
                // its 1 required Ship), so re-entering will let the President Decline normally -
                // no different from finishing a Standard Purchase from here.
                return MachineState.OrderShips
            }
            case isDeclineOrderShips(action): {
                state.activePlayerIds = []
                return advanceToNextCorporationOrInvestorRound(state)
            }
            case isLeakedResearch(action): {
                // Stay in this state - Leaked Research doesn't order a Ship or end the turn, so
                // the President remains free to Order/Decline as normal.
                return MachineState.OrderShips
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
