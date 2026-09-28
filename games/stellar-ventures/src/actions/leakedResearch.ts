import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'

export type LeakedResearch = Type.Static<typeof LeakedResearch>
export const LeakedResearch = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LeakedResearch),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId)
        })
    ])
)

export const LeakedResearchValidator = Compile(LeakedResearch)

export function isLeakedResearch(action?: GameAction): action is LeakedResearch {
    return action?.type === ActionType.LeakedResearch
}

const ALIEN_TECH_CUBES_COST = 1

// The rulebook's "Anytime" timing, translated into this state machine: two disjoint windows.
// (1) This Corporation's own turn during the Corporation Round, at every step where its
// President otherwise has an open decision to make - Issue Share (before the auction opens;
// once bidding starts the active player rotates to whichever bidder's turn it is, not
// necessarily the President), Expand Network / Wormhole, and Order Ships. NOT Pay Dividends -
// confirmed by the game's co-designer that step is fully automatic/Mandatory
// (stateHandlers/payDividends.ts resolves it via a queued system action with no player decision
// to interrupt), so there's no "President is otherwise acting" moment there to hang this off of.
// (2) This Corporation's President's own Alien Tech Action during Investor Shenanigans -
// deliberately NOT the earlier Investor Action half of that same turn, even though both share
// investorShenanigansCurrentPlayerId (see model/gameState.ts) - Leaked Research has always been
// offered specifically alongside the Alien Tech Action, per the original design confirmation.
function isLeakedResearchWindow(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    playerId: string
): boolean {
    const isOwnCorporationRoundTurn =
        state.activeCorporationId === corporationId &&
        (state.machineState === MachineState.ExpandNetworkOrWormhole ||
            state.machineState === MachineState.OrderShips ||
            (state.machineState === MachineState.IssueShare && !state.activeShareAuction))

    const isOwnAlienTechAction =
        state.machineState === MachineState.AlienTechAction &&
        state.investorShenanigansCurrentPlayerId === playerId

    return isOwnCorporationRoundTurn || isOwnAlienTechAction
}

/**
 * Leaked Research (Corporate Power Glossary, page 29): "Anytime, One-Time. President may perform
 * Research Wormhole as a free action for this Corporation, still spending Alien Technology as
 * normal." Confirmed with the game's co-designer: "free" means this doesn't cost the President
 * their once-per-Investor-Round Alien Tech Action slot (see stateHandlers/alienTechAction.ts),
 * and "Anytime" means it's a genuinely separate, extra action available both during this
 * Corporation's own turn in the Corporation Round and during its President's Alien Tech Action
 * in Investor Shenanigans - see isLeakedResearchWindow above for the exact windows, and
 * stateHandlers/issueShare.ts, stateHandlers/expandNetworkOrWormhole.ts,
 * stateHandlers/orderShips.ts and stateHandlers/alienTechAction.ts for where each is wired in.
 * Unlike the ordinary Research Wormhole action (actions/researchWormhole.ts), this is performed
 * by the CORPORATION'S PRESIDENT specifically (not any Shareholder), still costs that President
 * 1 Alien Technology Cube ("still spending Alien Technology as normal"), and is discarded from
 * the Corporation's Charter after use (One-Time). Every state handler it's wired into loops back
 * to the same state afterward rather than ending or advancing that state's own turn/turn-order
 * pointer - see each handler's onAction.
 */
export class HydratedLeakedResearch
    extends HydratableAction<typeof LeakedResearch>
    implements LeakedResearch
{
    declare type: ActionType.LeakedResearch
    declare playerId: string
    declare corporationId: CorporationId

    constructor(data: LeakedResearch) {
        super(data, LeakedResearchValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonLeakedResearchInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporation = state.getCorporation(this.corporationId)
        state.getPlayerState(this.playerId).spendAlienTechCubes(ALIEN_TECH_CUBES_COST)
        corporation.wormholeActive = true
        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.LeakedResearch
        )
    }

    isValidLeakedResearch(state: HydratedStellarVenturesGameState): boolean {
        return HydratedLeakedResearch.canLeakedResearch(state, this.playerId, this.corporationId)
    }

    reasonLeakedResearchInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedLeakedResearch.reasonLeakedResearchInvalid(
            state,
            this.playerId,
            this.corporationId
        )
    }

    // Used both to validate the action and to decide whether to even offer it.
    static canLeakedResearch(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): boolean {
        return (
            HydratedLeakedResearch.reasonLeakedResearchInvalid(
                state,
                playerId,
                corporationId
            ) === undefined
        )
    }

    static reasonLeakedResearchInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): string | undefined {
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President may use Leaked Research'
        }
        if (!corporation.hasActivePower(CorporatePowerId.LeakedResearch)) {
            return 'This Corporation does not have the Leaked Research Power'
        }
        if (corporation.wormholeActive) {
            return 'This Corporation already has an active Wormhole'
        }
        if (state.getPlayerState(playerId).alienTechCubes < ALIEN_TECH_CUBES_COST) {
            return 'Insufficient Alien Technology cubes'
        }
        if (!isLeakedResearchWindow(state, corporationId, playerId)) {
            return 'Leaked Research is not available right now'
        }
        return undefined
    }

    // Whether to even offer LeakedResearch for ANY Corporation this player presides over - used
    // by each state handler's validActionsForPlayer, without knowing which Corporation they'd
    // pick (there's normally only one candidate: whichever Corporation is actually in one of
    // isLeakedResearchWindow's windows right now).
    static canOfferLeakedResearch(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return state.corporations.some((corporation) =>
            HydratedLeakedResearch.canLeakedResearch(state, playerId, corporation.id)
        )
    }
}
