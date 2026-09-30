import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { isAgreementPointBuy } from '../actions/agreementPointBuy.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { currentPlayerId } from '../operations/turn.js'
import { nextStateSkippingDeadTurns } from './playable.js'

export class AgreementPointBuyStateHandler
    implements MachineStateHandler<HydratedAction, HydratedRockyVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): boolean {
        return isAgreementPointBuy(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string[] {
        return context.gameState.activePlayerIds.includes(playerId)
            ? [ActionType.AgreementPointBuy]
            : []
    }

    enter(context: MachineContext<HydratedRockyVenturesGameState>) {
        const state = context.gameState
        state.activePlayerIds = [currentPlayerId(state)]
    }

    onAction(
        _action: HydratedAction,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string {
        return nextStateSkippingDeadTurns(context.gameState)
    }
}
