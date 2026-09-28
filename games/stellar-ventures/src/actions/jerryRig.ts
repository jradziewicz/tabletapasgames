import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { InvestorActionId } from '../model/investorBoard.js'
import { canSelectInvestorActionId } from '../operations/investorShenanigans.js'
import {
    awardAlienExplorersCubes,
    buildOutpostForCorporation,
    canBuildExpansionOutpost,
    canBuildOnNebulaAnomalyForCorporation,
    hasAnyValidExpansionTarget,
    resolveNebularAnomalyReveal
} from '../operations/network.js'

export type JerryRig = Type.Static<typeof JerryRig>
export const JerryRig = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.JerryRig),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId),
            hexId: Type.String()
        })
    ])
)

export const JerryRigValidator = Compile(JerryRig)

export function isJerryRig(action?: GameAction): action is JerryRig {
    return action?.type === ActionType.JerryRig
}

/**
 * Investor Shenanigans' Jerry-Rig Investor Action (rulebook page 19): "If a Shareholder, place 1
 * free Outpost for a Corporation (follow Expand Network rules). There are no Placement
 * Penalties." Unlike Expand Network (and every other Outpost-building action so far), the actor
 * only needs to hold at least 1 Share in the target Corporation - not be its President - and the
 * Outpost is entirely free, paid by nobody.
 *
 * "The Investor taking this action gains any Alien Technology cubes": if the target Corporation
 * has Alien Explorers active and hexId is an Alien Planet, the acting Investor (this.playerId,
 * not necessarily the Corporation's President) gains 1 Alien Technology Cube - see
 * operations/network.ts's awardAlienExplorersCubes.
 */
export class HydratedJerryRig extends HydratableAction<typeof JerryRig> implements JerryRig {
    declare type: ActionType.JerryRig
    declare playerId: string
    declare corporationId: CorporationId
    declare hexId: string

    constructor(data: JerryRig) {
        super(data, JerryRigValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonJerryRigInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        resolveNebularAnomalyReveal(state, this.corporationId, this.hexId)
        buildOutpostForCorporation(state, this.hexId, this.corporationId)
        awardAlienExplorersCubes(state, this.playerId, this.corporationId, [this.hexId])
        state.getPlayerState(this.playerId).lastInvestorActionId = InvestorActionId.JerryRig
    }

    isValidJerryRig(state: HydratedStellarVenturesGameState): boolean {
        return HydratedJerryRig.canJerryRig(state, this.playerId, this.corporationId, this.hexId)
    }

    reasonJerryRigInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedJerryRig.reasonJerryRigInvalid(
            state,
            this.playerId,
            this.corporationId,
            this.hexId
        )
    }

    static canJerryRig(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        hexId: string
    ): boolean {
        return (
            HydratedJerryRig.reasonJerryRigInvalid(state, playerId, corporationId, hexId) ===
            undefined
        )
    }

    static reasonJerryRigInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        hexId: string
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        if (!canSelectInvestorActionId(state, playerId, InvestorActionId.JerryRig)) {
            return 'Jerry-Rig is not available right now'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.shareCountForPlayer(playerId) <= 0) {
            return 'You must hold a Share in that Corporation to Jerry-Rig for it'
        }
        // No physical Outpost piece left in the box to place (model/corporation.ts's
        // unbuiltOutposts) - a hard stop regardless of adjacency or any Power.
        if (corporation.unbuiltOutposts <= 0) {
            return 'No unbuilt Outposts remaining'
        }
        if (
            !canBuildExpansionOutpost(
                state.board,
                corporationId,
                hexId,
                corporation.canBuildOnAlienPlanets(),
                corporation.hasActivePower(CorporatePowerId.IcarusExperiment),
                corporation.hasActivePower(CorporatePowerId.CloakingDevices),
                canBuildOnNebulaAnomalyForCorporation(state, corporationId)
            )
        ) {
            return 'An Outpost cannot be built there'
        }
        return undefined
    }

    // Whether to even offer JerryRig as an option (for any Corporation) - used by the state
    // handler's validActionsForPlayer.
    static canOfferJerryRig(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return false
        }
        if (!canSelectInvestorActionId(state, playerId, InvestorActionId.JerryRig)) {
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
                    undefined,
                    canBuildOnNebulaAnomalyForCorporation(state, corporation.id)
                )
        )
    }
}
