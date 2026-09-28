import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { InvestorActionId } from '../model/investorBoard.js'
import { canSelectInvestorActionId } from '../operations/investorShenanigans.js'
import {
    ExpandNetworkOutpostCosts,
    awardAlienExplorersCubes,
    buildOutpostForCorporation,
    canBuildExpansionOutpost,
    canBuildOnNebulaAnomalyForCorporation,
    hasAnyValidExpansionTarget,
    placementPenaltyForHexForCorporation,
    resolveNebularAnomalyReveal
} from '../operations/network.js'

export type PrivateContractor = Type.Static<typeof PrivateContractor>
export const PrivateContractor = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PrivateContractor),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId),
            hexId: Type.String()
        })
    ])
)

export const PrivateContractorValidator = Compile(PrivateContractor)

export function isPrivateContractor(action?: GameAction): action is PrivateContractor {
    return action?.type === ActionType.PrivateContractor
}

/**
 * Investor Shenanigans' Private Contractor Investor Action (rulebook page 19): build 1-5 Outposts
 * for a Corporation paying normal costs, following Expand Network rules - including the same
 * ₮1-per-other-Corporation placement penalty (unlike Jerry-Rig, which is exempt from it). Like
 * Jerry-Rig, the actor only needs to hold at least 1 Share in the target Corporation - not be its
 * President - but here the build isn't free: it costs the same amount Expand Network would (base
 * cost table plus placement penalty - see operations/network.ts's ExpandNetworkOutpostCosts /
 * placementPenaltyForHexForCorporation), just paid by the acting Investor personally rather than
 * the Corporate Treasury.
 *
 * Like Expand Network, Outposts are built one at a time across as many PrivateContractor actions
 * as it takes (up to 5), cost (base + placement penalty) deferred and accumulated incrementally -
 * see state.expandingPlacementPenalty below, computed the same way actions/expandNetwork.ts does
 * and for the same reason: recomputing it from the finished hexIds list afterward would double-
 * count this build's own already-placed Outposts - then charged as a single lump sum only once
 * the whole build ends - see operations/network.ts's finalizeExpansion, called either by signing
 * or by explicitly stopping (actions/finishExpansion.ts, Private Contractor's equivalent of
 * DeclineExpandNetworkOrWormhole).
 *
 * "The Investor taking this action gains any Alien Technology cubes": for each hex built that's
 * an Alien Planet (only buildable at all if the target Corporation has Alien Explorers active),
 * the acting Investor (this.playerId) gains 1 Alien Technology Cube - see
 * operations/network.ts's awardAlienExplorersCubes.
 */
export class HydratedPrivateContractor
    extends HydratableAction<typeof PrivateContractor>
    implements PrivateContractor
{
    declare type: ActionType.PrivateContractor
    declare playerId: string
    declare corporationId: CorporationId
    declare hexId: string

    constructor(data: PrivateContractor) {
        super(data, PrivateContractorValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonPrivateContractorInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        if (state.expandingCorporationId === undefined) {
            state.expandingCorporationId = this.corporationId
            state.expandingBuilderId = this.playerId
            state.expandingKind = ActionType.PrivateContractor
            state.expandingHexIds = []
            state.expandingPlacementPenalty = 0
        }

        const penalty = placementPenaltyForHexForCorporation(state, this.corporationId, this.hexId)
        resolveNebularAnomalyReveal(state, this.corporationId, this.hexId)
        buildOutpostForCorporation(state, this.hexId, this.corporationId)
        state.expandingHexIds!.push(this.hexId)
        state.expandingPlacementPenalty = (state.expandingPlacementPenalty ?? 0) + penalty

        awardAlienExplorersCubes(state, this.playerId, this.corporationId, [this.hexId])
        state.getPlayerState(this.playerId).lastInvestorActionId = InvestorActionId.PrivateContractor
    }

    isValidPrivateContractor(state: HydratedStellarVenturesGameState): boolean {
        return HydratedPrivateContractor.canPrivateContractor(
            state,
            this.playerId,
            this.corporationId,
            this.hexId
        )
    }

    reasonPrivateContractorInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedPrivateContractor.reasonPrivateContractorInvalid(
            state,
            this.playerId,
            this.corporationId,
            this.hexId
        )
    }

    static canPrivateContractor(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        hexId: string
    ): boolean {
        return (
            HydratedPrivateContractor.reasonPrivateContractorInvalid(
                state,
                playerId,
                corporationId,
                hexId
            ) === undefined
        )
    }

    static reasonPrivateContractorInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        hexId: string
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }

        const corporation = state.getCorporation(corporationId)

        // Only a genuinely continuing Private Contractor build BY THIS PLAYER counts as "in
        // progress" here - expandingCorporationId is a single flag shared with Expand Network
        // (Corporation Round), so a leftover value of the wrong kind or belonging to a
        // different player is stale garbage (see stateHandlers/investorAction.ts's own
        // defensive cleanup), not a real block. Checking expandingKind/expandingBuilderId
        // directly - rather than "is expandingCorporationId set at all" - means a stale value
        // simply falls through to the "starting a fresh build" branch below instead of
        // wrongly refusing this player's brand new build.
        if (
            state.expandingKind === ActionType.PrivateContractor &&
            state.expandingBuilderId === playerId
        ) {
            // Continuing an in-progress build.
            if (state.expandingCorporationId !== corporationId) {
                return 'A different Private Contractor build is already in progress'
            }
        } else {
            // Starting a fresh build.
            if (!canSelectInvestorActionId(state, playerId, InvestorActionId.PrivateContractor)) {
                return 'Private Contractor is not available right now'
            }
            if (corporation.shareCountForPlayer(playerId) <= 0) {
                return 'You must hold a Share in that Corporation to use Private Contractor for it'
            }
        }

        if (corporation.unbuiltOutposts <= 0) {
            return 'No unbuilt Outposts remaining'
        }

        const canBuildOnAlienPlanets = corporation.canBuildOnAlienPlanets()
        const canBuildOnSunAnomalies = corporation.hasActivePower(CorporatePowerId.IcarusExperiment)
        const ignoresDeepSpaceOutpostCap = corporation.hasActivePower(CorporatePowerId.CloakingDevices)
        const canBuildOnNebulaAnomaly = canBuildOnNebulaAnomalyForCorporation(state, corporationId)
        if (
            !canBuildExpansionOutpost(
                state.board,
                corporationId,
                hexId,
                canBuildOnAlienPlanets,
                canBuildOnSunAnomalies,
                ignoresDeepSpaceOutpostCap,
                canBuildOnNebulaAnomaly
            )
        ) {
            return 'An Outpost cannot be built there'
        }

        const totalCount = (state.expandingHexIds?.length ?? 0) + 1
        const buildCost = ExpandNetworkOutpostCosts[totalCount]
        if (buildCost === undefined) {
            return 'The maximum number of Outposts has already been built this turn'
        }
        const existingPenalty = state.expandingPlacementPenalty ?? 0
        const thisPenalty = placementPenaltyForHexForCorporation(state, corporationId, hexId)
        if (
            buildCost + existingPenalty + thisPenalty >
            state.getPlayerState(playerId).liquidFunds
        ) {
            return 'Insufficient Funds'
        }
        return undefined
    }

    // Whether to even offer PrivateContractor as an option (for any Corporation, or another
    // Outpost in an already in-progress build) - used by the state handler's
    // validActionsForPlayer.
    static canOfferPrivateContractor(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return false
        }

        // See canPrivateContractor's own comment above - only a genuine continuing Private
        // Contractor build BY THIS PLAYER should be treated as "in progress"; anything else
        // left in expandingCorporationId is stale and falls through to "starting a fresh
        // build" below instead of wrongly blocking it.
        if (state.expandingKind === ActionType.PrivateContractor && state.expandingBuilderId === playerId) {
            // Continuing an in-progress build.
            const corporation = state.getCorporation(state.expandingCorporationId!)
            if (corporation.unbuiltOutposts <= 0) {
                return false
            }
            const totalCount = (state.expandingHexIds?.length ?? 0) + 1
            const cost = ExpandNetworkOutpostCosts[totalCount]
            const existingPenalty = state.expandingPlacementPenalty ?? 0
            const liquidFunds = state.getPlayerState(playerId).liquidFunds
            if (cost === undefined || cost + existingPenalty > liquidFunds) {
                return false
            }
            return hasAnyValidExpansionTarget(
                state.board,
                corporation.id,
                corporation.canBuildOnAlienPlanets(),
                corporation.hasActivePower(CorporatePowerId.IcarusExperiment),
                corporation.hasActivePower(CorporatePowerId.CloakingDevices),
                { state, maxAffordablePenalty: liquidFunds - cost - existingPenalty },
                canBuildOnNebulaAnomalyForCorporation(state, corporation.id)
            )
        }

        // Starting a fresh build.
        if (!canSelectInvestorActionId(state, playerId, InvestorActionId.PrivateContractor)) {
            return false
        }
        const freshLiquidFunds = state.getPlayerState(playerId).liquidFunds
        const freshBuildCost = ExpandNetworkOutpostCosts[1]!
        if (freshLiquidFunds < freshBuildCost) {
            return false
        }
        return state.corporations.some(
            (corporation) =>
                corporation.shareCountForPlayer(playerId) > 0 &&
                corporation.unbuiltOutposts > 0 &&
                hasAnyValidExpansionTarget(
                    state.board,
                    corporation.id,
                    corporation.canBuildOnAlienPlanets(),
                    corporation.hasActivePower(CorporatePowerId.IcarusExperiment),
                    corporation.hasActivePower(CorporatePowerId.CloakingDevices),
                    { state, maxAffordablePenalty: freshLiquidFunds - freshBuildCost },
                    canBuildOnNebulaAnomalyForCorporation(state, corporation.id)
                )
        )
    }
}
