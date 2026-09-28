import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPayDividends, PayDividends, isPayDividends } from '../actions/payDividends.js'
import {
    HydratedDeepSpaceSmuggling,
    isDeepSpaceSmuggling
} from '../actions/deepSpaceSmuggling.js'
import { HydratedDeepSpacePirates, isDeepSpacePirates } from '../actions/deepSpacePirates.js'
import {
    HydratedDeclinePayDividendsPower,
    isDeclinePayDividendsPower
} from '../actions/declinePayDividendsPower.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { pendingPayDividendsPower } from '../operations/corporatePowers.js'

type PayDividendsAction =
    | HydratedPayDividends
    | HydratedDeepSpaceSmuggling
    | HydratedDeepSpacePirates
    | HydratedDeclinePayDividendsPower

/**
 * Runs Pay Dividends, the third step of each Corporation's turn during the Corporation Round.
 * Per the rulebook this step is "Mandatory" - fully automatic, with no player ever making a
 * decision - so unlike every other state handler in this game, this one queues its own action
 * (a System action with no playerId - see HydratedPayDividends) rather than waiting for a
 * player to submit one. See MachineContext.addSystemAction for the underlying mechanism: the
 * queued action runs through the exact same apply/onAction/enter pipeline as a real player
 * action, just without any player involvement.
 *
 * Deep Space Smuggling / Deep Space Pirates (Corporate Power Glossary, page 29) are the one
 * genuine player decision inside Pay Dividends: each One-Time, offered - in that order, one at a
 * time - to the active Corporation's own President if that Corporation holds the matching Power
 * (see operations/corporatePowers.ts's pendingPayDividendsPower), before the automatic payout
 * runs. Both flags gating them (state.payDividendsSmugglingOfferResolved /
 * payDividendsPiratesOfferResolved) are reset once the automatic PayDividends action actually
 * runs, so the next Pay Dividends instance - this Corporation's next turn, or another
 * Corporation's turn - starts fresh.
 */
export class PayDividendsStateHandler
    implements MachineStateHandler<PayDividendsAction, HydratedStellarVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarVenturesGameState>
    ): action is PayDividendsAction {
        return (
            isPayDividends(action) ||
            isDeepSpaceSmuggling(action) ||
            isDeepSpacePirates(action) ||
            isDeclinePayDividendsPower(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []

        const pending = pendingPayDividendsPower(state)
        if (pending === 'smuggling') {
            if (HydratedDeepSpaceSmuggling.canOfferDeepSpaceSmuggling(state, playerId)) {
                validActions.push(ActionType.DeepSpaceSmuggling)
            }
        } else if (pending === 'pirates') {
            if (HydratedDeepSpacePirates.canOfferDeepSpacePirates(state, playerId)) {
                validActions.push(ActionType.DeepSpacePirates)
            }
        }
        if (HydratedDeclinePayDividendsPower.canDeclinePayDividendsPower(state, playerId)) {
            validActions.push(ActionType.DeclinePayDividendsPower)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedStellarVenturesGameState>) {
        const state = context.gameState
        state.activePlayerIds = []

        if (!state.activeCorporationId) {
            return
        }

        // Auto-resolve (as if declined) any pending Power whose Corporation somehow has no
        // President to decide, so play is never stuck - then check again in case the
        // Corporation holds both Powers.
        let pending = pendingPayDividendsPower(state)
        while (pending) {
            const presidentPlayerId = state.getCorporation(state.activeCorporationId).getPresidentPlayerId()
            if (presidentPlayerId) {
                state.activePlayerIds = [presidentPlayerId]
                return
            }
            if (pending === 'smuggling') {
                state.payDividendsSmugglingOfferResolved = true
            } else {
                state.payDividendsPiratesOfferResolved = true
            }
            pending = pendingPayDividendsPower(state)
        }

        // Guard against double-queueing if enter() somehow runs more than once before the
        // queued action is processed.
        if (context.getPendingActions().some((action) => isPayDividends(action))) {
            return
        }

        context.addSystemAction(PayDividends)
    }

    onAction(
        action: PayDividendsAction,
        context: MachineContext<HydratedStellarVenturesGameState>
    ): string {
        switch (true) {
            case isDeepSpaceSmuggling(action):
            case isDeepSpacePirates(action):
            case isDeclinePayDividendsPower(action): {
                // Effect (or lack thereof) already applied - loop back so enter() now offers the
                // other Power (if any) or queues the automatic PayDividends System action.
                return MachineState.PayDividends
            }
            case isPayDividends(action): {
                const state = context.gameState
                state.payDividendsSmugglingOfferResolved = undefined
                state.payDividendsPiratesOfferResolved = undefined
                return MachineState.OrderShips
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
