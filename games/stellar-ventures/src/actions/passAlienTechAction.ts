import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PassAlienTechAction = Type.Static<typeof PassAlienTechAction>
export const PassAlienTechAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassAlienTechAction),
            playerId: Type.String()
        })
    ])
)

export const PassAlienTechActionValidator = Compile(PassAlienTechAction)

export function isPassAlienTechAction(action?: GameAction): action is PassAlienTechAction {
    return action?.type === ActionType.PassAlienTechAction
}

/**
 * Declines to take an Alien Tech Action this Investor Round (rulebook page 19): "Must move
 * Action Disc to a new action or pass, removing the Action Disc from the board." Removing the
 * disc clears playerState.lastAlienTechActionId, so every Alien Tech Action is available to this
 * player again next Investor Round. Always available, regardless of the disc's current position.
 */
export class HydratedPassAlienTechAction
    extends HydratableAction<typeof PassAlienTechAction>
    implements PassAlienTechAction
{
    declare type: ActionType.PassAlienTechAction
    declare playerId: string

    constructor(data: PassAlienTechAction) {
        super(data, PassAlienTechActionValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonPassAlienTechActionInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        state.getPlayerState(this.playerId).lastAlienTechActionId = undefined
    }

    isValidPassAlienTechAction(state: HydratedStellarVenturesGameState): boolean {
        return HydratedPassAlienTechAction.canPassAlienTechAction(state, this.playerId)
    }

    reasonPassAlienTechActionInvalid(
        state: HydratedStellarVenturesGameState
    ): string | undefined {
        return HydratedPassAlienTechAction.reasonPassAlienTechActionInvalid(state, this.playerId)
    }

    static canPassAlienTechAction(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return (
            HydratedPassAlienTechAction.reasonPassAlienTechActionInvalid(state, playerId) ===
            undefined
        )
    }

    static reasonPassAlienTechActionInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        return undefined
    }
}
