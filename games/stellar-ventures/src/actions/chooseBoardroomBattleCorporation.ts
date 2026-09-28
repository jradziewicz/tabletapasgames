import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId } from '../model/corporation.js'
import { resolveBoardroomVotes } from '../operations/boardroomBattle.js'

export type ChooseBoardroomBattleCorporation = Type.Static<typeof ChooseBoardroomBattleCorporation>
export const ChooseBoardroomBattleCorporation = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseBoardroomBattleCorporation),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId)
        })
    ])
)

export const ChooseBoardroomBattleCorporationValidator = Compile(ChooseBoardroomBattleCorporation)

export function isChooseBoardroomBattleCorporation(
    action?: GameAction
): action is ChooseBoardroomBattleCorporation {
    return action?.type === ActionType.ChooseBoardroomBattleCorporation
}

/**
 * "The Corporation with the most Votes must Issue a Share (Director chooses in case of a tie,
 * including 0 Votes)" - rulebook page 18. Only reachable when Boardroom Battle's vote ends in a
 * tie for the most Votes (state.boardroomBattleTiedCorporationIds), including a tie at 0 if
 * nobody voted at all. Only the Director may choose, and only from among the tied Corporations.
 */
export class HydratedChooseBoardroomBattleCorporation
    extends HydratableAction<typeof ChooseBoardroomBattleCorporation>
    implements ChooseBoardroomBattleCorporation
{
    declare type: ActionType.ChooseBoardroomBattleCorporation
    declare playerId: string
    declare corporationId: CorporationId

    constructor(data: ChooseBoardroomBattleCorporation) {
        super(data, ChooseBoardroomBattleCorporationValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonChooseBoardroomBattleCorporationInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        resolveBoardroomVotes(state, this.corporationId)
    }

    isValidChooseBoardroomBattleCorporation(state: HydratedStellarVenturesGameState): boolean {
        return HydratedChooseBoardroomBattleCorporation.canChooseBoardroomBattleCorporation(
            state,
            this.playerId,
            this.corporationId
        )
    }

    reasonChooseBoardroomBattleCorporationInvalid(
        state: HydratedStellarVenturesGameState
    ): string | undefined {
        return HydratedChooseBoardroomBattleCorporation.reasonChooseBoardroomBattleCorporationInvalid(
            state,
            this.playerId,
            this.corporationId
        )
    }

    static canChooseBoardroomBattleCorporation(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): boolean {
        return (
            HydratedChooseBoardroomBattleCorporation.reasonChooseBoardroomBattleCorporationInvalid(
                state,
                playerId,
                corporationId
            ) === undefined
        )
    }

    static reasonChooseBoardroomBattleCorporationInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): string | undefined {
        if (playerId !== state.directorPlayerId) {
            return 'Only the Director may choose the tied Corporation'
        }
        const tied = state.boardroomBattleTiedCorporationIds
        if (!tied || tied.length < 2) {
            return 'There is no tie to resolve'
        }
        if (!tied.includes(corporationId)) {
            return 'That Corporation is not part of the tie'
        }
        return undefined
    }
}
