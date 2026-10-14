import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ActionKind } from '../data/board.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { swarmError } from '../operations/rules.js'
import { startSwarm } from '../operations/swarm.js'
import { actingColony, pendingActionOf } from '../operations/turn.js'

export type Swarm = Type.Static<typeof Swarm>
export const Swarm = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Swarm),
            playerId: Type.String(),
            habitatIds: Type.Array(Type.String())
        })
    ])
)

export const SwarmValidator = Compile(Swarm)

export function isSwarm(action?: GameAction): action is Swarm {
    return action?.type === ActionType.Swarm
}

export class HydratedSwarm extends HydratableAction<typeof Swarm> implements Swarm {
    declare type: ActionType.Swarm
    declare playerId: string
    declare habitatIds: string[]

    constructor(data: Swarm) {
        super(data, SwarmValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        actingColony(state, this.playerId)
        const pending = pendingActionOf(state, ActionKind.Swarm)
        const error = swarmError(state, pending, this.habitatIds)
        if (error) {
            throw Error(error)
        }
        startSwarm(state, this.habitatIds)
    }
}
