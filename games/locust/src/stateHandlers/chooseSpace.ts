import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isPlaceCube } from '../actions/placeCube.js'
import { MatureNymphs, isMatureNymphs } from '../actions/matureNymphs.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { beginCubeTurn, finishCubeTurn } from '../operations/turn.js'
import { ActionKind } from '../data/board.js'

export class ChooseSpaceStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedLocustGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLocustGameState>
    ): boolean {
        return isPlaceCube(action) || isMatureNymphs(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLocustGameState>
    ): string[] {
        return context.gameState.activePlayerIds.includes(playerId) ? [ActionType.PlaceCube] : []
    }

    // Nymphs become grasshoppers at the start of their colony's next turn.
    enter(context: MachineContext<HydratedLocustGameState>) {
        const state = context.gameState
        if (state.activeColor === undefined) {
            beginCubeTurn(state)
        }
        const color = state.activeColony.color
        if (state.board.nymphsOf(color) > 0) {
            context.addSystemAction(MatureNymphs, { color })
        }
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedLocustGameState>): string {
        if (isMatureNymphs(action)) {
            return MachineState.ChooseSpace
        }
        return context.gameState.pendingAction?.kind === ActionKind.Hatch
            ? finishCubeTurn(context.gameState)
            : MachineState.PerformAction
    }
}
