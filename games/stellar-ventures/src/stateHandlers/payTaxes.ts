import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPayTax, PayTax, isPayTax } from '../actions/payTax.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { nextStateAfterAdministration } from '../operations/administrationRound.js'

export class PayTaxesStateHandler
    implements MachineStateHandler<HydratedPayTax, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is HydratedPayTax {
        return isPayTax(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const corporationId = HydratedPayTax.pendingTaxPayerCorporationId(state)
        if (!corporationId || !HydratedPayTax.needsLoanChoice(state)) {
            return []
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return []
        }
        return [ActionType.PayTax]
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const corporationId = HydratedPayTax.pendingTaxPayerCorporationId(state)
        assertExists(corporationId, 'A Corporation should be waiting to pay Taxes')

        if (HydratedPayTax.needsLoanChoice(state)) {
            const presidentPlayerId = state.getCorporation(corporationId).getPresidentPlayerId()
            assertExists(presidentPlayerId, 'A taxed Corporation should have a President')
            state.activePlayerIds = [presidentPlayerId]
            return
        }

        state.activePlayerIds = []
        if (context.getPendingActions().some((action) => isPayTax(action))) {
            return
        }
        context.addSystemAction(PayTax, { corporationId, hexIds: [] })
    }

    onAction(
        _action: HydratedPayTax,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        if ((state.taxPayerCorporationIds ?? []).length > 0) {
            return MachineState.PayTaxes
        }

        const zones = state.boardMapDefinition.borders
            .filter((border) => state.board.isBorderClosed(border.level))
            .map((border) => ({ level: border.level, tax: border.tax }))
        state.taxPaymentSummary = {
            id: (state.taxPaymentSummary?.id ?? 0) + 1,
            taxBoxBefore: state.pendingTaxPaymentBoxBefore ?? 0,
            taxBoxAfter: state.taxBox ?? 0,
            zones,
            payments: state.pendingTaxPayments ?? []
        }
        state.pendingTaxPaymentBoxBefore = undefined
        state.pendingTaxPayments = undefined

        state.taxPayerCorporationIds = undefined
        state.activePlayerIds = []
        const resumeState = state.taxResumeState
        state.taxResumeState = undefined
        return resumeState ?? nextStateAfterAdministration(state)
    }
}
