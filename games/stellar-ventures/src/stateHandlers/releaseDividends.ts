import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedReleaseDividends,
    ReleaseDividends,
    isReleaseDividends
} from '../actions/releaseDividends.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

/**
 * Runs Release Dividends, the first step of the Investor Round (rulebook page 18), which begins
 * once every Corporation has completed its full turn in the Corporation Round (see
 * operations/corporationRound.ts). Per the rulebook this step is fully automatic - "All players
 * move Credits from Frozen Funds to Liquid Funds" - so, like Pay Dividends, this handler queues
 * its own System action (see MachineContext.addSystemAction) rather than waiting on a player.
 *
 * NOTE: the next step after this, Boardroom Battle, is not yet implemented (see the game's task
 * list), so onAction below transitions into a state with no handler registered yet. That mirrors
 * how this game has been built incrementally throughout - Order Ships briefly pointed at this
 * same not-yet-implemented ReleaseDividends state before this handler existed.
 */
export class ReleaseDividendsStateHandler
    implements MachineStateHandler<HydratedReleaseDividends, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is HydratedReleaseDividends {
        return isReleaseDividends(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        // Mandatory and fully automatic - no player ever acts in this state.
        return []
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        state.activePlayerIds = []

        // Guard against double-queueing if enter() somehow runs more than once before the
        // queued action is processed.
        if (context.getPendingActions().some((action) => isReleaseDividends(action))) {
            return
        }

        context.addSystemAction(ReleaseDividends)
    }

    onAction(
        _action: HydratedReleaseDividends,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        return MachineState.BoardroomBattle
    }
}
