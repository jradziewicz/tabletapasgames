import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { deliverOrderedShips } from '../operations/shipOrdering.js'

// Like ScrapLowestShip, DeliverShips has no playerId - it's a System action, queued
// automatically by DeliverShipsStateHandler.enter(). It's the second, fully-automatic step of
// the Administration Round (rulebook page 20): "Move all Ordered Ships to Delivered Ships,
// increasing CARGO by the total amount of Ship Level delivered for each Corporation. Reminder!
// CARGO never exceeds 13, additional CARGO is lost."
export type DeliverShips = Type.Static<typeof DeliverShips>
export const DeliverShips = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DeliverShips)
        })
    ])
)

export const DeliverShipsValidator = Compile(DeliverShips)

export function isDeliverShips(action?: GameAction): action is DeliverShips {
    return action?.type === ActionType.DeliverShips
}

/**
 * For every Corporation, moves all of its Ordered Ships into Delivered Ships and increases its
 * CARGO by the sum of the levels just delivered, clamped at MAX_CARGO (any excess is lost per
 * the rulebook's reminder). Applies to every Corporation regardless of whether it Ordered
 * anything this Era - a Corporation with no Ordered Ships simply sees no change.
 */
export class HydratedDeliverShips
    extends HydratableAction<typeof DeliverShips>
    implements DeliverShips
{
    declare type: ActionType.DeliverShips

    constructor(data: DeliverShips) {
        super(data, DeliverShipsValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        deliverOrderedShips(state)
    }
}
