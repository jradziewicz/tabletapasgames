import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { pendingPayDividendsPower } from '../operations/corporatePowers.js'

export type DeepSpacePirates = Type.Static<typeof DeepSpacePirates>
export const DeepSpacePirates = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeepSpacePirates),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId)
        })
    ])
)

export const DeepSpacePiratesValidator = Compile(DeepSpacePirates)

export function isDeepSpacePirates(action?: GameAction): action is DeepSpacePirates {
    return action?.type === ActionType.DeepSpacePirates
}

/**
 * Deep Space Pirates (Corporate Power Glossary, page 29): "Pay Dividends, One-Time. Copy another
 * Corporation's Mining Capacity when determining Dividends. Discard after use." Offered right at
 * the start of the active Corporation's own Pay Dividends step (after Deep Space Smuggling, if
 * both are somehow held - see operations/corporatePowers.ts's pendingPayDividendsPower), before
 * the automatic payout runs - see stateHandlers/payDividends.ts. Sets
 * state.payDividendsCopyMiningCapacityFromCorporationId, read (and cleared) by
 * actions/payDividends.ts when it actually computes the payout.
 */
export class HydratedDeepSpacePirates
    extends HydratableAction<typeof DeepSpacePirates>
    implements DeepSpacePirates
{
    declare type: ActionType.DeepSpacePirates
    declare playerId: string
    declare corporationId: CorporationId

    constructor(data: DeepSpacePirates) {
        super(data, DeepSpacePiratesValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeepSpacePiratesInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const activeCorporationId = state.activeCorporationId
        assertExists(
            activeCorporationId,
            'Active corporation id should be present while using Deep Space Pirates'
        )
        const corporation = state.getCorporation(activeCorporationId)

        state.payDividendsCopyMiningCapacityFromCorporationId = this.corporationId
        state.payDividendsPiratesOfferResolved = true
        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.DeepSpacePirates
        )
    }

    isValidDeepSpacePirates(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeepSpacePirates.canDeepSpacePirates(state, this.playerId, this.corporationId)
    }

    reasonDeepSpacePiratesInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDeepSpacePirates.reasonDeepSpacePiratesInvalid(
            state,
            this.playerId,
            this.corporationId
        )
    }

    static canDeepSpacePirates(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): boolean {
        return (
            HydratedDeepSpacePirates.reasonDeepSpacePiratesInvalid(
                state,
                playerId,
                corporationId
            ) === undefined
        )
    }

    static reasonDeepSpacePiratesInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): string | undefined {
        if (pendingPayDividendsPower(state) !== 'pirates') {
            return 'Deep Space Pirates is not currently available'
        }
        const activeCorporationId = state.activeCorporationId
        if (!activeCorporationId) {
            return 'No Corporation is currently active'
        }
        if (state.getCorporation(activeCorporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may use Deep Space Pirates'
        }
        if (corporationId === activeCorporationId) {
            return 'Cannot copy Mining Capacity from your own Corporation'
        }
        const target = state.corporations.find((candidate) => candidate.id === corporationId)
        if (!(target?.active ?? false)) {
            return 'That Corporation is not active'
        }
        return undefined
    }

    // Whether to even offer DeepSpacePirates as an option - used by the state handler's
    // validActionsForPlayer, without knowing which target Corporation a player might choose.
    static canOfferDeepSpacePirates(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        if (pendingPayDividendsPower(state) !== 'pirates') {
            return false
        }
        const activeCorporationId = state.activeCorporationId
        if (!activeCorporationId) {
            return false
        }
        if (state.getCorporation(activeCorporationId).getPresidentPlayerId() !== playerId) {
            return false
        }
        return state.corporations.some(
            (corporation) => corporation.active && corporation.id !== activeCorporationId
        )
    }
}
