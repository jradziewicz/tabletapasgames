import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { acquireAt, acquireHasEffect, reasonAcquireInvalid, type AcquireChoice } from '../operations/acquire.js'

export type Acquire = Type.Static<typeof Acquire>
export const Acquire = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Acquire),
            playerId: Type.String(),
            choice: Type.Union([Type.Literal('weapon'), Type.Literal('tool')])
        })
    ])
)

export const AcquireValidator = Compile(Acquire)

export function isAcquire(action?: GameAction): action is Acquire {
    return action?.type === ActionType.Acquire
}

export class HydratedAcquire extends HydratableAction<typeof Acquire> implements Acquire {
    declare type: ActionType.Acquire
    declare playerId: string
    declare choice: AcquireChoice

    constructor(data: Acquire) {
        super(data, AcquireValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = reasonAcquireInvalid(state, this.playerId, this.choice)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        acquireAt(state, this.playerId, this.choice)
    }

    static canAcquire(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        return acquireHasEffect(state, playerId)
    }
}
