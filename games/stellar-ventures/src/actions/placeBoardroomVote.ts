import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId } from '../model/corporation.js'
import {
    eligibleBoardroomBattleCorporationIds,
    nextBoardroomVoterId
} from '../operations/boardroomBattle.js'

export type PlaceBoardroomVote = Type.Static<typeof PlaceBoardroomVote>
export const PlaceBoardroomVote = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBoardroomVote),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId),
            amount: Type.Number()
        })
    ])
)

export const PlaceBoardroomVoteValidator = Compile(PlaceBoardroomVote)

export function isPlaceBoardroomVote(action?: GameAction): action is PlaceBoardroomVote {
    return action?.type === ActionType.PlaceBoardroomVote
}

/**
 * Investor Round step 2, Boardroom Battle (rulebook page 18): "Each player has one chance to
 * optionally place any number of their remaining Boardroom Votes on a single Corporation's
 * Status marker. Start with Director and proceed clockwise." Votes come out of the player's pool
 * immediately; whether they're spent for good or returned to the player is decided once every
 * player has had their turn - see operations/boardroomBattle.ts's resolveBoardroomVotes.
 */
export class HydratedPlaceBoardroomVote
    extends HydratableAction<typeof PlaceBoardroomVote>
    implements PlaceBoardroomVote
{
    declare type: ActionType.PlaceBoardroomVote
    declare playerId: string
    declare corporationId: CorporationId
    declare amount: number

    constructor(data: PlaceBoardroomVote) {
        super(data, PlaceBoardroomVoteValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonPlaceBoardroomVoteInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        state.getPlayerState(this.playerId).spendBoardroomVotes(this.amount)

        const votes = state.boardroomBattleVotes ?? []
        votes.push({
            playerId: this.playerId,
            corporationId: this.corporationId,
            amount: this.amount
        })
        state.boardroomBattleVotes = votes

        const voteOrder = state.boardroomBattleVoteOrder
        assertExists(voteOrder, 'Boardroom Battle vote order should be present while voting')
        state.boardroomBattleCurrentVoterId = nextBoardroomVoterId(state, voteOrder, this.playerId)
    }

    isValidPlaceBoardroomVote(state: HydratedStellarVenturesGameState): boolean {
        return HydratedPlaceBoardroomVote.canPlaceBoardroomVote(
            state,
            this.playerId,
            this.corporationId,
            this.amount
        )
    }

    reasonPlaceBoardroomVoteInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedPlaceBoardroomVote.reasonPlaceBoardroomVoteInvalid(
            state,
            this.playerId,
            this.corporationId,
            this.amount
        )
    }

    static canPlaceBoardroomVote(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        amount: number
    ): boolean {
        return (
            HydratedPlaceBoardroomVote.reasonPlaceBoardroomVoteInvalid(
                state,
                playerId,
                corporationId,
                amount
            ) === undefined
        )
    }

    static reasonPlaceBoardroomVoteInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        amount: number
    ): string | undefined {
        if (state.boardroomBattleCurrentVoterId !== playerId) {
            return 'It is not your turn to vote in this Boardroom Battle'
        }
        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1) {
            return 'Vote amount must be a positive whole number'
        }
        // "There must be a Share to issue for a Corporation to be a valid target in the
        // Boardroom Battle" (confirmed by the game's co-designer) - see
        // eligibleBoardroomBattleCorporationIds.
        if (!eligibleBoardroomBattleCorporationIds(state).includes(corporationId)) {
            return 'That Corporation is not eligible to receive Votes'
        }
        if (amount > state.getPlayerState(playerId).boardroomVotes) {
            return 'You do not have that many Boardroom Votes remaining'
        }
        return undefined
    }

    // Coarse-grained check for validActionsForPlayer - is PlaceBoardroomVote available to this
    // player at all right now, regardless of which Corporation or how many Votes they'd choose.
    static canOfferPlaceBoardroomVote(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        if (state.boardroomBattleCurrentVoterId !== playerId) {
            return false
        }
        if (state.getPlayerState(playerId).boardroomVotes <= 0) {
            return false
        }
        return eligibleBoardroomBattleCorporationIds(state).length > 0
    }
}
