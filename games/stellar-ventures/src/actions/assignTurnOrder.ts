import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    corporationTurnOrderByMiningCapacity,
    nextDirectorPlayerId
} from '../operations/administrationRound.js'

// Like ScrapLowestShip/DeliverShips, AssignTurnOrder has no playerId - it's a System action,
// queued automatically by AssignTurnOrderStateHandler.enter(). It combines the Administration
// Round's remaining 3 fully-automatic steps (rulebook page 20), all of which are simple
// bookkeeping with no player decision:
//   3. Assign Turn Order - "Reorder Corporations by Mining Capacity highest (1st) to lowest
//      (last). Ties maintain order."
//   4. Pass Director Marker - "Pass clockwise to next player."
//   5. Advance Era - "Move the Era Marker."
export type AssignTurnOrder = Type.Static<typeof AssignTurnOrder>
export const AssignTurnOrder = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.AssignTurnOrder)
        })
    ])
)

export const AssignTurnOrderValidator = Compile(AssignTurnOrder)

export function isAssignTurnOrder(action?: GameAction): action is AssignTurnOrder {
    return action?.type === ActionType.AssignTurnOrder
}

/**
 * Reorders corporationTurnOrder by current Mining Capacity (highest first, ties keeping their
 * existing relative order), passes the Director Marker to the next player clockwise, and
 * advances the Era counter. Era 3's Amethyst Agency formation (rulebook page 9) and Era 5's
 * transition straight to Liquidation are both handled by whichever state this action's handler
 * transitions to next (see stateHandlers/assignTurnOrder.ts and
 * operations/corporationRound.ts), not by this action itself.
 */
export class HydratedAssignTurnOrder
    extends HydratableAction<typeof AssignTurnOrder>
    implements AssignTurnOrder
{
    declare type: ActionType.AssignTurnOrder

    constructor(data: AssignTurnOrder) {
        super(data, AssignTurnOrderValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        state.corporationTurnOrder = corporationTurnOrderByMiningCapacity(state)
        state.corporationTurnOrder.forEach((corporationId, index) => {
            state.getCorporation(corporationId).turnOrderPosition = index
        })

        state.directorPlayerId = nextDirectorPlayerId(state)

        state.era += 1
    }
}
