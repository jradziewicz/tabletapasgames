import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSignTheAgreement, isSignTheAgreement } from '../actions/signTheAgreement.js'
import {
    HydratedDeclineSignTheAgreement,
    isDeclineSignTheAgreement
} from '../actions/declineSignTheAgreement.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

type OfferSignTheAgreementAction = HydratedSignTheAgreement | HydratedDeclineSignTheAgreement

/**
 * Runs the optional Sign The Agreement offer (rulebook page 22), entered whenever
 * ExpandNetworkOrWormholeStateHandler or InvestorActionStateHandler detects that a single Outpost
 * build just placed a Corporation on an Alien Planet with a still-hidden tile and it now
 * qualifies to sign - see operations/agreement.ts's isEligibleToSignTheAgreement, and
 * state.signTheAgreementCorporationId / signTheAgreementHexId / signTheAgreementResumeState /
 * signTheAgreementDeclineResumeState, all set by whichever handler detoured here.
 *
 * The choice always belongs to the Corporation's President, who is not necessarily whoever just
 * built (e.g. a Shareholder's Jerry-Rig or Private Contractor during Investor Shenanigans) - so
 * this handler always makes the President the sole active player here, regardless of whose turn
 * it otherwise is. Signing and declining can resume to DIFFERENT places: signing always ends the
 * in-progress build (HydratedSignTheAgreement.apply finalizes it before resuming at
 * signTheAgreementResumeState), while declining may instead loop back to let an Expand Network or
 * Private Contractor build continue (signTheAgreementDeclineResumeState) - for a one-shot build
 * (Create Wormhole, Jerry-Rig) there's nothing to continue, so declineResumeState is left unset
 * and simply defaults to the same place signing resumes to.
 *
 * Signing (never declining) also triggers Draft Power (rulebook page 22, step 5): by the time
 * onAction runs here, HydratedSignTheAgreement.apply has already discarded "Alien Explorers", so
 * if the Corporate Power pool isn't empty, this detours into MachineState.DraftPower
 * (actions/draftPower.ts) before resuming wherever signing itself would have.
 */
export class OfferSignTheAgreementStateHandler
    implements MachineStateHandler<OfferSignTheAgreementAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is OfferSignTheAgreementAction {
        return isSignTheAgreement(action) || isDeclineSignTheAgreement(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const corporationId = state.signTheAgreementCorporationId
        if (!corporationId) {
            return []
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return []
        }
        return [ActionType.SignTheAgreement, ActionType.DeclineSignTheAgreement]
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const corporationId = state.signTheAgreementCorporationId
        if (!corporationId) {
            state.activePlayerIds = []
            return
        }
        const presidentPlayerId = state.getCorporation(corporationId).getPresidentPlayerId()
        state.activePlayerIds = presidentPlayerId ? [presidentPlayerId] : []
    }

    onAction(
        action: OfferSignTheAgreementAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        const signing = isSignTheAgreement(action)
        const corporationId = state.signTheAgreementCorporationId
        const resumeState = signing
            ? (state.signTheAgreementResumeState ?? MachineState.PayDividends)
            : (state.signTheAgreementDeclineResumeState ??
              state.signTheAgreementResumeState ??
              MachineState.PayDividends)

        state.signTheAgreementCorporationId = undefined
        state.signTheAgreementHexId = undefined
        state.signTheAgreementResumeState = undefined
        state.signTheAgreementDeclineResumeState = undefined
        state.activePlayerIds = []

        if (signing && corporationId && state.availableCorporatePowerIds.length > 0) {
            state.draftPowerCorporationId = corporationId
            state.draftPowerResumeState = resumeState
            return MachineState.DraftPower
        }

        return resumeState
    }
}
