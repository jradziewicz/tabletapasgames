import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isTax, HydratedTax } from '../actions/tax.js'
import { isInvest, HydratedInvest } from '../actions/invest.js'
import { isClaimMine, HydratedClaimMine } from '../actions/claimMine.js'
import { isLayTrack, HydratedLayTrack } from '../actions/layTrack.js'
import { isExtractAndSell, HydratedExtractAndSell } from '../actions/extractAndSell.js'
import { isHunt, HydratedHunt } from '../actions/hunt.js'
import { isAcquire, HydratedAcquire } from '../actions/acquire.js'
import { isGemAction, HydratedGemAction } from '../actions/gemAction.js'
import { isDiscardAgreement, HydratedDiscardAgreement } from '../actions/discardAgreement.js'
import { HydratedSellVictoryPoints, isSellVictoryPoints } from '../actions/sellVictoryPoints.js'
import { isEndTurn } from '../actions/endTurn.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { currentPlayerId } from '../operations/turn.js'
import { nextStateSkippingDeadTurns } from './playable.js'

export class TakeActionsStateHandler
    implements MachineStateHandler<HydratedAction, HydratedRockyVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): boolean {
        return isTax(action) || isInvest(action) || isClaimMine(action) || isLayTrack(action) || isExtractAndSell(action) || isHunt(action) || isAcquire(action) || isGemAction(action) || isDiscardAgreement(action) || isSellVictoryPoints(action) || isEndTurn(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string[] {
        const state = context.gameState
        if (!state.activePlayerIds.includes(playerId)) {
            return []
        }
        const valid: string[] = [ActionType.EndTurn]
        if (HydratedTax.canTax(state, playerId)) {
            valid.push(ActionType.Tax)
        }
        if (HydratedInvest.canInvest(state, playerId)) {
            valid.push(ActionType.Invest)
        }
        if (HydratedClaimMine.canClaimMine(state, playerId)) {
            valid.push(ActionType.ClaimMine)
        }
        if (HydratedLayTrack.canLayTrack(state, playerId)) {
            valid.push(ActionType.LayTrack)
        }
        if (HydratedExtractAndSell.canExtractAndSell(state, playerId)) {
            valid.push(ActionType.ExtractAndSell)
        }
        if (HydratedHunt.canHunt(state, playerId)) {
            valid.push(ActionType.Hunt)
        }
        if (HydratedAcquire.canAcquire(state, playerId)) {
            valid.push(ActionType.Acquire)
        }
        if (HydratedGemAction.canGemAction(state, playerId)) {
            valid.push(ActionType.GemAction)
        }
        if (HydratedDiscardAgreement.canDiscardAgreement(state, playerId)) {
            valid.push(ActionType.DiscardAgreement)
        }
        if (HydratedSellVictoryPoints.canSellVictoryPoints(state, playerId)) {
            valid.push(ActionType.SellVictoryPoints)
        }
        return valid
    }

    enter(context: MachineContext<HydratedRockyVenturesGameState>) {
        const state = context.gameState
        state.activePlayerIds = [currentPlayerId(state)]
    }

    onAction(
        action: HydratedAction,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string {
        if (isGemAction(action) && action.kind === 'swap') {
            return MachineState.TakeActions
        }
        if (isDiscardAgreement(action)) {
            return MachineState.FreeTrack
        }
        if (isSellVictoryPoints(action)) {
            return MachineState.TakeActions
        }
        return nextStateSkippingDeadTurns(context.gameState)
    }
}
