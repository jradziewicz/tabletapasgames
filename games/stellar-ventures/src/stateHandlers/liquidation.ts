import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLiquidate, Liquidate, isLiquidate } from '../actions/liquidate.js'
import {
    HydratedBackroomDeal,
    backroomDealCorporation,
    isBackroomDeal
} from '../actions/backroomDeal.js'
import { HydratedDeclineBackroomDeal, isDeclineBackroomDeal } from '../actions/declineBackroomDeal.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

type LiquidationAction = HydratedLiquidate | HydratedBackroomDeal | HydratedDeclineBackroomDeal

/**
 * Runs Liquidation (Final Scoring), reached once Era 5's Corporation Round ends (rulebook page 9:
 * "Era 5 proceeds to Liquidation after the Corporation Round" - see
 * operations/corporationRound.ts's advanceToNextCorporationOrInvestorRound). Steps 1-3 (Deliver
 * Ordered Ships, Hostile Takeover, Share Liquidation - rulebook page 21) are all fully automatic,
 * so, like ScrapLowestShip / DeliverShips / ReleaseDividends before it, this handler just queues
 * its own System action - see actions/liquidate.ts and operations/liquidation.ts. Step 4,
 * Determine Winner, happens once play reaches the terminal EndOfGame state.
 *
 * Backroom Deal (Corporate Power Glossary, page 29) is the one genuine player decision inside
 * Liquidation: "One-Time (before Hostile Takeover)", offered to whichever Corporation's President
 * holds it (see actions/backroomDeal.ts's backroomDealCorporation - at most 1, since it's a
 * unique physical tile) the moment Liquidation begins. Since Liquidation only ever happens once
 * per game, state.backroomDealResolved simply gates whether that one-shot window is still open -
 * the automatic Liquidate System action is held back (enter() below) until it's been used
 * (HydratedBackroomDeal) or declined (HydratedDeclineBackroomDeal), then queued exactly as before.
 */
export class LiquidationStateHandler
    implements MachineStateHandler<LiquidationAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is LiquidationAction {
        return isLiquidate(action) || isBackroomDeal(action) || isDeclineBackroomDeal(action)
    }

    validActionsForPlayer(
        playerId: string,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = _context.gameState
        const validActions: ActionType[] = []
        if (HydratedBackroomDeal.canBackroomDeal(state, playerId)) {
            validActions.push(ActionType.BackroomDeal)
        }
        if (HydratedDeclineBackroomDeal.canDeclineBackroomDeal(state, playerId)) {
            validActions.push(ActionType.DeclineBackroomDeal)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState

        if (!state.backroomDealResolved) {
            const corporation = backroomDealCorporation(state)
            const presidentPlayerId = corporation?.getPresidentPlayerId()
            if (presidentPlayerId) {
                state.activePlayerIds = [presidentPlayerId]
                return
            }
            // Nobody holds Backroom Deal (or it has no President) - nothing to offer, so treat
            // it as already resolved and fall through to the automatic Liquidate below.
            state.backroomDealResolved = true
        }

        state.activePlayerIds = []

        if (context.getPendingActions().some((action) => isLiquidate(action))) {
            return
        }

        context.addSystemAction(Liquidate)
    }

    onAction(
        action: LiquidationAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        switch (true) {
            case isBackroomDeal(action):
            case isDeclineBackroomDeal(action): {
                // Effect (or lack thereof) already applied - loop back so enter() now queues the
                // automatic Liquidate System action.
                return MachineState.Liquidation
            }
            case isLiquidate(action): {
                return MachineState.EndOfGame
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
