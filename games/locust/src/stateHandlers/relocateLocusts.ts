import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { isRelocateLocusts } from '../actions/relocateLocusts.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { stateAfterSwarmProgress } from '../operations/swarm.js'

export class RelocateLocustsStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedLocustGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLocustGameState>
    ): boolean {
        return isRelocateLocusts(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLocustGameState>
    ): string[] {
        return context.gameState.activePlayerIds.includes(playerId)
            ? [ActionType.RelocateLocusts]
            : []
    }

    enter(_context: MachineContext<HydratedLocustGameState>) {}

    onAction(_action: HydratedAction, context: MachineContext<HydratedLocustGameState>): string {
        return stateAfterSwarmProgress(context.gameState)
    }
}
