import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedAssignTurnOrder,
    AssignTurnOrder,
    isAssignTurnOrder
} from '../actions/assignTurnOrder.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { nextStateAfterAdministration } from '../operations/administrationRound.js'
import { taxPayerCorporationIdsInTurnOrder } from '../operations/taxes.js'


/**
 * Runs Assign Turn Order, Pass Director Marker and Advance Era together - the Administration
 * Round's remaining 3 fully-automatic steps (rulebook page 20), which follow Deliver Ordered
 * Ships (see stateHandlers/deliverShips.ts). All 3 are simple bookkeeping with no player
 * decision, so - like every other Administration Round step - this handler queues its own
 * System action.
 *
 * Once applied, era has already been advanced (see actions/assignTurnOrder.ts). Era 3 routes to
 * Amethyst Agency formation first; every other Era goes straight back into a new Corporation
 * Round, starting over at the (newly reordered) first Corporation in turn order. Era 5 has no
 * Investor or Administration Round at all (rulebook page 9: "Era 5 proceeds to Liquidation after
 * the Corporation Round"), so this state is never reached again after Era 5's Corporation Round
 * ends - see operations/corporationRound.ts's advanceToNextCorporationOrInvestorRound.
 */
export class AssignTurnOrderStateHandler
    implements MachineStateHandler<HydratedAssignTurnOrder, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is HydratedAssignTurnOrder {
        return isAssignTurnOrder(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        // Mandatory and fully automatic - no player ever acts in this state.
        return []
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        state.activePlayerIds = []

        if (context.getPendingActions().some((action) => isAssignTurnOrder(action))) {
            return
        }

        context.addSystemAction(AssignTurnOrder)
    }

    onAction(
        _action: HydratedAssignTurnOrder,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState

        if (state.usesTaxes) {
            const taxPayerCorporationIds = taxPayerCorporationIdsInTurnOrder(
                state,
                state.corporationTurnOrder
            )
            if (taxPayerCorporationIds.length > 0) {
                state.taxPayerCorporationIds = taxPayerCorporationIds
                state.pendingTaxPaymentBoxBefore = state.taxBox ?? 0
                state.pendingTaxPayments = []
                return MachineState.PayTaxes
            }
        }

        return nextStateAfterAdministration(state)
    }
}
