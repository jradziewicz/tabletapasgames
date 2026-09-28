import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    awardAlienExplorersCubes,
    buildOutpostForCorporation,
    canBuildOnNebulaAnomalyForCorporation,
    createWormholeCostForCorporation,
    resolveNebularAnomalyReveal
} from '../operations/network.js'
import { CorporatePowerId } from '../model/corporation.js'

export type CreateWormhole = Type.Static<typeof CreateWormhole>
export const CreateWormhole = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CreateWormhole),
            playerId: Type.String(),
            hexId: Type.String()
        })
    ])
)

export const CreateWormholeValidator = Compile(CreateWormhole)

export function isCreateWormhole(action?: GameAction): action is CreateWormhole {
    return action?.type === ActionType.CreateWormhole
}

/**
 * Requires active Wormhole Technology (corporation.wormholeActive). The Corporation's President
 * spends from the Corporate Treasury to build exactly 1 Outpost anywhere on the board - all
 * Outpost Restrictions still apply (Icarus Experiment lifts the Sun/Anomaly one; see
 * model/board.ts's canBuildOutpost), but there's no adjacency requirement. Cost is ₮1 per hex
 * skipped from the Corporation's nearest existing Outpost, +₮4 flat, +₮1 per other Corporation
 * already present in the target hex, minus Quantum Propulsion's ₮2 discount if active (see
 * operations/network.ts's createWormholeCostForCorporation). This is one of the two mutually
 * exclusive options for the Corporation Round's optional "Expand Network or Create Wormhole"
 * step (see ExpandNetwork / DeclineExpandNetworkOrWormhole).
 */
export class HydratedCreateWormhole
    extends HydratableAction<typeof CreateWormhole>
    implements CreateWormhole
{
    declare type: ActionType.CreateWormhole
    declare playerId: string
    declare hexId: string

    constructor(data: CreateWormhole) {
        super(data, CreateWormholeValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonCreateWormholeInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.activeCorporationId
        assertExists(corporationId, 'Active corporation id should be present while creating a wormhole')
        const corporation = state.getCorporation(corporationId)

        const cost = createWormholeCostForCorporation(state, corporationId, this.hexId)
        assertExists(cost, 'Create Wormhole cost should be computable while applying it')

        resolveNebularAnomalyReveal(state, corporationId, this.hexId)
        buildOutpostForCorporation(state, this.hexId, corporationId)
        corporation.treasury -= cost
        awardAlienExplorersCubes(state, this.playerId, corporationId, [this.hexId])
    }

    isValidCreateWormhole(state: HydratedStellarVenturesGameState): boolean {
        return HydratedCreateWormhole.canCreateWormhole(state, this.playerId, this.hexId)
    }

    reasonCreateWormholeInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedCreateWormhole.reasonCreateWormholeInvalid(state, this.playerId, this.hexId)
    }

    static canCreateWormhole(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string
    ): boolean {
        return HydratedCreateWormhole.reasonCreateWormholeInvalid(state, playerId, hexId) === undefined
    }

    static reasonCreateWormholeInvalid(
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
            return 'Only the President may Create a Wormhole'
        }
        // Create Wormhole is a single, instantaneous build (unlike Expand Network/Private
        // Contractor, which accumulate over several actions via state.expandingCorporationId/
        // expandingKind - see this class's own doc comment) - expandingKind is therefore never
        // itself ActionType.CreateWormhole, so any in-progress build at all (this Corporation's
        // own Expand Network build included) means Create Wormhole must not be offered as a
        // fallback. Without this, once a build's OTHER kind was already in progress (e.g.
        // mid-ExpandNetwork, right after the 5th and final Outpost makes
        // ExpandNetworkOutpostCosts[6] undefined and canOfferExpandNetwork correctly stops
        // offering "another" Outpost), Board.svelte used to silently fall through into Create
        // Wormhole mode instead of just prompting to stop/finish the in-progress build.
        if (state.expandingCorporationId !== undefined) {
            return 'Finish the Outpost build already in progress first'
        }
        if (!corporation.wormholeActive) {
            return 'This Corporation does not have active Wormhole Technology'
        }
        // No physical Outpost piece left in the box to place (model/corporation.ts's
        // unbuiltOutposts) - a hard stop regardless of adjacency, cost, or any Power.
        if (corporation.unbuiltOutposts <= 0) {
            return 'No unbuilt Outposts remaining'
        }
        const canBuildOnAlienPlanets = corporation.canBuildOnAlienPlanets()
        const canBuildOnSunAnomalies = corporation.hasActivePower(CorporatePowerId.IcarusExperiment)
        const ignoresDeepSpaceOutpostCap = corporation.hasActivePower(CorporatePowerId.CloakingDevices)
        const canBuildOnNebulaAnomaly = canBuildOnNebulaAnomalyForCorporation(state, corporationId)
        if (
            !state.board.canBuildOutpost(
                hexId,
                corporationId,
                canBuildOnAlienPlanets,
                canBuildOnSunAnomalies,
                ignoresDeepSpaceOutpostCap,
                canBuildOnNebulaAnomaly
            )
        ) {
            return 'An Outpost cannot be built there'
        }
        const cost = createWormholeCostForCorporation(state, corporationId, hexId)
        if (cost === undefined) {
            return 'Wormhole cost could not be determined for that hex'
        }
        if (cost > corporation.treasury) {
            return 'Insufficient Funds'
        }
        return undefined
    }

    // Whether to even offer CreateWormhole as an option, without knowing which hex a player
    // might choose - used by the state handler's validActionsForPlayer.
    static canOfferCreateWormhole(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return false
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return false
        }
        // See canCreateWormhole's identical guard above for why this matters.
        if (state.expandingCorporationId !== undefined) {
            return false
        }
        return (
            corporation.wormholeActive && corporation.treasury > 0 && corporation.unbuiltOutposts > 0
        )
    }
}
