import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CompanyId } from '../data/companies.js'
import { anyBuildableBox, layTrackAt, reasonLayTrackInvalid } from '../operations/track.js'

export type LayTrack = Type.Static<typeof LayTrack>
export const LayTrack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LayTrack),
            playerId: Type.String(),
            companyId: Type.Enum(CompanyId),
            boxId: Type.String()
        })
    ])
)

export const LayTrackValidator = Compile(LayTrack)

export function isLayTrack(action?: GameAction): action is LayTrack {
    return action?.type === ActionType.LayTrack
}

export class HydratedLayTrack extends HydratableAction<typeof LayTrack> implements LayTrack {
    declare type: ActionType.LayTrack
    declare playerId: string
    declare companyId: CompanyId
    declare boxId: string

    constructor(data: LayTrack) {
        super(data, LayTrackValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = reasonLayTrackInvalid(state, this.playerId, this.companyId, this.boxId)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        layTrackAt(state, this.companyId, this.boxId)
    }

    static canLayTrack(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        return state.activePlayerIds.includes(playerId) && anyBuildableBox(state)
    }
}
