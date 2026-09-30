import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { reasonResolveHuntInvalid, resolveHuntAt } from '../operations/hunt.js'

export type ResolveHunt = Type.Static<typeof ResolveHunt>
export const ResolveHunt = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ResolveHunt),
            playerId: Type.String(),
            tokenIndexes: Type.Array(Type.Number()),
            hitTargets: Type.Array(Type.String())
        })
    ])
)

export const ResolveHuntValidator = Compile(ResolveHunt)

export function isResolveHunt(action?: GameAction): action is ResolveHunt {
    return action?.type === ActionType.ResolveHunt
}

export class HydratedResolveHunt
    extends HydratableAction<typeof ResolveHunt>
    implements ResolveHunt
{
    declare type: ActionType.ResolveHunt
    declare playerId: string
    declare tokenIndexes: number[]
    declare hitTargets: string[]

    constructor(data: ResolveHunt) {
        super(data, ResolveHuntValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const request = { tokenIndexes: this.tokenIndexes, hitTargets: this.hitTargets }
        const invalidReason = reasonResolveHuntInvalid(state, this.playerId, request)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        resolveHuntAt(state, this.playerId, request)
    }
}
