import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ActionKind } from '../data/board.js'
import { InsectKind } from '../model/board.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { breedError } from '../operations/rules.js'
import { actingColony, pendingActionOf } from '../operations/turn.js'

export type Breed = Type.Static<typeof Breed>
export const Breed = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Breed),
            playerId: Type.String(),
            habitatIds: Type.Array(Type.String())
        })
    ])
)

export const BreedValidator = Compile(Breed)

export function isBreed(action?: GameAction): action is Breed {
    return action?.type === ActionType.Breed
}

export class HydratedBreed extends HydratableAction<typeof Breed> implements Breed {
    declare type: ActionType.Breed
    declare playerId: string
    declare habitatIds: string[]

    constructor(data: Breed) {
        super(data, BreedValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        const colony = actingColony(state, this.playerId)
        const pending = pendingActionOf(state, ActionKind.JumpOrBreed)
        const error = breedError(state, colony.color, pending, this.habitatIds)
        if (error) {
            throw Error(error)
        }
        for (const habitatId of this.habitatIds) {
            colony.takeFromSupply(1)
            state.board.add(habitatId, colony.color, InsectKind.Nymph)
        }
    }
}
