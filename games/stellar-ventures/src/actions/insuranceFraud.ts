import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId } from '../model/corporation.js'
import { InvestorActionId } from '../model/investorBoard.js'
import { canSelectInvestorActionId } from '../operations/investorShenanigans.js'
import { shipCost } from '../operations/shipOrdering.js'

export type InsuranceFraud = Type.Static<typeof InsuranceFraud>
export const InsuranceFraud = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.InsuranceFraud),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId),
            shipLevel: Type.Number()
        })
    ])
)

export const InsuranceFraudValidator = Compile(InsuranceFraud)

export function isInsuranceFraud(action?: GameAction): action is InsuranceFraud {
    return action?.type === ActionType.InsuranceFraud
}

/**
 * Investor Shenanigans' Insurance Fraud Investor Action (rulebook page 19): "If President, Scrap
 * a Corporation's Delivered Ship for its cost, reimbursed into Corporate Treasury. Limit 1
 * Ship." Unlike Jerry-Rig and Private Contractor, this one does require the acting player to be
 * the target Corporation's President specifically. The Ship's "cost" is the same level-equals-
 * cost formula used to Order it (operations/shipOrdering.ts's shipCost) - reimbursed straight
 * into the Corporate Treasury. Removing a Delivered Ship also reduces CARGO by 1 (floor 0), same
 * as a Scrapping Event (see operations/shipOrdering.ts's applyScrappingEvent).
 */
export class HydratedInsuranceFraud
    extends HydratableAction<typeof InsuranceFraud>
    implements InsuranceFraud
{
    declare type: ActionType.InsuranceFraud
    declare playerId: string
    declare corporationId: CorporationId
    declare shipLevel: number

    constructor(data: InsuranceFraud) {
        super(data, InsuranceFraudValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonInsuranceFraudInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporation = state.getCorporation(this.corporationId)
        const index = corporation.deliveredShipLevels.indexOf(this.shipLevel)
        corporation.deliveredShipLevels.splice(index, 1)
        corporation.cargo = Math.max(0, corporation.cargo - 1)
        corporation.treasury += shipCost(this.shipLevel)

        state.getPlayerState(this.playerId).lastInvestorActionId = InvestorActionId.InsuranceFraud
    }

    isValidInsuranceFraud(state: HydratedStellarVenturesGameState): boolean {
        return HydratedInsuranceFraud.canInsuranceFraud(
            state,
            this.playerId,
            this.corporationId,
            this.shipLevel
        )
    }

    reasonInsuranceFraudInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedInsuranceFraud.reasonInsuranceFraudInvalid(
            state,
            this.playerId,
            this.corporationId,
            this.shipLevel
        )
    }

    static canInsuranceFraud(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        shipLevel: number
    ): boolean {
        return (
            HydratedInsuranceFraud.reasonInsuranceFraudInvalid(
                state,
                playerId,
                corporationId,
                shipLevel
            ) === undefined
        )
    }

    static reasonInsuranceFraudInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        shipLevel: number
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        if (!canSelectInvestorActionId(state, playerId, InvestorActionId.InsuranceFraud)) {
            return 'Insurance Fraud is not available right now'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President of that Corporation may commit Insurance Fraud'
        }
        if (!corporation.deliveredShipLevels.includes(shipLevel)) {
            return 'That Corporation has no Delivered Ship of that level'
        }
        return undefined
    }

    // Whether to even offer InsuranceFraud as an option (for any Corporation, at any level) -
    // used by the state handler's validActionsForPlayer.
    static canOfferInsuranceFraud(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return false
        }
        if (!canSelectInvestorActionId(state, playerId, InvestorActionId.InsuranceFraud)) {
            return false
        }
        return state.corporations.some(
            (corporation) =>
                corporation.getPresidentPlayerId() === playerId &&
                corporation.deliveredShipLevels.length > 0
        )
    }
}
