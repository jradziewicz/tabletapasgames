import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedExpandNetwork, isExpandNetwork } from '../actions/expandNetwork.js'
import { HydratedCreateWormhole, isCreateWormhole } from '../actions/createWormhole.js'
import {
    HydratedDeclineExpandNetworkOrWormhole,
    isDeclineExpandNetworkOrWormhole
} from '../actions/declineExpandNetworkOrWormhole.js'
import { HydratedAlienAlchemist, isAlienAlchemist } from '../actions/alienAlchemist.js'
import { HydratedLeakedResearch, isLeakedResearch } from '../actions/leakedResearch.js'
import {
    HydratedDismantlingOutposts,
    isDismantlingOutposts
} from '../actions/dismantlingOutposts.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { beginTaxAgentsChoiceIfEligible } from '../operations/taxes.js'
import {
    isEligibleToSignTheAgreement,
    isEligibleForSecretAgentsChoice,
    hasHiddenAlienAgreementTile,
    awardSecretAgentsMiningCapacityBonus
} from '../operations/agreement.js'
import { finalizeExpansion } from '../operations/network.js'

type ExpandNetworkOrWormholeAction =
    | HydratedExpandNetwork
    | HydratedCreateWormhole
    | HydratedDeclineExpandNetworkOrWormhole
    | HydratedAlienAlchemist
    | HydratedLeakedResearch
    | HydratedDismantlingOutposts

/**
 * Runs Expand Network / Create Wormhole, the second (optional) step of each Corporation's turn
 * during the Corporation Round. The Corporation's President may build Outposts one at a time via
 * Expand Network - up to 5 total, cost deferred and charged as a single lump sum only once the
 * build ends (see operations/network.ts's finalizeExpansion) - build a single Outpost anywhere on
 * the board via Create Wormhole (cost charged immediately, since it only ever builds 1 Outpost),
 * or decline to do either (DeclineExpandNetworkOrWormhole, which also finalizes any Expand
 * Network build already in progress). This step is always optional.
 *
 * Every time an Outpost lands on an Alien Planet with a still-hidden Alien Agreement Tile and the
 * Corporation now meets Sign The Agreement's requirements (operations/agreement.ts's
 * isEligibleToSignTheAgreement), play detours to OfferSignTheAgreement before continuing - see
 * resolveAfterBuild below. Signing always ends the build (resuming at PayDividends); declining an
 * Expand Network build instead loops back to this same state so the President can keep placing
 * Outposts (or stop via DeclineExpandNetworkOrWormhole) - Create Wormhole has nothing to continue
 * either way, so it always resumes at PayDividends. If the Corporation doesn't yet qualify to
 * sign (e.g. this is only its 1st Alien Planet Outpost), building simply continues with no
 * interruption at all.
 *
 * Nebular Explorers (Corporate Power Glossary, page 29) needs no separate action or offering
 * here: a Nebular Anomaly hex is simply one more legal target for Expand Network/Create Wormhole
 * themselves whenever the building Corporation holds that Power (see model/board.ts's
 * canBuildOutpost canBuildOnNebulaAnomaly parameter) - both cases below already call
 * resolveAfterBuild exactly as they would for an ordinary Alien Planet build, so the newly-
 * converted hex (operations/network.ts's resolveNebularAnomalyReveal, run inside each action's
 * own apply()) offers Sign The Agreement automatically with no extra wiring needed here.
 */
export class ExpandNetworkOrWormholeStateHandler implements MachineStateHandler<
    ExpandNetworkOrWormholeAction,
    HydratedStellarVenturesGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is ExpandNetworkOrWormholeAction {
        return (
            isExpandNetwork(action) ||
            isCreateWormhole(action) ||
            isDeclineExpandNetworkOrWormhole(action) ||
            isAlienAlchemist(action) ||
            isLeakedResearch(action) ||
            isDismantlingOutposts(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []

        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return validActions
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return validActions
        }

        if (HydratedExpandNetwork.canOfferExpandNetwork(state, playerId)) {
            validActions.push(ActionType.ExpandNetwork)
        }
        if (HydratedCreateWormhole.canOfferCreateWormhole(state, playerId)) {
            validActions.push(ActionType.CreateWormhole)
        }
        if (
            HydratedDeclineExpandNetworkOrWormhole.canDeclineExpandNetworkOrWormhole(
                state,
                playerId
            )
        ) {
            validActions.push(ActionType.DeclineExpandNetworkOrWormhole)
        }
        if (HydratedAlienAlchemist.canAlienAlchemist(state, playerId)) {
            validActions.push(ActionType.AlienAlchemist)
        }
        if (HydratedLeakedResearch.canOfferLeakedResearch(state, playerId)) {
            validActions.push(ActionType.LeakedResearch)
        }
        if (HydratedDismantlingOutposts.canOfferDismantlingOutposts(state, playerId)) {
            validActions.push(ActionType.DismantlingOutposts)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            state.activePlayerIds = []
            return
        }

        // Defensive cleanup: state.expandingCorporationId is the same single shared "a build is
        // currently in progress" flag used by Private Contractor during the Investor Round (see
        // InvestorActionStateHandler's own identical cleanup and its doc comment for the fuller
        // story) - it should never survive past the Corporation's own turn it belongs to (every
        // legitimate exit - Decline, FinishExpansion, Signing The Agreement - finalizes it), but
        // if it ever is left set anyway (e.g. an Undo that skipped past a still-in-progress
        // build), canOfferExpandNetwork treats ANY expandingCorporationId belonging to a
        // different Corporation as "someone else's build in progress" and refuses to offer
        // Expand Network at all - while canOfferCreateWormhole has no such check, so Board.svelte
        // silently falls back to Create Wormhole as the only "valid" option, even though the
        // President never asked for it and may not even have Wormhole Technology in mind. The
        // only build that can legitimately still be in progress here is THIS Corporation's own
        // Expand Network build (e.g. re-entering this same state after a Sign The Agreement
        // detour resolved) - anything else is stale, so finalize it now rather than let it
        // wrongly block this Corporation's own turn.
        if (
            state.expandingCorporationId !== undefined &&
            (state.expandingCorporationId !== corporationId ||
                state.expandingKind !== ActionType.ExpandNetwork)
        ) {
            finalizeExpansion(state)
        }

        const presidentPlayerId = state.getCorporation(corporationId).getPresidentPlayerId()
        state.activePlayerIds = presidentPlayerId ? [presidentPlayerId] : []
    }

    onAction(
        action: ExpandNetworkOrWormholeAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState
        switch (true) {
            case isExpandNetwork(action): {
                return this.resolveAfterBuild(
                    state,
                    action.hexId,
                    MachineState.ExpandNetworkOrWormhole
                )
            }
            case isCreateWormhole(action): {
                return this.resolveAfterBuild(state, action.hexId, MachineState.PayDividends)
            }
            case isDeclineExpandNetworkOrWormhole(action): {
                finalizeExpansion(state)
                state.activePlayerIds = []
                return MachineState.PayDividends
            }
            case isAlienAlchemist(action): {
                // Alien Alchemist's effect is already applied (see HydratedAlienAlchemist.apply) -
                // it never builds an Outpost or otherwise ends this step, so the President simply
                // remains here, free to Expand Network/Create Wormhole/Decline as normal.
                return MachineState.ExpandNetworkOrWormhole
            }
            case isLeakedResearch(action): {
                // Same as Alien Alchemist above - doesn't build or end this step.
                return MachineState.ExpandNetworkOrWormhole
            }
            case isDismantlingOutposts(action): {
                // Same as Alien Alchemist above - doesn't build or end this step (the reclaimed
                // Outpost is simply available to a later build action, same turn or otherwise).
                return MachineState.ExpandNetworkOrWormhole
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    // Shared by ExpandNetwork and CreateWormhole: if the hex just built is an Alien Planet with a
    // still-hidden Alien Agreement Tile and the Corporation now qualifies to sign, detour to
    // OfferSignTheAgreement - declining resumes back at resumeState (looping back to keep
    // building for Expand Network; Create Wormhole has nothing to continue, so its
    // declineResumeState is left unset, defaulting to resumeState). Otherwise (not an Alien
    // Planet, tile already flipped, or requirements not yet met) building simply
    // continues/ends at resumeState with no interruption.
    private resolveAfterBuild(
        state: HydratedStellarVenturesGameState,
        builtHexId: string,
        resumeState: MachineState
    ): string {
        const corporationId = state.activeCorporationId
        assertExists(corporationId, 'Active corporation id should be present after a build action')

        if (isEligibleToSignTheAgreement(state, corporationId, builtHexId)) {
            state.signTheAgreementCorporationId = corporationId
            state.signTheAgreementHexId = builtHexId
            state.signTheAgreementResumeState = MachineState.PayDividends
            if (resumeState !== MachineState.PayDividends) {
                state.signTheAgreementDeclineResumeState = resumeState
            }
            return MachineState.OfferSignTheAgreement
        }

        // Secret Agents' Mining Capacity choice (Amethyst Agency's own Formation Power - see
        // operations/agreement.ts's isEligibleForSecretAgentsChoice). If the tile is already used
        // up there's nothing to choose between - Increase Amethyst is the only legal option, so
        // it's auto-resolved here without interrupting the build at all.
        if (isEligibleForSecretAgentsChoice(state, corporationId, builtHexId)) {
            if (hasHiddenAlienAgreementTile(state.board, builtHexId)) {
                state.secretAgentsCorporationId = corporationId
                state.secretAgentsHexId = builtHexId
                state.secretAgentsResumeState = resumeState
                return MachineState.OfferSecretAgentsChoice
            }
            awardSecretAgentsMiningCapacityBonus(state, corporationId, builtHexId)
        }

        if (beginTaxAgentsChoiceIfEligible(state, corporationId, builtHexId, resumeState)) {
            return MachineState.OfferTaxAgentsChoice
        }

        if (resumeState === MachineState.PayDividends) {
            state.activePlayerIds = []
        }
        return resumeState
    }
}
