import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLocustGameState } from '../model/gameState.js'

export type MatureNymphs = Type.Static<typeof MatureNymphs>
export const MatureNymphs = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.MatureNymphs),
            color: Type.Enum(Color),
            metadata: Type.Optional(Type.Object({ matured: Type.Number() }))
        })
    ])
)

export const MatureNymphsValidator = Compile(MatureNymphs)

export function isMatureNymphs(action?: GameAction): action is MatureNymphs {
    return action?.type === ActionType.MatureNymphs
}

export class HydratedMatureNymphs
    extends HydratableAction<typeof MatureNymphs>
    implements MatureNymphs
{
    declare type: ActionType.MatureNymphs
    declare color: Color
    declare metadata?: { matured: number }

    constructor(data: MatureNymphs) {
        super(data, MatureNymphsValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        this.metadata = { matured: state.board.matureNymphs(this.color) }
    }
}
