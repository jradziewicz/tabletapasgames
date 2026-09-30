import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { pawnMoveCost, reasonPawnMoveInvalid, skippedIndexes } from '../operations/pawn.js'

export type MovePawn = Type.Static<typeof MovePawn>
export const MovePawn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MovePawn),
            playerId: Type.String(),
            targetIndex: Type.Number(),
            discardIndexes: Type.Array(Type.Number())
        })
    ])
)

export const MovePawnValidator = Compile(MovePawn)

export function isMovePawn(action?: GameAction): action is MovePawn {
    return action?.type === ActionType.MovePawn
}

export class HydratedMovePawn extends HydratableAction<typeof MovePawn> implements MovePawn {
    declare type: ActionType.MovePawn
    declare playerId: string
    declare targetIndex: number
    declare discardIndexes: number[]

    constructor(data: MovePawn) {
        super(data, MovePawnValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = HydratedMovePawn.reasonMovePawnInvalid(
            state,
            this.playerId,
            this.targetIndex,
            this.discardIndexes
        )
        if (invalidReason) {
            throw Error(invalidReason)
        }
        const player = state.getPlayerState(this.playerId)
        const skipped = skippedIndexes(player, this.targetIndex) ?? []
        player.spendMoney(pawnMoveCost(player, skipped.length, this.discardIndexes.length))
        const removed = [...this.discardIndexes].sort((a, b) => b - a)
        for (const index of removed) {
            player.tableau.splice(index, 1)
        }
        player.pawnIndex = this.targetIndex - removed.length
        state.turnActionsTaken = []
        state.turnTrackCompanies = []
        state.turnOver = false
        delete state.borrowedCardId
        delete state.turnCopied
    }

    static reasonMovePawnInvalid(
        state: HydratedRockyVenturesGameState,
        playerId: string,
        targetIndex: number,
        discardIndexes: number[]
    ): string | undefined {
        if (!state.activePlayerIds.includes(playerId)) {
            return 'It is not your turn'
        }
        return reasonPawnMoveInvalid(state.getPlayerState(playerId), targetIndex, discardIndexes)
    }
}
