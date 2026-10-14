import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLocustGameState } from '../model/gameState.js'

export type AssignDuelScoring = Type.Static<typeof AssignDuelScoring>
export const AssignDuelScoring = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AssignDuelScoring),
            playerId: Type.String(),
            vigorColor: Type.Enum(Color)
        })
    ])
)

export const AssignDuelScoringValidator = Compile(AssignDuelScoring)

export function isAssignDuelScoring(action?: GameAction): action is AssignDuelScoring {
    return action?.type === ActionType.AssignDuelScoring
}

export class HydratedAssignDuelScoring
    extends HydratableAction<typeof AssignDuelScoring>
    implements AssignDuelScoring
{
    declare type: ActionType.AssignDuelScoring
    declare playerId: string
    declare vigorColor: Color

    constructor(data: AssignDuelScoring) {
        super(data, AssignDuelScoringValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        if (!state.activePlayerIds.includes(this.playerId)) {
            throw Error('It is not your turn')
        }
        if (!state.coloniesOf(this.playerId).some((colony) => colony.color === this.vigorColor)) {
            throw Error(`${this.vigorColor} is not one of your colours`)
        }
        state.getPlayerState(this.playerId).vigorColor = this.vigorColor
    }
}
