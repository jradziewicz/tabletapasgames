import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { nextBoardroomVoterId } from '../operations/boardroomBattle.js'

export type DeclineBoardroomVote = Type.Static<typeof DeclineBoardroomVote>
export const DeclineBoardroomVote = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineBoardroomVote),
            playerId: Type.String()
        })
    ])
)

export const DeclineBoardroomVoteValidator = Compile(DeclineBoardroomVote)

export function isDeclineBoardroomVote(action?: GameAction): action is DeclineBoardroomVote {
    return action?.type === ActionType.DeclineBoardroomVote
}

/**
 * The player chooses not to place any Boardroom Votes this Boardroom Battle. Placing Votes is
 * always optional, per the rulebook - a player may also simply have none left to place.
 */
export class HydratedDeclineBoardroomVote
    extends HydratableAction<typeof DeclineBoardroomVote>
    implements DeclineBoardroomVote
{
    declare type: ActionType.DeclineBoardroomVote
    declare playerId: string

    constructor(data: DeclineBoardroomVote) {
        super(data, DeclineBoardroomVoteValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeclineBoardroomVoteInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const voteOrder = state.boardroomBattleVoteOrder
        assertExists(voteOrder, 'Boardroom Battle vote order should be present while voting')
        state.boardroomBattleCurrentVoterId = nextBoardroomVoterId(state, voteOrder, this.playerId)
    }

    isValidDeclineBoardroomVote(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeclineBoardroomVote.canDeclineBoardroomVote(state, this.playerId)
    }

    reasonDeclineBoardroomVoteInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDeclineBoardroomVote.reasonDeclineBoardroomVoteInvalid(state, this.playerId)
    }

    static canDeclineBoardroomVote(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return HydratedDeclineBoardroomVote.reasonDeclineBoardroomVoteInvalid(state, playerId) === undefined
    }

    static reasonDeclineBoardroomVoteInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.boardroomBattleCurrentVoterId !== playerId) {
            return "It is not your turn to vote in this Boardroom Battle"
        }
        return undefined
    }
}
