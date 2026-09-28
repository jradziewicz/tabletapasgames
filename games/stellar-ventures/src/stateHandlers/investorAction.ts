import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedBlackMarket, isBlackMarket } from '../actions/blackMarket.js'
import { HydratedPassInvestorAction, isPassInvestorAction } from '../actions/passInvestorAction.js'
import { HydratedJerryRig, isJerryRig } from '../actions/jerryRig.js'
import { HydratedPrivateContractor, isPrivateContractor } from '../actions/privateContractor.js'
import { HydratedInsuranceFraud, isInsuranceFraud } from '../actions/insuranceFraud.js'
import { HydratedFinishExpansion, isFinishExpansion } from '../actions/finishExpansion.js'
import { HydratedAlienEngineering, isAlienEngineering } from '../actions/alienEngineering.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { beginTaxAgentsChoiceIfEligible } from '../operations/taxes.js'
import { turnOrderStartingWith } from '../operations/auction.js'
import {
    isEligibleToSignTheAgreement,
    isEligibleForSecretAgentsChoice,
    hasHiddenAlienAgreementTile,
    awardSecretAgentsMiningCapacityBonus
} from '../operations/agreement.js'
import { finalizeExpansion } from '../operations/network.js'

type InvestorActionAction =
    | HydratedBlackMarket
    | HydratedPassInvestorAction
    | HydratedJerryRig
    | HydratedPrivateContractor
    | HydratedInsuranceFraud
    | HydratedFinishExpansion
    | HydratedAlienEngineering

/**
 * Runs one player's Investor Action, the first half of their turn in Investor Shenanigans
 * (Investor Round step 3, rulebook page 19). Each player, starting with (and proceeding
 * clockwise from) the Director, must move their Investor Action Disc to a new action - one
 * different from whichever they used last Investor Round (see
 * operations/investorShenanigans.ts's canSelectInvestorActionId) - or pass, removing the disc
 * from the board entirely.
 *
 * Private Contractor builds Outposts one at a time, just like Expand Network - once a player has
 * started one (state.expandingKind === PrivateContractor), they may keep placing Outposts across
 * further PrivateContractor actions, or stop with FinishExpansion (Private Contractor's
 * equivalent of DeclineExpandNetworkOrWormhole) - see validActionsForPlayer, which restricts them
 * to just those two choices while a build is in progress. Jerry-Rig remains a one-shot, single-
 * Outpost build. Either build can trigger the same Sign The Agreement detour Expand Network does
 * (see ExpandNetworkOrWormholeStateHandler and operations/agreement.ts). Whichever Investor
 * Action (or pass) this player ultimately chose, play always continues straight to this same
 * player's own Alien Tech Action before advancing to the next player.
 */
export class InvestorActionStateHandler implements MachineStateHandler<
    InvestorActionAction,
    HydratedStellarVenturesGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is InvestorActionAction {
        return (
            isBlackMarket(action) ||
            isPassInvestorAction(action) ||
            isJerryRig(action) ||
            isPrivateContractor(action) ||
            isInsuranceFraud(action) ||
            isFinishExpansion(action) ||
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

        // Mid-build: once a player has started a Private Contractor build, it's the only
        // Investor Action they may take this turn - they can only continue building or stop.
        if (
            state.expandingKind === ActionType.PrivateContractor &&
            state.expandingBuilderId === playerId
        ) {
            const validActions: ActionType[] = [ActionType.FinishExpansion]
            if (HydratedPrivateContractor.canOfferPrivateContractor(state, playerId)) {
                validActions.push(ActionType.PrivateContractor)
            }
            // Alien Engineering (Corporate Power Glossary, page 29) is a genuinely free,
            // non-turn-consuming action - offered here too, mid-build, same as every other step
            // of Investor Shenanigans (see stateHandlers/alienTechAction.ts).
            if (HydratedAlienEngineering.canOfferAlienEngineering(state, playerId)) {
                validActions.push(ActionType.AlienEngineering)
            }
            return validActions
        }

        const validActions: ActionType[] = [ActionType.PassInvestorAction]
        if (HydratedBlackMarket.canOfferBlackMarket(state, playerId)) {
            validActions.push(ActionType.BlackMarket)
        }
        if (HydratedJerryRig.canOfferJerryRig(state, playerId)) {
            validActions.push(ActionType.JerryRig)
        }
        if (HydratedPrivateContractor.canOfferPrivateContractor(state, playerId)) {
            validActions.push(ActionType.PrivateContractor)
        }
        if (HydratedInsuranceFraud.canOfferInsuranceFraud(state, playerId)) {
            validActions.push(ActionType.InsuranceFraud)
        }
        if (HydratedAlienEngineering.canOfferAlienEngineering(state, playerId)) {
            validActions.push(ActionType.AlienEngineering)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState

        if (!state.investorShenanigansPlayerOrder) {
            // First entry into Investor Shenanigans this Investor Round.
            const playerOrder = turnOrderStartingWith(
                state.turnManager.turnOrder,
                state.directorPlayerId
            )
            state.investorShenanigansPlayerOrder = playerOrder
            state.investorShenanigansCurrentPlayerId = playerOrder[0]
        }

        // Defensive cleanup: state.expandingCorporationId is a single shared "a build is
        // currently in progress" flag used by both Expand Network (Corporation Round) and
        // Private Contractor (here) - see operations/network.ts's finalizeExpansion. It should
        // never survive past the turn/phase it belongs to (every legitimate exit - Decline,
        // FinishExpansion, signing The Agreement - finalizes it), but if some edge case ever
        // left it set anyway, it silently blocks canOfferPrivateContractor's "starting a fresh
        // build" check for every player from then on, since that check treats ANY set
        // expandingCorporationId belonging to a different kind or builder as "someone else's
        // build in progress" (see actions/privateContractor.ts). The only build that can
        // legitimately still be in progress here is a Private Contractor build by the player
        // who's about to act - anything else (a stale Expand Network leftover from the
        // Corporation Round, or a different player's builder id) is definitely stale, so
        // finalize it now rather than let it wrongly block a fresh Private Contractor attempt.
        if (
            state.expandingCorporationId !== undefined &&
            (state.expandingKind !== ActionType.PrivateContractor ||
                state.expandingBuilderId !== state.investorShenanigansCurrentPlayerId)
        ) {
            finalizeExpansion(state)
        }

        state.activePlayerIds = state.investorShenanigansCurrentPlayerId
            ? [state.investorShenanigansCurrentPlayerId]
            : []
    }

    onAction(
        action: InvestorActionAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        const state = context.gameState

        // Alien Engineering is a genuinely extra, free action (see actions/alienEngineering.ts
        // and stateHandlers/alienTechAction.ts's identical treatment) - it doesn't cost this
        // player their Investor Action, so it loops back here rather than advancing to their
        // Alien Tech Action, leaving whatever they were mid-build on (if anything) untouched.
        if (isAlienEngineering(action)) {
            return MachineState.InvestorAction
        }

        if (isFinishExpansion(action)) {
            finalizeExpansion(state)
            return MachineState.AlienTechAction
        }

        // Jerry-Rig and Private Contractor can build an Outpost on an Alien Planet, same as
        // Expand Network / Create Wormhole - so they can trigger the same Sign The Agreement
        // detour (see ExpandNetworkOrWormholeStateHandler and operations/agreement.ts). Unlike
        // those, the actor here (this Investor Shenanigans player) isn't necessarily the target
        // Corporation's President - but OfferSignTheAgreementStateHandler always makes the
        // President the active player regardless, so that's handled uniformly. Declining lets a
        // Private Contractor build continue (looping back to this same state so the player can
        // place another Outpost or call FinishExpansion); Jerry-Rig is a one-shot build with
        // nothing to continue, so its declineResumeState is left unset (defaults to resumeState).
        // Either way, once the build truly ends, play resumes at this same player's Alien Tech
        // Action.
        if (isJerryRig(action) || isPrivateContractor(action)) {
            if (isEligibleToSignTheAgreement(state, action.corporationId, action.hexId)) {
                state.signTheAgreementCorporationId = action.corporationId
                state.signTheAgreementHexId = action.hexId
                state.signTheAgreementResumeState = MachineState.AlienTechAction
                if (isPrivateContractor(action)) {
                    state.signTheAgreementDeclineResumeState = MachineState.InvestorAction
                }
                return MachineState.OfferSignTheAgreement
            }

            // Secret Agents' Mining Capacity choice - same detour ExpandNetworkOrWormholeState-
            // Handler offers, just resuming at this player's own Alien Tech Action (one-shot
            // Jerry-Rig) or back at Investor Action (Private Contractor, to keep building)
            // instead of PayDividends. A tile already used up auto-resolves to Increase Amethyst
            // without interrupting either build.
            if (isEligibleForSecretAgentsChoice(state, action.corporationId, action.hexId)) {
                const resumeState = isPrivateContractor(action)
                    ? MachineState.InvestorAction
                    : MachineState.AlienTechAction
                if (hasHiddenAlienAgreementTile(state.board, action.hexId)) {
                    state.secretAgentsCorporationId = action.corporationId
                    state.secretAgentsHexId = action.hexId
                    state.secretAgentsResumeState = resumeState
                    return MachineState.OfferSecretAgentsChoice
                }
                awardSecretAgentsMiningCapacityBonus(state, action.corporationId, action.hexId)
            }

            if (
                beginTaxAgentsChoiceIfEligible(
                    state,
                    action.corporationId,
                    action.hexId,
                    isPrivateContractor(action)
                        ? MachineState.InvestorAction
                        : MachineState.AlienTechAction
                )
            ) {
                return MachineState.OfferTaxAgentsChoice
            }

            if (isPrivateContractor(action)) {
                // Not (yet) eligible to sign - keep building.
                return MachineState.InvestorAction
            }
        }

        // Whichever Investor Action (or pass) this player chose, their turn always continues
        // straight to their own Alien Tech Action.
        return MachineState.AlienTechAction
    }
}
