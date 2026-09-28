import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
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
import { CorporatePowerId } from '../model/corporation.js'

export type ExpandNetwork = Type.Static<typeof ExpandNetwork>
export const ExpandNetwork = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExpandNetwork),
            playerId: Type.String(),
            hexId: Type.String()
        })
    ])
)

export const ExpandNetworkValidator = Compile(ExpandNetwork)

export function isExpandNetwork(action?: GameAction): action is ExpandNetwork {
    return action?.type === ActionType.ExpandNetwork
}

/**
 * The Corporation's President spends from the Corporate Treasury to build 1-5 new Outposts,
 * placed one at a time across as many ExpandNetwork actions as it takes - each must be adjacent
 * to an Outpost the Corporation already has, or to one built earlier in this same in-progress
 * build (which, since it's already on the board by the time the next one is validated, falls out
 * of the ordinary adjacency check for free - see operations/network.ts's
 * canBuildExpansionOutpost). This is one of the two mutually exclusive options for the
 * Corporation Round's optional "Expand Network or Create Wormhole" step (see CreateWormhole /
 * DeclineExpandNetworkOrWormhole).
 *
 * Cost (rulebook pages 12-13's table, keyed by the TOTAL number of Outposts built this action,
 * plus ₮1 per other Corporation already at each hex) is deferred rather than charged per Outpost:
 * it accumulates in state.expandingHexIds / state.expandingPlacementPenalty and is only charged
 * as a single lump sum once the whole build ends - see operations/network.ts's finalizeExpansion,
 * called either by signing (HydratedSignTheAgreement) or by explicitly stopping
 * (DeclineExpandNetworkOrWormhole). This lets the Corporation keep building past an Alien Planet
 * it declined to sign at, right up to the point it can no longer afford (or is no longer adjacent
 * to) another Outpost.
 */
export class HydratedExpandNetwork
    extends HydratableAction<typeof ExpandNetwork>
    implements ExpandNetwork
{
    declare type: ActionType.ExpandNetwork
    declare playerId: string
    declare hexId: string

    constructor(data: ExpandNetwork) {
        super(data, ExpandNetworkValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonExpandNetworkInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.activeCorporationId
        assertExists(corporationId, 'Active corporation id should be present while expanding network')

        if (state.expandingCorporationId === undefined) {
            state.expandingCorporationId = corporationId
            state.expandingBuilderId = this.playerId
            state.expandingKind = ActionType.ExpandNetwork
            state.expandingHexIds = []
            state.expandingPlacementPenalty = 0
        }

        const penalty = placementPenaltyForHexForCorporation(state, corporationId, this.hexId)
        resolveNebularAnomalyReveal(state, corporationId, this.hexId)
        buildOutpostForCorporation(state, this.hexId, corporationId)
        state.expandingHexIds!.push(this.hexId)
        state.expandingPlacementPenalty = (state.expandingPlacementPenalty ?? 0) + penalty

        awardAlienExplorersCubes(state, this.playerId, corporationId, [this.hexId])
    }

    isValidExpandNetwork(state: HydratedStellarVenturesGameState): boolean {
        return HydratedExpandNetwork.canExpandNetwork(state, this.playerId, this.hexId)
    }

    reasonExpandNetworkInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedExpandNetwork.reasonExpandNetworkInvalid(state, this.playerId, this.hexId)
    }

    static canExpandNetwork(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string
    ): boolean {
        return (
            HydratedExpandNetwork.reasonExpandNetworkInvalid(state, playerId, hexId) === undefined
        )
    }

    static reasonExpandNetworkInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string
    ): string | undefined {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return 'No Corporation is currently active'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President may Expand Network'
        }
        if (
            state.expandingCorporationId !== undefined &&
            (state.expandingCorporationId !== corporationId ||
                state.expandingKind !== ActionType.ExpandNetwork)
        ) {
            return 'This Corporation is already mid-build with a different action'
        }
        // No physical Outpost piece left in the box to place (model/corporation.ts's
        // unbuiltOutposts) - a hard stop regardless of adjacency, cost, or any Power, since
        // there's nothing left to actually put on the hex.
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
        if (buildCost + existingPenalty + thisPenalty > corporation.treasury) {
            return 'Insufficient Funds'
        }
        return undefined
    }

    // Whether to even offer ExpandNetwork as an option (a fresh start, or another Outpost in an
    // already in-progress build), without knowing which hex a player might choose next - used by
    // the state handler's validActionsForPlayer.
    static canOfferExpandNetwork(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return false
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return false
        }
        if (
            state.expandingCorporationId !== undefined &&
            (state.expandingCorporationId !== corporationId ||
                state.expandingKind !== ActionType.ExpandNetwork)
        ) {
            return false
        }
        if (corporation.unbuiltOutposts <= 0) {
            return false
        }

        const totalCount = (state.expandingHexIds?.length ?? 0) + 1
        const buildCost = ExpandNetworkOutpostCosts[totalCount]
        if (buildCost === undefined) {
            return false
        }
        const existingPenalty = state.expandingPlacementPenalty ?? 0
        if (buildCost + existingPenalty > corporation.treasury) {
            return false
        }
        // Not just adjacency/Outpost Restrictions - a hex this Corporation could otherwise
        // legally build on but can no longer afford once its own placement penalty is added on
        // top of buildCost/existingPenalty (see canExpandNetwork above, which every actual pick
        // is still re-validated against) is not a real target either.
        return hasAnyValidExpansionTarget(
            state.board,
            corporationId,
            corporation.canBuildOnAlienPlanets(),
            corporation.hasActivePower(CorporatePowerId.IcarusExperiment),
            corporation.hasActivePower(CorporatePowerId.CloakingDevices),
            { state, maxAffordablePenalty: corporation.treasury - buildCost - existingPenalty },
            canBuildOnNebulaAnomalyForCorporation(state, corporationId)
        )
    }
}
