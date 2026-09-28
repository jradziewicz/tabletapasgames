import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedScrapLowestShip,
    ScrapLowestShip,
    isScrapLowestShip
} from '../actions/scrapLowestShip.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

/**
 * Runs Scrap Lowest-Level Ship, the first step of the Administration Round (rulebook page 20),
 * which begins once every player has finished Investor Shenanigans (see
 * stateHandlers/alienTechAction.ts). Per the rulebook this step is fully automatic - "Scrap a
 * single Ship from the game" - so, like Release Dividends, this handler queues its own System
 * action rather than waiting on a player.
 */
export class ScrapLowestShipStateHandler
    implements MachineStateHandler<HydratedScrapLowestShip, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is HydratedScrapLowestShip {
        return isScrapLowestShip(action)
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
        if (context.getPendingActions().some((action) => isScrapLowestShip(action))) {
            return
        }

        context.addSystemAction(ScrapLowestShip)
    }

    onAction(
        _action: HydratedScrapLowestShip,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState

        // This Scrap may itself have triggered a further Scrapping Event
        // (resolveFirstShipOrderedEffects), which may in turn have paused awaiting a Spare Parts
        // decision - see operations/shipOrdering.ts's applyScrappingEvent. If so, detour there
        // first, resuming on to Deliver Ships (as normal) once it's resolved either way.
        if (state.pendingSparePartsCorporationId) {
            state.pendingSparePartsResumeState = MachineState.DeliverShips
            return MachineState.OfferSpareParts
        }

        return MachineState.DeliverShips
    }
}
