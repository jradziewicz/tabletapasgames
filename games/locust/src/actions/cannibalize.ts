import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ActionKind } from '../data/board.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { Attack, cannibalizeError } from '../operations/rules.js'
import { actingColony, pendingActionOf } from '../operations/turn.js'

export type Cannibalize = Type.Static<typeof Cannibalize>
export const Cannibalize = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Cannibalize),
            playerId: Type.String(),
            attacks: Type.Array(Attack)
        })
    ])
)

export const CannibalizeValidator = Compile(Cannibalize)

export function isCannibalize(action?: GameAction): action is Cannibalize {
    return action?.type === ActionType.Cannibalize
}

export class HydratedCannibalize
    extends HydratableAction<typeof Cannibalize>
    implements Cannibalize
{
    declare type: ActionType.Cannibalize
    declare playerId: string
    declare attacks: Attack[]

    constructor(data: Cannibalize) {
        super(data, CannibalizeValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        const colony = actingColony(state, this.playerId)
        const pending = pendingActionOf(state, ActionKind.Cannibalize)
        const error = cannibalizeError(state, colony.color, pending, this.attacks)
        if (error) {
            throw Error(error)
        }
        for (const attack of this.attacks) {
            for (const victim of attack.victims) {
                state.board.remove(attack.habitatId, victim.color, victim.kind, victim.count)
                state.colony(victim.color).die(victim.count)
            }
        }
    }
}
