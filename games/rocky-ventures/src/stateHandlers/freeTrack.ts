import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isLayFreeTrack } from '../actions/layFreeTrack.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { currentPlayerId } from '../operations/turn.js'

export class FreeTrackStateHandler
    implements MachineStateHandler<HydratedAction, HydratedRockyVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): boolean {
        return isLayFreeTrack(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string[] {
        return context.gameState.activePlayerIds.includes(playerId) ? [ActionType.LayFreeTrack] : []
    }

    enter(context: MachineContext<HydratedRockyVenturesGameState>) {
        const state = context.gameState
        state.activePlayerIds = [currentPlayerId(state)]
    }

    onAction(
        _action: HydratedAction,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string {
        const state = context.gameState
        const freeTrack = state.freeTrack
        if (!freeTrack) {
            return MachineState.TakeActions
        }
        if (freeTrack.remaining > 0) {
            return MachineState.FreeTrack
        }
        delete state.freeTrack
        return freeTrack.resumeState
    }
}
