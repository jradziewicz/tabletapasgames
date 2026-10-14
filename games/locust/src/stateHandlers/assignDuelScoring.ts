import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isAssignDuelScoring } from '../actions/assignDuelScoring.js'
import type { HydratedLocustGameState } from '../model/gameState.js'

function unassignedPlayerIds(state: HydratedLocustGameState): string[] {
    return state.turnManager.turnOrder.filter(
        (playerId) => state.getPlayerState(playerId).vigorColor === undefined
    )
}

export class AssignDuelScoringStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedLocustGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLocustGameState>
    ): boolean {
        return isAssignDuelScoring(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLocustGameState>
    ): string[] {
        return context.gameState.activePlayerIds.includes(playerId)
            ? [ActionType.AssignDuelScoring]
            : []
    }

    enter(context: MachineContext<HydratedLocustGameState>) {
        const state = context.gameState
        state.activePlayerIds = unassignedPlayerIds(state).slice(0, 1)
    }

    onAction(_action: HydratedAction, context: MachineContext<HydratedLocustGameState>): string {
        return unassignedPlayerIds(context.gameState).length > 0
            ? MachineState.AssignDuelScoring
            : MachineState.EndOfGame
    }
}
