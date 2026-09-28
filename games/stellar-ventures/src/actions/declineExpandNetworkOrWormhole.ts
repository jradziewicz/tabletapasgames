import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type DeclineExpandNetworkOrWormhole = Type.Static<typeof DeclineExpandNetworkOrWormhole>
export const DeclineExpandNetworkOrWormhole = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineExpandNetworkOrWormhole),
            playerId: Type.String()
        })
    ])
)

export const DeclineExpandNetworkOrWormholeValidator = Compile(DeclineExpandNetworkOrWormhole)

export function isDeclineExpandNetworkOrWormhole(
    action?: GameAction
): action is DeclineExpandNetworkOrWormhole {
    return action?.type === ActionType.DeclineExpandNetworkOrWormhole
}

/**
 * The Corporation's President chooses not to Expand Network or Create Wormhole this round.
 * This step is always optional, per the rulebook.
 */
export class HydratedDeclineExpandNetworkOrWormhole
    extends HydratableAction<typeof DeclineExpandNetworkOrWormhole>
    implements DeclineExpandNetworkOrWormhole
{
    declare type: ActionType.DeclineExpandNetworkOrWormhole
    declare playerId: string

    constructor(data: DeclineExpandNetworkOrWormhole) {
        super(data, DeclineExpandNetworkOrWormholeValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeclineExpandNetworkOrWormholeInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        // No state to mutate here - declining just moves the Corporation Round on to the next
        // step, which the state handler takes care of.
    }

    isValidDeclineExpandNetworkOrWormhole(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeclineExpandNetworkOrWormhole.canDeclineExpandNetworkOrWormhole(
            state,
            this.playerId
        )
    }

    reasonDeclineExpandNetworkOrWormholeInvalid(
        state: HydratedStellarVenturesGameState
    ): string | undefined {
        return HydratedDeclineExpandNetworkOrWormhole.reasonDeclineExpandNetworkOrWormholeInvalid(
            state,
            this.playerId
        )
    }

    static canDeclineExpandNetworkOrWormhole(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return (
            HydratedDeclineExpandNetworkOrWormhole.reasonDeclineExpandNetworkOrWormholeInvalid(
                state,
                playerId
            ) === undefined
        )
    }

    static reasonDeclineExpandNetworkOrWormholeInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return 'No Corporation is currently active'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may decline to Expand Network or Create Wormhole'
        }
        return undefined
    }
}
