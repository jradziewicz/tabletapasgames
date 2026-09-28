import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedTaxAgentsForceTax,
    isTaxAgentsForceTax
} from '../actions/taxAgentsForceTax.js'
import {
    HydratedTaxAgentsTakeFromTaxBox,
    isTaxAgentsTakeFromTaxBox
} from '../actions/taxAgentsTakeFromTaxBox.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

type OfferTaxAgentsChoiceAction = HydratedTaxAgentsForceTax | HydratedTaxAgentsTakeFromTaxBox

export class OfferTaxAgentsChoiceStateHandler
    implements MachineStateHandler<OfferTaxAgentsChoiceAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is OfferTaxAgentsChoiceAction {
        return isTaxAgentsForceTax(action) || isTaxAgentsTakeFromTaxBox(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []
        if (HydratedTaxAgentsForceTax.canForceTax(state, playerId)) {
            validActions.push(ActionType.TaxAgentsForceTax)
        }
        if (HydratedTaxAgentsTakeFromTaxBox.canTakeFromTaxBox(state, playerId)) {
            validActions.push(ActionType.TaxAgentsTakeFromTaxBox)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const corporationId = state.taxAgentsCorporationId
        const presidentPlayerId = corporationId
            ? state.getCorporation(corporationId).getPresidentPlayerId()
            : undefined
        state.activePlayerIds = presidentPlayerId ? [presidentPlayerId] : []
    }

    onAction(
        action: OfferTaxAgentsChoiceAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        const resumeState = state.taxAgentsResumeState ?? MachineState.PayDividends

        state.taxAgentsCorporationId = undefined
        state.taxAgentsHexId = undefined
        state.taxAgentsResumeState = undefined
        state.activePlayerIds = []

        if (isTaxAgentsForceTax(action)) {
            return MachineState.PayTaxes
        }
        return resumeState
    }
}
