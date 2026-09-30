import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { anyHuntableRegion, reasonHuntInvalid, startHunt } from '../operations/hunt.js'
import { CardActionKind } from '../data/cards.js'

export type Hunt = Type.Static<typeof Hunt>
export const Hunt = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Hunt),
            playerId: Type.String(),
            region: Type.String()
        })
    ])
)

export const HuntValidator = Compile(Hunt)

export function isHunt(action?: GameAction): action is Hunt {
    return action?.type === ActionType.Hunt
}

export class HydratedHunt extends HydratableAction<typeof Hunt> implements Hunt {
    declare type: ActionType.Hunt
    declare playerId: string
    declare region: string

    constructor(data: Hunt) {
        super(data, HuntValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = reasonHuntInvalid(state, this.playerId, this.region)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        startHunt(state, this.playerId, this.region, CardActionKind.Hunt)
    }

    static canHunt(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        return anyHuntableRegion(state, playerId)
    }
}
