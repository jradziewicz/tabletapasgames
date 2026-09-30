import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { layFreeTrackAt } from '../operations/track.js'

export type LayFreeTrack = Type.Static<typeof LayFreeTrack>
export const LayFreeTrack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LayFreeTrack),
            playerId: Type.String(),
            boxId: Type.Optional(Type.String())
        })
    ])
)

export const LayFreeTrackValidator = Compile(LayFreeTrack)

export function isLayFreeTrack(action?: GameAction): action is LayFreeTrack {
    return action?.type === ActionType.LayFreeTrack
}

export class HydratedLayFreeTrack extends HydratableAction<typeof LayFreeTrack> implements LayFreeTrack {
    declare type: ActionType.LayFreeTrack
    declare playerId: string
    declare boxId?: string

    constructor(data: LayFreeTrack) {
        super(data, LayFreeTrackValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        if (!state.freeTrack) {
            throw Error('There is no free track to lay')
        }
        if (!state.activePlayerIds.includes(this.playerId)) {
            throw Error('It is not your turn')
        }
        if (this.boxId === undefined) {
            state.freeTrack.remaining = 0
            return
        }
        layFreeTrackAt(state, this.playerId, this.boxId)
    }
}
