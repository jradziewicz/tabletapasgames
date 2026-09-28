import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { pendingPayDividendsPower } from '../operations/corporatePowers.js'

export type DeepSpaceSmuggling = Type.Static<typeof DeepSpaceSmuggling>
export const DeepSpaceSmuggling = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeepSpaceSmuggling),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId)
        })
    ])
)

export const DeepSpaceSmugglingValidator = Compile(DeepSpaceSmuggling)

export function isDeepSpaceSmuggling(action?: GameAction): action is DeepSpaceSmuggling {
    return action?.type === ActionType.DeepSpaceSmuggling
}

/**
 * Deep Space Smuggling (Corporate Power Glossary, page 29): "Pay Dividends, One-Time. Copy
 * another Corporation's CARGO when determining Dividends. Discard after use." Offered right at
 * the start of the active Corporation's own Pay Dividends step, before the automatic payout runs
 * - see operations/corporatePowers.ts's pendingPayDividendsPower and
 * stateHandlers/payDividends.ts. Sets state.payDividendsCopyCargoFromCorporationId, read (and
 * cleared) by actions/payDividends.ts when it actually computes the payout.
 */
export class HydratedDeepSpaceSmuggling
    extends HydratableAction<typeof DeepSpaceSmuggling>
    implements DeepSpaceSmuggling
{
    declare type: ActionType.DeepSpaceSmuggling
    declare playerId: string
    declare corporationId: CorporationId

    constructor(data: DeepSpaceSmuggling) {
        super(data, DeepSpaceSmugglingValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeepSpaceSmugglingInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const activeCorporationId = state.activeCorporationId
        assertExists(
            activeCorporationId,
            'Active corporation id should be present while using Deep Space Smuggling'
        )
        const corporation = state.getCorporation(activeCorporationId)

        state.payDividendsCopyCargoFromCorporationId = this.corporationId
        state.payDividendsSmugglingOfferResolved = true
        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.DeepSpaceSmuggling
        )
    }

    isValidDeepSpaceSmuggling(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeepSpaceSmuggling.canDeepSpaceSmuggling(
            state,
            this.playerId,
            this.corporationId
        )
    }

    reasonDeepSpaceSmugglingInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDeepSpaceSmuggling.reasonDeepSpaceSmugglingInvalid(
            state,
            this.playerId,
            this.corporationId
        )
    }

    static canDeepSpaceSmuggling(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): boolean {
        return (
            HydratedDeepSpaceSmuggling.reasonDeepSpaceSmugglingInvalid(
                state,
                playerId,
                corporationId
            ) === undefined
        )
    }

    static reasonDeepSpaceSmugglingInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): string | undefined {
        if (pendingPayDividendsPower(state) !== 'smuggling') {
            return 'Deep Space Smuggling is not currently available'
        }
        const activeCorporationId = state.activeCorporationId
        if (!activeCorporationId) {
            return 'No Corporation is currently active'
        }
        if (state.getCorporation(activeCorporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may use Deep Space Smuggling'
        }
        if (corporationId === activeCorporationId) {
            return 'Cannot copy CARGO from your own Corporation'
        }
        const target = state.corporations.find((candidate) => candidate.id === corporationId)
        if (!(target?.active ?? false)) {
            return 'That Corporation is not active'
        }
        return undefined
    }

    // Whether to even offer DeepSpaceSmuggling as an option - used by the state handler's
    // validActionsForPlayer, without knowing which target Corporation a player might choose.
    static canOfferDeepSpaceSmuggling(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        if (pendingPayDividendsPower(state) !== 'smuggling') {
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
