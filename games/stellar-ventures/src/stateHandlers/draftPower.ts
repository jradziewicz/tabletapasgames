import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedDraftPower, isDraftPower } from '../actions/draftPower.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

/**
 * Runs Draft Power (see actions/draftPower.ts for the two rulebook moments that reach this
 * state). state.draftPowerCorporationId names which Corporation is drafting, and
 * state.draftPowerResumeState where play resumes once its President chooses.
 *
 * Also performs the Initial Auction's own end-of-auction reveal (rulebook page 11): "Reveal
 * remaining Corporate Powers from the pile and begin the first Corporation Round" happens right
 * after the 5th (final) Corporation's own draft - by that point state.initialAuctionQueue is
 * already empty (see stateHandlers/initialAuction.ts) and stays that way for the rest of the
 * game, so gating the reveal on corporatePowerDrawPileIds still being non-empty makes it fire
 * exactly once, however many later Sign The Agreement drafts also pass through this handler.
 */
export class DraftPowerStateHandler
    implements MachineStateHandler<HydratedDraftPower, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is HydratedDraftPower {
        return isDraftPower(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const corporationId = state.draftPowerCorporationId
        if (!corporationId) {
            return []
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return []
        }
        return [ActionType.DraftPower]
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const corporationId = state.draftPowerCorporationId
        if (!corporationId) {
            state.activePlayerIds = []
            return
        }
        const presidentPlayerId = state.getCorporation(corporationId).getPresidentPlayerId()
        state.activePlayerIds = presidentPlayerId ? [presidentPlayerId] : []
    }

    onAction(
        _action: HydratedDraftPower,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState

        // End-of-Initial-Auction reveal (rulebook page 11) - see class docs above. A no-op once
        // the pile has already been emptied by an earlier draft. New Investor Setup has no
        // Initial Auction and so no reveal; games created before its setup stopped dealing a draw
        // pile still carry one, which must stay out of play rather than join the row here.
        const usesNewInvestorSetup =
            (context.gameConfig as { useNewInvestorSetup?: boolean }).useNewInvestorSetup === true
        if (
            !usesNewInvestorSetup &&
            state.initialAuctionQueue.length === 0 &&
            state.corporatePowerDrawPileIds.length > 0
        ) {
            state.availableCorporatePowerIds.push(...state.corporatePowerDrawPileIds)
            state.corporatePowerDrawPileIds = []
        }

        const resumeState = state.draftPowerResumeState ?? MachineState.IssueShare
        state.draftPowerCorporationId = undefined
        state.draftPowerResumeState = undefined
        state.activePlayerIds = []
        return resumeState
    }
}
