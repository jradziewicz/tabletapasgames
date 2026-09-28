import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLaunder, isLaunder } from '../actions/launder.js'
import { HydratedPassAlienTechAction, isPassAlienTechAction } from '../actions/passAlienTechAction.js'
import { HydratedCargoBoost, isCargoBoost } from '../actions/cargoBoost.js'
import { HydratedResearchWormhole, isResearchWormhole } from '../actions/researchWormhole.js'
import { HydratedDevelopPlanets, isDevelopPlanets } from '../actions/developPlanets.js'
import { HydratedLeakedResearch, isLeakedResearch } from '../actions/leakedResearch.js'
import { HydratedAlienEngineering, isAlienEngineering } from '../actions/alienEngineering.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { nextInvestorShenanigansPlayerId } from '../operations/investorShenanigans.js'

type AlienTechActionAction =
    | HydratedLaunder
    | HydratedPassAlienTechAction
    | HydratedCargoBoost
    | HydratedResearchWormhole
    | HydratedDevelopPlanets
    | HydratedLeakedResearch
    | HydratedAlienEngineering

/**
 * Runs one player's Alien Tech Action, the second half of their turn in Investor Shenanigans
 * (Investor Round step 3, rulebook page 19) - always immediately following that same player's
 * Investor Action (see stateHandlers/investorAction.ts). Once resolved, play proceeds clockwise
 * to the next player's Investor Action, or - once every player has gone - on to the
 * Administration Round (rulebook page 20, not yet implemented; see MachineState.ScrapLowestShip).
 */
export class AlienTechActionStateHandler
    implements MachineStateHandler<AlienTechActionAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is AlienTechActionAction {
        return (
            isLaunder(action) ||
            isPassAlienTechAction(action) ||
            isCargoBoost(action) ||
            isResearchWormhole(action) ||
            isDevelopPlanets(action) ||
            isLeakedResearch(action) ||
            isAlienEngineering(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return []
        }
        const validActions: ActionType[] = [ActionType.PassAlienTechAction]
        if (HydratedLaunder.canOfferLaunder(state, playerId)) {
            validActions.push(ActionType.Launder)
        }
        if (HydratedCargoBoost.canOfferCargoBoost(state, playerId)) {
            validActions.push(ActionType.CargoBoost)
        }
        if (HydratedResearchWormhole.canOfferResearchWormhole(state, playerId)) {
            validActions.push(ActionType.ResearchWormhole)
        }
        if (HydratedDevelopPlanets.canOfferDevelopPlanets(state, playerId)) {
            validActions.push(ActionType.DevelopPlanets)
        }
        if (HydratedLeakedResearch.canOfferLeakedResearch(state, playerId)) {
            validActions.push(ActionType.LeakedResearch)
        }
        if (HydratedAlienEngineering.canOfferAlienEngineering(state, playerId)) {
            validActions.push(ActionType.AlienEngineering)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        // The player order and current player were already established when this player's
        // Investor Action began (see InvestorActionStateHandler.enter) - just re-activate them.
        state.activePlayerIds = state.investorShenanigansCurrentPlayerId
            ? [state.investorShenanigansCurrentPlayerId]
            : []
    }

    onAction(
        action: AlienTechActionAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState

        // Leaked Research and Alien Engineering (Corporate Power Glossary, page 29) are both
        // genuinely extra actions - "free" means neither costs the President their
        // once-per-Investor-Round Alien Tech Action slot (see actions/leakedResearch.ts,
        // actions/alienEngineering.ts) - so unlike every other action here, taking either does
        // NOT advance to the next Investor Shenanigans player. The current player simply remains
        // here, still free to take (or pass on) their normal Alien Tech Action.
        if (isLeakedResearch(action) || isAlienEngineering(action)) {
            return MachineState.AlienTechAction
        }

        const playerOrder = state.investorShenanigansPlayerOrder
        const currentPlayerId = state.investorShenanigansCurrentPlayerId
        assertExists(playerOrder, 'Investor Shenanigans player order should be present')
        assertExists(currentPlayerId, 'Investor Shenanigans current player id should be present')

        const nextPlayerId = nextInvestorShenanigansPlayerId(playerOrder, currentPlayerId)
        if (nextPlayerId) {
            state.investorShenanigansCurrentPlayerId = nextPlayerId
            return MachineState.InvestorAction
        }

        // Every player has taken both their Investor Action and Alien Tech Action - Investor
        // Shenanigans (and the Investor Round) is complete. Proceeds to the Administration
        // Round (rulebook page 20, not yet implemented - see the game's task list).
        state.investorShenanigansPlayerOrder = undefined
        state.investorShenanigansCurrentPlayerId = undefined
        state.activePlayerIds = []
        return MachineState.ScrapLowestShip
    }
}
