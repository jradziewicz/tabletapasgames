import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { taxAgentsTaxBoxTakeAmount } from '../operations/taxes.js'

export type TaxAgentsTakeFromTaxBoxMetadata = Type.Static<typeof TaxAgentsTakeFromTaxBoxMetadata>
export const TaxAgentsTakeFromTaxBoxMetadata = Type.Object({
    amount: Type.Number()
})

export type TaxAgentsTakeFromTaxBox = Type.Static<typeof TaxAgentsTakeFromTaxBox>
export const TaxAgentsTakeFromTaxBox = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TaxAgentsTakeFromTaxBox),
            playerId: Type.String(),
            metadata: Type.Optional(TaxAgentsTakeFromTaxBoxMetadata)
        })
    ])
)

export const TaxAgentsTakeFromTaxBoxValidator = Compile(TaxAgentsTakeFromTaxBox)

export function isTaxAgentsTakeFromTaxBox(action?: GameAction): action is TaxAgentsTakeFromTaxBox {
    return action?.type === ActionType.TaxAgentsTakeFromTaxBox
}

export class HydratedTaxAgentsTakeFromTaxBox
    extends HydratableAction<typeof TaxAgentsTakeFromTaxBox>
    implements TaxAgentsTakeFromTaxBox
{
    declare type: ActionType.TaxAgentsTakeFromTaxBox
    declare playerId: string
    declare metadata?: TaxAgentsTakeFromTaxBoxMetadata

    constructor(data: TaxAgentsTakeFromTaxBox) {
        super(data, TaxAgentsTakeFromTaxBoxValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = HydratedTaxAgentsTakeFromTaxBox.reasonTakeFromTaxBoxInvalid(
            state,
            this.playerId
        )
        if (invalidReason) {
            throw Error(invalidReason)
        }
        const corporationId = state.taxAgentsCorporationId
        assertExists(corporationId, 'A Tax Agents Corporation should be pending')
        const amount = taxAgentsTaxBoxTakeAmount(state)
        state.taxBox = (state.taxBox ?? 0) - amount
        state.getCorporation(corporationId).treasury += amount
        this.metadata = { amount }
    }

    static canTakeFromTaxBox(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return (
            HydratedTaxAgentsTakeFromTaxBox.reasonTakeFromTaxBoxInvalid(state, playerId) ===
            undefined
        )
    }

    static reasonTakeFromTaxBoxInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const corporationId = state.taxAgentsCorporationId
        if (!corporationId) {
            return 'No Tax Agents decision is currently pending'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may take from the Tax Box'
        }
        if (taxAgentsTaxBoxTakeAmount(state) <= 0) {
            return 'There is nothing in the Tax Box to take'
        }
        return undefined
    }
}
