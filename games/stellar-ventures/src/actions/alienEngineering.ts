import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'

export type AlienEngineering = Type.Static<typeof AlienEngineering>
export const AlienEngineering = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AlienEngineering),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId),
            cargoBoostCubesToReclaim: Type.Number(),
            reclaimWormhole: Type.Boolean()
        })
    ])
)

export const AlienEngineeringValidator = Compile(AlienEngineering)

export function isAlienEngineering(action?: GameAction): action is AlienEngineering {
    return action?.type === ActionType.AlienEngineering
}

/**
 * Alien Engineering (Corporate Power Glossary, page 29): "Investor Round, Ongoing. President may
 * reclaim any number of Technology Cubes from the Charter as a free action; the Corporation
 * immediately loses Cargo Boost and/or Wormhole access." The exact inverse of the two ways a
 * Corporation spends Alien Technology Cubes onto its own Charter:
 *   - Cargo Boost (actions/cargoBoost.ts): each reclaimed cube (cargoBoostCubesToReclaim, up to
 *     corporation.cargoBoostCubesOnCharter) removes exactly 1 CARGO, the same 1-for-1 rate it was
 *     granted at (floored at 0, in case CARGO was separately reduced since, e.g. by Scrapping).
 *   - Research Wormhole / Leaked Research (reclaimWormhole): gives up Wormhole Technology
 *     (corporation.wormholeActive) entirely to reclaim its single cube - there's no partial
 *     reclaim of a boolean.
 * "As a free action" mirrors Leaked Research's own "free" wording (see actions/leakedResearch.ts)
 * - it doesn't cost the President their once-per-Investor-Round Alien Tech Action disc move, so
 * - unlike every other action in stateHandlers/alienTechAction.ts - taking it does NOT advance to
 * the next Investor Shenanigans player. Per the co-designer, "Investor Round, Ongoing" timing
 * means this is offered across BOTH halves of this player's Investor Shenanigans turn - their
 * Investor Action and their Alien Tech Action (see stateHandlers/investorAction.ts and
 * stateHandlers/alienTechAction.ts) - not just the latter; either way it loops back to the same
 * state rather than advancing. "Ongoing" (not One-Time), so the Power itself is never discarded
 * and can be used again on a later turn.
 */
export class HydratedAlienEngineering
    extends HydratableAction<typeof AlienEngineering>
    implements AlienEngineering
{
    declare type: ActionType.AlienEngineering
    declare playerId: string
    declare corporationId: CorporationId
    declare cargoBoostCubesToReclaim: number
    declare reclaimWormhole: boolean

    constructor(data: AlienEngineering) {
        super(data, AlienEngineeringValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonAlienEngineeringInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporation = state.getCorporation(this.corporationId)

        const cubesReclaimed = this.cargoBoostCubesToReclaim + (this.reclaimWormhole ? 1 : 0)
        state.getPlayerState(this.playerId).addAlienTechCubes(cubesReclaimed)

        corporation.cargoBoostCubesOnCharter =
            (corporation.cargoBoostCubesOnCharter ?? 0) - this.cargoBoostCubesToReclaim
        corporation.cargo = Math.max(0, corporation.cargo - this.cargoBoostCubesToReclaim)

        if (this.reclaimWormhole) {
            corporation.wormholeActive = false
        }
    }

    isValidAlienEngineering(state: HydratedStellarVenturesGameState): boolean {
        return HydratedAlienEngineering.canAlienEngineering(
            state,
            this.playerId,
            this.corporationId,
            this.cargoBoostCubesToReclaim,
            this.reclaimWormhole
        )
    }

    reasonAlienEngineeringInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedAlienEngineering.reasonAlienEngineeringInvalid(
            state,
            this.playerId,
            this.corporationId,
            this.cargoBoostCubesToReclaim,
            this.reclaimWormhole
        )
    }

    static canAlienEngineering(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        cargoBoostCubesToReclaim: number,
        reclaimWormhole: boolean
    ): boolean {
        return (
            HydratedAlienEngineering.reasonAlienEngineeringInvalid(
                state,
                playerId,
                corporationId,
                cargoBoostCubesToReclaim,
                reclaimWormhole
            ) === undefined
        )
    }

    static reasonAlienEngineeringInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        cargoBoostCubesToReclaim: number,
        reclaimWormhole: boolean
    ): string | undefined {
        if (
            state.machineState !== MachineState.AlienTechAction &&
            state.machineState !== MachineState.InvestorAction
        ) {
            return 'Alien Engineering can only be used during Investor Shenanigans'
        }
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President may use Alien Engineering'
        }
        if (!corporation.hasActivePower(CorporatePowerId.AlienEngineering)) {
            return 'This Corporation does not have the Alien Engineering Power'
        }
        if (
            !Number.isInteger(cargoBoostCubesToReclaim) ||
            cargoBoostCubesToReclaim < 0 ||
            cargoBoostCubesToReclaim > (corporation.cargoBoostCubesOnCharter ?? 0)
        ) {
            return 'Cannot reclaim that many Cargo Boost cubes'
        }
        if (reclaimWormhole && !corporation.wormholeActive) {
            return 'This Corporation does not have an active Wormhole to reclaim'
        }
        // Must reclaim something - a no-op use isn't meaningful.
        if (!(cargoBoostCubesToReclaim > 0 || reclaimWormhole)) {
            return 'At least one cube or the Wormhole must be reclaimed'
        }
        return undefined
    }

    // Whether to even offer AlienEngineering as an option, for ANY Corporation this player
    // presides over - used by both stateHandlers/investorAction.ts's and
    // stateHandlers/alienTechAction.ts's validActionsForPlayer. Doesn't check machineState
    // itself - canAlienEngineering above is what actually restricts which of the two windows it
    // can be submitted in, and both state handlers only ever call this while their own player is
    // already the active Investor Shenanigans player.
    static canOfferAlienEngineering(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return false
        }
        return state.corporations.some((corporation) => {
            if (corporation.getPresidentPlayerId() !== playerId) {
                return false
            }
            if (!corporation.hasActivePower(CorporatePowerId.AlienEngineering)) {
                return false
            }
            return (corporation.cargoBoostCubesOnCharter ?? 0) > 0 || corporation.wormholeActive
        })
    }
}
