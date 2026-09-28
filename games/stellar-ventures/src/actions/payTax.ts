import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { CorporationId } from '../model/corporation.js'
import { ActionType } from '../definition/actions.js'
import { builtOutpostHexIds, payTax, taxLoanHexesNeeded } from '../operations/taxes.js'

export type PayTaxMetadata = Type.Static<typeof PayTaxMetadata>
export const PayTaxMetadata = Type.Object({
    amount: Type.Number(),
    loans: Type.Number()
})

export type PayTax = Type.Static<typeof PayTax>
export const PayTax = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.PayTax),
            corporationId: Type.Enum(CorporationId),
            hexIds: Type.Array(Type.String()),
            metadata: Type.Optional(PayTaxMetadata)
        })
    ])
)

export const PayTaxValidator = Compile(PayTax)

export function isPayTax(action?: GameAction): action is PayTax {
    return action?.type === ActionType.PayTax
}

export class HydratedPayTax extends HydratableAction<typeof PayTax> implements PayTax {
    declare type: ActionType.PayTax
    declare corporationId: CorporationId
    declare hexIds: string[]
    declare metadata?: PayTaxMetadata

    constructor(data: PayTax) {
        super(data, PayTaxValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = HydratedPayTax.reasonPayTaxInvalid(
            state,
            this.playerId,
            this.corporationId,
            this.hexIds
        )
        if (invalidReason) {
            throw Error(invalidReason)
        }
        this.metadata = payTax(state, this.corporationId, this.hexIds)
        state.pendingTaxPayments = [
            ...(state.pendingTaxPayments ?? []),
            { corporationId: this.corporationId, amount: this.metadata.amount, loans: this.metadata.loans }
        ]
        state.taxPayerCorporationIds = (state.taxPayerCorporationIds ?? []).slice(1)
    }

    static pendingTaxPayerCorporationId(
        state: HydratedStellarVenturesGameState
    ): CorporationId | undefined {
        return state.taxPayerCorporationIds?.[0]
    }

    static needsLoanChoice(state: HydratedStellarVenturesGameState): boolean {
        const corporationId = HydratedPayTax.pendingTaxPayerCorporationId(state)
        return !!corporationId && taxLoanHexesNeeded(state, corporationId) > 0
    }

    static canPayTax(
        state: HydratedStellarVenturesGameState,
        playerId: string | undefined,
        corporationId: CorporationId,
        hexIds: string[]
    ): boolean {
        return (
            HydratedPayTax.reasonPayTaxInvalid(state, playerId, corporationId, hexIds) === undefined
        )
    }

    static reasonPayTaxInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string | undefined,
        corporationId: CorporationId,
        hexIds: string[]
    ): string | undefined {
        if (HydratedPayTax.pendingTaxPayerCorporationId(state) !== corporationId) {
            return "It is not this Corporation's turn to pay Tax"
        }
        const hexesNeeded = taxLoanHexesNeeded(state, corporationId)
        if (hexIds.length !== hexesNeeded) {
            return `Exactly ${hexesNeeded} Outpost${hexesNeeded === 1 ? '' : 's'} must be selected for Loans`
        }
        if (hexesNeeded === 0) {
            return undefined
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may pay this Tax'
        }
        const ownedHexIds = builtOutpostHexIds(state, corporationId)
        if (new Set(hexIds).size !== hexIds.length) {
            return 'The same hex was selected more than once'
        }
        if (!hexIds.every((hexId) => ownedHexIds.includes(hexId))) {
            return "One or more selected hexes don't have this Corporation's Outpost"
        }
        return undefined
    }

    static canSelectLoanHex(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string,
        selectedHexIds: string[]
    ): boolean {
        const corporationId = HydratedPayTax.pendingTaxPayerCorporationId(state)
        if (!corporationId) {
            return false
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return false
        }
        if (selectedHexIds.includes(hexId)) {
            return false
        }
        if (selectedHexIds.length >= taxLoanHexesNeeded(state, corporationId)) {
            return false
        }
        return builtOutpostHexIds(state, corporationId).includes(hexId)
    }
}
