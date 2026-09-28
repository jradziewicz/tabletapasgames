import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedDeliverShips, DeliverShips, isDeliverShips } from '../actions/deliverShips.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

/**
 * Runs Deliver Ordered Ships, the second step of the Administration Round (rulebook page 20),
 * which follows Scrap Lowest-Level Ship (see stateHandlers/scrapLowestShip.ts). Fully automatic -
 * "Move all Ordered Ships to Delivered Ships" - so this handler queues its own System action
 * exactly like Scrap Lowest-Level Ship and Release Dividends before it.
 */
export class DeliverShipsStateHandler
    implements MachineStateHandler<HydratedDeliverShips, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is HydratedDeliverShips {
        return isDeliverShips(action)
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

        if (context.getPendingActions().some((action) => isDeliverShips(action))) {
            return
        }

        context.addSystemAction(DeliverShips)
    }

    onAction(
        _action: HydratedDeliverShips,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        return MachineState.AssignTurnOrder
    }
}
