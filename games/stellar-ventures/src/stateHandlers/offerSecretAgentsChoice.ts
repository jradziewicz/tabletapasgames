import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedIncreaseAlienMiningCapacity,
    isIncreaseAlienMiningCapacity
} from '../actions/increaseAlienMiningCapacity.js'
import {
    HydratedIncreaseAmethystMiningCapacity,
    isIncreaseAmethystMiningCapacity
} from '../actions/increaseAmethystMiningCapacity.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

type OfferSecretAgentsChoiceAction =
    | HydratedIncreaseAlienMiningCapacity
    | HydratedIncreaseAmethystMiningCapacity

/**
 * Runs Secret Agents' Mining Capacity choice (Amethyst Agency's own Formation Power, Glossary
 * page 29), entered whenever ExpandNetworkOrWormholeStateHandler or InvestorActionStateHandler
 * detects that a build just placed Amethyst Agency on an Alien Planet with a still-hidden Alien
 * Agreement Tile - see operations/agreement.ts's isEligibleForSecretAgentsChoice, and
 * state.secretAgentsCorporationId / secretAgentsHexId / secretAgentsResumeState, all set by
 * whichever handler detoured here. A hex whose tile is already used up never reaches this state
 * at all - the caller auto-resolves that case (there's nothing to choose between) rather than
 * offering a one-button screen - see those two handlers' own resolveAfterBuild-style logic.
 *
 * Same "always the President, regardless of whose turn it otherwise is" rule as Sign The
 * Agreement (a Shareholder's Jerry-Rig or Private Contractor during Investor Shenanigans can
 * trigger this for Amethyst Agency same as anyone else's build can trigger Sign The Agreement).
 * Unlike Sign The Agreement, neither choice ends an in-progress build or discards any Power, so
 * there's only the one resume state either way (secretAgentsResumeState) - no separate
 * decline-resume pair to thread through.
 */
export class OfferSecretAgentsChoiceStateHandler implements MachineStateHandler<
    OfferSecretAgentsChoiceAction,
    HydratedStellarVenturesGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is OfferSecretAgentsChoiceAction {
        return isIncreaseAlienMiningCapacity(action) || isIncreaseAmethystMiningCapacity(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const corporationId = state.secretAgentsCorporationId
        if (!corporationId) {
            return []
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return []
        }
        const validActions: ActionType[] = []
        if (HydratedIncreaseAlienMiningCapacity.canIncreaseAlienMiningCapacity(state, playerId)) {
            validActions.push(ActionType.IncreaseAlienMiningCapacity)
        }
        if (
            HydratedIncreaseAmethystMiningCapacity.canIncreaseAmethystMiningCapacity(
                state,
                playerId
            )
        ) {
            validActions.push(ActionType.IncreaseAmethystMiningCapacity)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const corporationId = state.secretAgentsCorporationId
        if (!corporationId) {
            state.activePlayerIds = []
            return
        }
        const presidentPlayerId = state.getCorporation(corporationId).getPresidentPlayerId()
        state.activePlayerIds = presidentPlayerId ? [presidentPlayerId] : []
    }

    onAction(
        _action: OfferSecretAgentsChoiceAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        const resumeState = state.secretAgentsResumeState ?? MachineState.PayDividends

        state.secretAgentsCorporationId = undefined
        state.secretAgentsHexId = undefined
        state.secretAgentsResumeState = undefined
        state.activePlayerIds = []

        return resumeState
    }
}
