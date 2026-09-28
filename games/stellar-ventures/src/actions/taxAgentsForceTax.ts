import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { taxAgentsForceTaxCorporationIds } from '../operations/taxes.js'

export type TaxAgentsForceTax = Type.Static<typeof TaxAgentsForceTax>
export const TaxAgentsForceTax = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TaxAgentsForceTax),
            playerId: Type.String()
        })
    ])
)

export const TaxAgentsForceTaxValidator = Compile(TaxAgentsForceTax)

export function isTaxAgentsForceTax(action?: GameAction): action is TaxAgentsForceTax {
    return action?.type === ActionType.TaxAgentsForceTax
}

export class HydratedTaxAgentsForceTax
    extends HydratableAction<typeof TaxAgentsForceTax>
    implements TaxAgentsForceTax
{
    declare type: ActionType.TaxAgentsForceTax
    declare playerId: string

    constructor(data: TaxAgentsForceTax) {
        super(data, TaxAgentsForceTaxValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = HydratedTaxAgentsForceTax.reasonForceTaxInvalid(state, this.playerId)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        const corporationId = state.taxAgentsCorporationId
        const hexId = state.taxAgentsHexId
        assertExists(corporationId, 'A Tax Agents Corporation should be pending')
        assertExists(hexId, 'A Tax Agents hex should be pending')
        state.taxPayerCorporationIds = taxAgentsForceTaxCorporationIds(state, corporationId, hexId)
        state.taxResumeState = state.taxAgentsResumeState
        state.pendingTaxPaymentBoxBefore = state.taxBox ?? 0
        state.pendingTaxPayments = []
    }

    static canForceTax(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedTaxAgentsForceTax.reasonForceTaxInvalid(state, playerId) === undefined
    }

    static reasonForceTaxInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const corporationId = state.taxAgentsCorporationId
        const hexId = state.taxAgentsHexId
        if (!corporationId || !hexId) {
            return 'No Tax Agents decision is currently pending'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may force this Tax'
        }
        if (taxAgentsForceTaxCorporationIds(state, corporationId, hexId).length === 0) {
            return 'There are no Corporations to force Tax on'
        }
        return undefined
    }
}
