import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ActionKind } from '../data/board.js'
import { isSwarm } from '../actions/swarm.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { stateAfterSwarmProgress } from '../operations/swarm.js'
import { finishCubeTurn } from '../operations/turn.js'

const ActionTypesByKind: Record<ActionKind, ActionType[]> = {
    [ActionKind.JumpOrBreed]: [ActionType.Jump, ActionType.Breed],
    [ActionKind.Hatch]: [ActionType.Hatch],
    [ActionKind.Cannibalize]: [ActionType.Cannibalize],
    [ActionKind.Swarm]: [ActionType.Swarm]
}

export class PerformActionStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedLocustGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLocustGameState>
    ): boolean {
        const kind = context.gameState.pendingAction?.kind
        if (kind === undefined) {
            return false
        }
        return ActionTypesByKind[kind].some((type) => type === action.type)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLocustGameState>
    ): string[] {
        const state = context.gameState
        if (!state.activePlayerIds.includes(playerId) || !state.pendingAction) {
            return []
        }
        return ActionTypesByKind[state.pendingAction.kind]
    }

    enter(_context: MachineContext<HydratedLocustGameState>) {}

    onAction(action: HydratedAction, context: MachineContext<HydratedLocustGameState>): string {
        return isSwarm(action)
            ? stateAfterSwarmProgress(context.gameState)
            : finishCubeTurn(context.gameState)
    }
}
