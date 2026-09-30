import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { applyGemAction, reasonGemActionInvalid, type GemActionKind } from '../operations/gems.js'

export type GemAction = Type.Static<typeof GemAction>
export const GemAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.GemAction),
            playerId: Type.String(),
            kind: Type.Union([
                Type.Literal('repeat'),
                Type.Literal('market'),
                Type.Literal('swap'),
                Type.Literal('movePawn')
            ]),
            target: Type.Number()
        })
    ])
)

export const GemActionValidator = Compile(GemAction)

export function isGemAction(action?: GameAction): action is GemAction {
    return action?.type === ActionType.GemAction
}

export class HydratedGemAction extends HydratableAction<typeof GemAction> implements GemAction {
    declare type: ActionType.GemAction
    declare playerId: string
    declare kind: GemActionKind
    declare target: number

    constructor(data: GemAction) {
        super(data, GemActionValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = reasonGemActionInvalid(state, this.playerId, this.kind, this.target)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        applyGemAction(state, this.playerId, this.kind, this.target)
    }

    static canGemAction(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        return player.gems > 0 && state.activePlayerIds.includes(playerId)
    }
}
