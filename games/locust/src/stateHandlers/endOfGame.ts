import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { determineWinners, playerScore } from '../operations/scoring.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedLocustGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedLocustGameState>
    ): boolean {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedLocustGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedLocustGameState>) {
        const state = context.gameState
        for (const player of state.players) {
            player.score = playerScore(state, player.playerId)
        }
        const { result, winningPlayerIds } = determineWinners(state)
        state.result = result
        state.winningPlayerIds = winningPlayerIds
        state.activePlayerIds = []
    }

    onAction(_action: HydratedAction, _context: MachineContext<HydratedLocustGameState>): string {
        throw Error('No actions are valid at the end of the game')
    }
}
