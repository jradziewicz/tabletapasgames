import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSellVictoryPoints, isSellVictoryPoints } from '../actions/sellVictoryPoints.js'
import { isMovePawn } from '../actions/movePawn.js'
import { HydratedGemAction, isGemAction } from '../actions/gemAction.js'
import { HydratedDiscardAgreement, isDiscardAgreement } from '../actions/discardAgreement.js'
import { stateAfterPawnMove } from './playable.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'

export class MovePawnStateHandler
    implements MachineStateHandler<HydratedAction, HydratedRockyVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): boolean {
        return isMovePawn(action) || isGemAction(action) || isDiscardAgreement(action) || isSellVictoryPoints(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string[] {
        const state = context.gameState
        if (!state.activePlayerIds.includes(playerId)) {
            return []
        }
        const valid: string[] = [ActionType.MovePawn]
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
        if (!state.turnManager.currentTurn()) {
            state.turnManager.startNextTurn(state.actionCount)
        }
        const playerId = state.turnManager.currentTurn()?.playerId
        state.activePlayerIds = playerId === undefined ? [] : [playerId]
    }

    onAction(
        action: HydratedAction,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string {
        if (isGemAction(action) && action.kind === 'swap') {
            return MachineState.MovePawn
        }
        if (isDiscardAgreement(action)) {
            return MachineState.FreeTrack
        }
        if (isSellVictoryPoints(action)) {
            return MachineState.MovePawn
        }
        return stateAfterPawnMove(context.gameState)
    }
}
