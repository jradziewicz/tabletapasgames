import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type SkipBonusInvest = Type.Static<typeof SkipBonusInvest>
export const SkipBonusInvest = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SkipBonusInvest),
            playerId: Type.String()
        })
    ])
)

export const SkipBonusInvestValidator = Compile(SkipBonusInvest)

export function isSkipBonusInvest(action?: GameAction): action is SkipBonusInvest {
    return action?.type === ActionType.SkipBonusInvest
}

export class HydratedSkipBonusInvest
    extends HydratableAction<typeof SkipBonusInvest>
    implements SkipBonusInvest
{
    declare type: ActionType.SkipBonusInvest
    declare playerId: string

    constructor(data: SkipBonusInvest) {
        super(data, SkipBonusInvestValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        if (!state.bonusInvest) {
            throw Error('There is no bonus invest to skip')
        }
        if (!state.activePlayerIds.includes(this.playerId)) {
            throw Error('It is not your turn')
        }
        delete state.bonusInvest
    }
}
