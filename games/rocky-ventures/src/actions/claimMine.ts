import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { claimMineAt, claimableMineIds, reasonClaimInvalid } from '../operations/claim.js'

export type ClaimMine = Type.Static<typeof ClaimMine>
export const ClaimMine = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ClaimMine),
            playerId: Type.String(),
            nodeId: Type.String(),
            huntDragon: Type.Optional(Type.Boolean())
        })
    ])
)

export const ClaimMineValidator = Compile(ClaimMine)

export function isClaimMine(action?: GameAction): action is ClaimMine {
    return action?.type === ActionType.ClaimMine
}

export class HydratedClaimMine extends HydratableAction<typeof ClaimMine> implements ClaimMine {
    declare type: ActionType.ClaimMine
    declare playerId: string
    declare nodeId: string
    declare huntDragon?: boolean

    constructor(data: ClaimMine) {
        super(data, ClaimMineValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = reasonClaimInvalid(state, this.playerId, this.nodeId)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        claimMineAt(state, this.playerId, this.nodeId, this.huntDragon ?? false)
    }

    static canClaimMine(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        return claimableMineIds(state, playerId).length > 0
    }
}
