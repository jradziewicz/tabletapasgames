import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ActionKind } from '../data/board.js'
import { InsectKind } from '../model/board.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { Hop, jumpError } from '../operations/rules.js'
import { actingColony, pendingActionOf } from '../operations/turn.js'

export type Jump = Type.Static<typeof Jump>
export const Jump = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Jump),
            playerId: Type.String(),
            hops: Type.Array(Hop)
        })
    ])
)

export const JumpValidator = Compile(Jump)

export function isJump(action?: GameAction): action is Jump {
    return action?.type === ActionType.Jump
}

export class HydratedJump extends HydratableAction<typeof Jump> implements Jump {
    declare type: ActionType.Jump
    declare playerId: string
    declare hops: Hop[]

    constructor(data: Jump) {
        super(data, JumpValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        const colony = actingColony(state, this.playerId)
        const pending = pendingActionOf(state, ActionKind.JumpOrBreed)
        const error = jumpError(state, colony.color, pending, this.hops)
        if (error) {
            throw Error(error)
        }
        for (const hop of this.hops) {
            state.board.remove(hop.from, colony.color, InsectKind.Grasshopper)
            state.board.add(hop.to, colony.color, InsectKind.Grasshopper)
        }
    }
}
