import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type DeclineIssueShare = Type.Static<typeof DeclineIssueShare>
export const DeclineIssueShare = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineIssueShare),
            playerId: Type.String()
        })
    ])
)

export const DeclineIssueShareValidator = Compile(DeclineIssueShare)

export function isDeclineIssueShare(action?: GameAction): action is DeclineIssueShare {
    return action?.type === ActionType.DeclineIssueShare
}

/**
 * The Corporation's President chooses NOT to issue a share this round. Issuing a share is
 * always optional for the President, per the rulebook.
 */
export class HydratedDeclineIssueShare
    extends HydratableAction<typeof DeclineIssueShare>
    implements DeclineIssueShare
{
    declare type: ActionType.DeclineIssueShare
    declare playerId: string

    constructor(data: DeclineIssueShare) {
        super(data, DeclineIssueShareValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeclineIssueShareInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        // No state to mutate here - declining just moves the Corporation Round on to the next
        // step, which the state handler takes care of.
    }

    isValidDeclineIssueShare(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeclineIssueShare.canDeclineIssueShare(state, this.playerId)
    }

    reasonDeclineIssueShareInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDeclineIssueShare.reasonDeclineIssueShareInvalid(state, this.playerId)
    }

    static canDeclineIssueShare(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return HydratedDeclineIssueShare.reasonDeclineIssueShareInvalid(state, playerId) === undefined
    }

    static reasonDeclineIssueShareInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.activeShareAuction) {
            return 'A Share Auction is in progress'
        }
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return 'No Corporation is currently active'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may decline to Issue a Share'
        }
        return undefined
    }
}
