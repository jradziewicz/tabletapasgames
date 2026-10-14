import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { BonusToken } from '../data/board.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { legalCubeSpaceIds, pendingActionFor } from '../operations/rules.js'
import { actingColony } from '../operations/turn.js'

export type PlaceCube = Type.Static<typeof PlaceCube>
export const PlaceCube = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceCube),
            playerId: Type.String(),
            spaceId: Type.String(),
            alternative: Type.Boolean(),
            metadata: Type.Optional(
                Type.Object({
                    fromSpaceId: Type.String(),
                    bonusToken: Type.Optional(Type.Enum(BonusToken))
                })
            )
        })
    ])
)

export const PlaceCubeValidator = Compile(PlaceCube)

export function isPlaceCube(action?: GameAction): action is PlaceCube {
    return action?.type === ActionType.PlaceCube
}

export class HydratedPlaceCube extends HydratableAction<typeof PlaceCube> implements PlaceCube {
    declare type: ActionType.PlaceCube
    declare playerId: string
    declare spaceId: string
    declare alternative: boolean
    declare metadata?: { fromSpaceId: string; bonusToken?: BonusToken }

    constructor(data: PlaceCube) {
        super(data, PlaceCubeValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        const colony = actingColony(state, this.playerId)
        if (!legalCubeSpaceIds(state).includes(this.spaceId)) {
            throw Error(`Cannot move the cube to ${this.spaceId}`)
        }
        if (this.alternative && !state.isAlternativeActionAvailable()) {
            throw Error('The Alternative Action is not available')
        }
        const fromSpaceId = state.nextCubeSpaceId()
        if (fromSpaceId === undefined) {
            throw Error('No cube left in the Active Region')
        }
        state.pendingAction = pendingActionFor(state, this.spaceId, this.alternative)
        state.board.removeCube(fromSpaceId)
        state.board.placeCube(this.spaceId, colony.color)
        const bonusToken = state.board.takeBonusToken(this.spaceId)
        if (bonusToken) {
            colony.tokens.push(bonusToken)
        }
        this.metadata = { fromSpaceId, bonusToken }
    }
}
