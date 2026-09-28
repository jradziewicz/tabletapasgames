import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { deliverOrderedShips } from '../operations/shipOrdering.js'
import { liquidateShares } from '../operations/liquidation.js'

// Like DeliverShips/ScrapLowestShip/ReleaseDividends, Liquidate has no playerId - it's a System
// action, queued automatically by LiquidationStateHandler.enter(). Runs Liquidation (Final
// Scoring)'s first 3, fully-automatic steps (rulebook page 21) in one shot: Deliver Ordered
// Ships, Hostile Takeover, and Share Liquidation - see operations/liquidation.ts. Step 4,
// Determine Winner, happens separately once play reaches EndOfGame.
export type Liquidate = Type.Static<typeof Liquidate>
export const Liquidate = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.Liquidate)
        })
    ])
)

export const LiquidateValidator = Compile(Liquidate)

export function isLiquidate(action?: GameAction): action is Liquidate {
    return action?.type === ActionType.Liquidate
}

export class HydratedLiquidate extends HydratableAction<typeof Liquidate> implements Liquidate {
    declare type: ActionType.Liquidate

    constructor(data: Liquidate) {
        super(data, LiquidateValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        // 1. Deliver Ordered Ships ("As in Administration Round" - Era 5 has no Administration
        //    Round of its own to have already done this for whatever was Ordered this Era).
        deliverOrderedShips(state)

        // 2 + 3. Hostile Takeover and Share Liquidation - see operations/liquidation.ts.
        liquidateShares(state)
    }
}
