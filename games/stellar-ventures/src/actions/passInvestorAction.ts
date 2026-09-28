import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PassInvestorAction = Type.Static<typeof PassInvestorAction>
export const PassInvestorAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassInvestorAction),
            playerId: Type.String()
        })
    ])
)

export const PassInvestorActionValidator = Compile(PassInvestorAction)

export function isPassInvestorAction(action?: GameAction): action is PassInvestorAction {
    return action?.type === ActionType.PassInvestorAction
}

/**
 * Declines to take an Investor Action this Investor Round (rulebook page 19): "Must move Action
 * Disc to a new action or pass, removing the Action Disc from the board." Removing the disc
 * clears playerState.lastInvestorActionId, so every Investor Action is available to this player
 * again next Investor Round. Always available, regardless of the disc's current position.
 */
export class HydratedPassInvestorAction
    extends HydratableAction<typeof PassInvestorAction>
    implements PassInvestorAction
{
    declare type: ActionType.PassInvestorAction
    declare playerId: string

    constructor(data: PassInvestorAction) {
        super(data, PassInvestorActionValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonPassInvestorActionInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        state.getPlayerState(this.playerId).lastInvestorActionId = undefined
    }

    isValidPassInvestorAction(state: HydratedStellarVenturesGameState): boolean {
        return HydratedPassInvestorAction.canPassInvestorAction(state, this.playerId)
    }

    reasonPassInvestorActionInvalid(
        state: HydratedStellarVenturesGameState
    ): string | undefined {
        return HydratedPassInvestorAction.reasonPassInvestorActionInvalid(state, this.playerId)
    }

    static canPassInvestorAction(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return (
            HydratedPassInvestorAction.reasonPassInvestorActionInvalid(state, playerId) ===
            undefined
        )
    }

    static reasonPassInvestorActionInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        return undefined
    }
}
