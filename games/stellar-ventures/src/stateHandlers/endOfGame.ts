import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { determineWinners } from '../operations/liquidation.js'

/**
 * Terminal state - Determine Winner, Liquidation's 4th and final step (rulebook page 21): "The
 * player with the most Credits (incl. Liquid + Frozen Funds) wins." Ties are broken first by
 * whoever presides over the highest-Mining-Capacity Corporation among the tied players, and, if
 * that's ALSO tied (or none of the tied players presides over anything), the rulebook's last
 * resort - "whoever gets to Outer Space next" - has no digital equivalent, so the game simply
 * ends in a Draw between whoever is still tied. See operations/liquidation.ts's determineWinners.
 * No actions are ever valid here, matching every other terminal state in this engine.
 */
export class EndOfGameStateHandler
    implements MachineStateHandler<HydratedAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): boolean {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const { result, winningPlayerIds } = determineWinners(state)
        state.result = result
        state.winningPlayerIds = winningPlayerIds
        state.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        throw Error('No actions are valid at the end of the game')
    }
}
