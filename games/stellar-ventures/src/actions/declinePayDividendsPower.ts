import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { pendingPayDividendsPower } from '../operations/corporatePowers.js'

export type DeclinePayDividendsPower = Type.Static<typeof DeclinePayDividendsPower>
export const DeclinePayDividendsPower = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclinePayDividendsPower),
            playerId: Type.String()
        })
    ])
)

export const DeclinePayDividendsPowerValidator = Compile(DeclinePayDividendsPower)

export function isDeclinePayDividendsPower(action?: GameAction): action is DeclinePayDividendsPower {
    return action?.type === ActionType.DeclinePayDividendsPower
}

/**
 * Declines whichever of Deep Space Smuggling / Deep Space Pirates is currently pending for this
 * Pay Dividends instance (see operations/corporatePowers.ts's pendingPayDividendsPower - always
 * unambiguous, since they're offered one at a time). Doesn't discard the declined Power - only
 * "used" (actions/deepSpaceSmuggling.ts / actions/deepSpacePirates.ts) does that - so it's still
 * available on a future Pay Dividends turn. Only closes THIS one instance's offer window
 * (state.payDividendsSmugglingOfferResolved / payDividendsPiratesOfferResolved), reset once this
 * Pay Dividends instance's automatic payout runs - see stateHandlers/payDividends.ts.
 */
export class HydratedDeclinePayDividendsPower
    extends HydratableAction<typeof DeclinePayDividendsPower>
    implements DeclinePayDividendsPower
{
    declare type: ActionType.DeclinePayDividendsPower
    declare playerId: string

    constructor(data: DeclinePayDividendsPower) {
        super(data, DeclinePayDividendsPowerValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeclinePayDividendsPowerInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const pending = pendingPayDividendsPower(state)
        if (pending === 'smuggling') {
            state.payDividendsSmugglingOfferResolved = true
        } else {
            state.payDividendsPiratesOfferResolved = true
        }
    }

    isValidDeclinePayDividendsPower(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeclinePayDividendsPower.canDeclinePayDividendsPower(state, this.playerId)
    }

    reasonDeclinePayDividendsPowerInvalid(
        state: HydratedStellarVenturesGameState
    ): string | undefined {
        return HydratedDeclinePayDividendsPower.reasonDeclinePayDividendsPowerInvalid(
            state,
            this.playerId
        )
    }

    static canDeclinePayDividendsPower(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return (
            HydratedDeclinePayDividendsPower.reasonDeclinePayDividendsPowerInvalid(
                state,
                playerId
            ) === undefined
        )
    }

    static reasonDeclinePayDividendsPowerInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const pending = pendingPayDividendsPower(state)
        if (!pending) {
            return 'No dividend Power decision is currently pending'
        }
        const activeCorporationId = state.activeCorporationId
        if (!activeCorporationId) {
            return 'No Corporation is currently active'
        }
        if (state.getCorporation(activeCorporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may decline this Power'
        }
        return undefined
    }
}
