import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { relocationError } from '../operations/rules.js'
import { relocate } from '../operations/swarm.js'

export type RelocateLocusts = Type.Static<typeof RelocateLocusts>
export const RelocateLocusts = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RelocateLocusts),
            playerId: Type.String(),
            destinations: Type.Array(Type.String())
        })
    ])
)

export const RelocateLocustsValidator = Compile(RelocateLocusts)

export function isRelocateLocusts(action?: GameAction): action is RelocateLocusts {
    return action?.type === ActionType.RelocateLocusts
}

export class HydratedRelocateLocusts
    extends HydratableAction<typeof RelocateLocusts>
    implements RelocateLocusts
{
    declare type: ActionType.RelocateLocusts
    declare playerId: string
    declare destinations: string[]

    constructor(data: RelocateLocusts) {
        super(data, RelocateLocustsValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        const swarm = state.swarm
        assertExists(swarm, 'No swarm is being resolved')
        const color = swarm.relocators[0]
        assertExists(color, 'No colony is relocating')
        if (state.colony(color).playerId !== this.playerId) {
            throw Error('It is not your turn to relocate')
        }
        const error = relocationError(state, color, swarm.habitatId, this.destinations)
        if (error) {
            throw Error(error)
        }
        relocate(state, this.destinations)
    }
}
