import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type DeclineSignTheAgreement = Type.Static<typeof DeclineSignTheAgreement>
export const DeclineSignTheAgreement = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineSignTheAgreement),
            playerId: Type.String()
        })
    ])
)

export const DeclineSignTheAgreementValidator = Compile(DeclineSignTheAgreement)

export function isDeclineSignTheAgreement(action?: GameAction): action is DeclineSignTheAgreement {
    return action?.type === ActionType.DeclineSignTheAgreement
}

/**
 * The Corporation's President chooses not to Sign The Agreement right now, even though they
 * could - signing is always optional ("may choose to sign"). The Alien Agreement Tile that was
 * offered stays hidden, and this hex is never re-offered again (the Corporation already has an
 * Outpost there, so it can't be built on a second time) - but for Expand Network or Private
 * Contractor, declining does not end the build: the President may keep placing Outposts one at a
 * time, potentially reaching further Alien Planets and being offered again each time, which
 * rewards delaying signing to accumulate a higher Alien Planet Outpost count. See
 * stateHandlers/offerSignTheAgreement.ts.
 */
export class HydratedDeclineSignTheAgreement
    extends HydratableAction<typeof DeclineSignTheAgreement>
    implements DeclineSignTheAgreement
{
    declare type: ActionType.DeclineSignTheAgreement
    declare playerId: string

    constructor(data: DeclineSignTheAgreement) {
        super(data, DeclineSignTheAgreementValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeclineSignTheAgreementInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        // No state to mutate here - declining just moves play on to whatever would have
        // happened next, which the state handler takes care of.
    }

    isValidDeclineSignTheAgreement(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeclineSignTheAgreement.canDeclineSignTheAgreement(state, this.playerId)
    }

    reasonDeclineSignTheAgreementInvalid(
        state: HydratedStellarVenturesGameState
    ): string | undefined {
        return HydratedDeclineSignTheAgreement.reasonDeclineSignTheAgreementInvalid(
            state,
            this.playerId
        )
    }

    static canDeclineSignTheAgreement(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return (
            HydratedDeclineSignTheAgreement.reasonDeclineSignTheAgreementInvalid(
                state,
                playerId
            ) === undefined
        )
    }

    static reasonDeclineSignTheAgreementInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const corporationId = state.signTheAgreementCorporationId
        if (!corporationId) {
            return 'No Sign The Agreement decision is currently pending'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may decline to Sign The Agreement'
        }
        return undefined
    }
}
