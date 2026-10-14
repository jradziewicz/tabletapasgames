import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ActionKind } from '../data/board.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { hatchError } from '../operations/rules.js'
import { actingColony, pendingActionOf } from '../operations/turn.js'

export type Hatch = Type.Static<typeof Hatch>
export const Hatch = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Hatch),
            playerId: Type.String(),
            count: Type.Number()
        })
    ])
)

export const HatchValidator = Compile(Hatch)

export function isHatch(action?: GameAction): action is Hatch {
    return action?.type === ActionType.Hatch
}

export class HydratedHatch extends HydratableAction<typeof Hatch> implements Hatch {
    declare type: ActionType.Hatch
    declare playerId: string
    declare count: number

    constructor(data: Hatch) {
        super(data, HatchValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        const colony = actingColony(state, this.playerId)
        const pending = pendingActionOf(state, ActionKind.Hatch)
        const error = hatchError(state, colony.color, pending, this.count)
        if (error) {
            throw Error(error)
        }
        colony.hatch(this.count)
    }
}
