import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { finishImmediateAction } from '../operations/turn.js'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type EndTurn = Type.Static<typeof EndTurn>
export const EndTurn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndTurn),
            playerId: Type.String()
        })
    ])
)

export const EndTurnValidator = Compile(EndTurn)

export function isEndTurn(action?: GameAction): action is EndTurn {
    return action?.type === ActionType.EndTurn
}

export class HydratedEndTurn extends HydratableAction<typeof EndTurn> implements EndTurn {
    declare type: ActionType.EndTurn
    declare playerId: string

    constructor(data: EndTurn) {
        super(data, EndTurnValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        if (!state.activePlayerIds.includes(this.playerId)) {
            throw Error('It is not your turn')
        }
        if (state.immediateCardId !== undefined) {
            finishImmediateAction(state)
            return
        }
        state.turnOver = true
    }
}
