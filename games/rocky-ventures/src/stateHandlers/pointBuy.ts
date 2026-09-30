import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { isPointBuy } from '../actions/pointBuy.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { nextStateSkippingDeadTurns } from './playable.js'

export class PointBuyStateHandler
    implements MachineStateHandler<HydratedAction, HydratedRockyVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): boolean {
        return isPointBuy(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string[] {
        return context.gameState.activePlayerIds.includes(playerId) ? [ActionType.PointBuy] : []
    }

    enter(context: MachineContext<HydratedRockyVenturesGameState>) {
        const next = context.gameState.pointBuy?.queue[0]
        if (next !== undefined) {
            context.gameState.activePlayerIds = [next]
        }
    }

    onAction(
        _action: HydratedAction,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string {
        return nextStateSkippingDeadTurns(context.gameState)
    }
}
