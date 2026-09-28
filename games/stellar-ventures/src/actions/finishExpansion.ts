import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type FinishExpansion = Type.Static<typeof FinishExpansion>
export const FinishExpansion = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FinishExpansion),
            playerId: Type.String()
        })
    ])
)

export const FinishExpansionValidator = Compile(FinishExpansion)

export function isFinishExpansion(action?: GameAction): action is FinishExpansion {
    return action?.type === ActionType.FinishExpansion
}

/**
 * Stops an in-progress, one-Outpost-at-a-time Private Contractor build (rulebook page 19) that
 * the acting Investor no longer wants to continue - Private Contractor may build "1-5 Outposts",
 * so stopping early (after at least 1) is always allowed; this action only becomes valid once at
 * least one Outpost has actually been built (see HydratedPrivateContractor.apply, which is what
 * sets state.expandingKind in the first place). This is Private Contractor's equivalent of
 * DeclineExpandNetworkOrWormhole (Expand Network's Corporation Round counterpart), needed as its
 * own action here since Investor Shenanigans has no other action that already means "stop
 * building" - unlike the Corporation Round, where declining the whole ExpandNetworkOrWormhole
 * step doubles as that signal (see stateHandlers/expandNetworkOrWormhole.ts). The state handler
 * charges the accumulated cost as a lump sum via operations/network.ts's finalizeExpansion,
 * exactly like signing or a Corporation Round decline would.
 */
export class HydratedFinishExpansion
    extends HydratableAction<typeof FinishExpansion>
    implements FinishExpansion
{
    declare type: ActionType.FinishExpansion
    declare playerId: string

    constructor(data: FinishExpansion) {
        super(data, FinishExpansionValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonFinishExpansionInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        // No state to mutate here - the state handler finalizes the in-progress build.
    }

    isValidFinishExpansion(state: HydratedStellarVenturesGameState): boolean {
        return HydratedFinishExpansion.canFinishExpansion(state, this.playerId)
    }

    reasonFinishExpansionInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedFinishExpansion.reasonFinishExpansionInvalid(state, this.playerId)
    }

    static canFinishExpansion(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedFinishExpansion.reasonFinishExpansionInvalid(state, playerId) === undefined
    }

    static reasonFinishExpansionInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        if (
            state.expandingKind !== ActionType.PrivateContractor ||
            state.expandingBuilderId !== playerId
        ) {
            return 'No Private Contractor build is currently in progress'
        }
        return undefined
    }
}
