import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId } from '../model/corporation.js'
import { AlienTechActionId } from '../model/investorBoard.js'
import { canSelectAlienTechActionId } from '../operations/investorShenanigans.js'

export type ResearchWormhole = Type.Static<typeof ResearchWormhole>
export const ResearchWormhole = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ResearchWormhole),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId)
        })
    ])
)

export const ResearchWormholeValidator = Compile(ResearchWormhole)

export function isResearchWormhole(action?: GameAction): action is ResearchWormhole {
    return action?.type === ActionType.ResearchWormhole
}

const ALIEN_TECH_CUBES_COST = 1

/**
 * Investor Shenanigans' Research Wormhole Alien Tech Action (rulebook page 19): "If a
 * Shareholder, add 1 cube to a Corporation's Charter to unlock Wormhole Technology. Required to
 * use Create Wormhole." Requires holding at least 1 Share in the target Corporation (not
 * President) and sets corporation.wormholeActive - the same flag Create Wormhole already checks
 * (see actions/createWormhole.ts). Not offered once a Corporation's Wormhole Technology is
 * already active, since spending the cube again would do nothing.
 */
export class HydratedResearchWormhole
    extends HydratableAction<typeof ResearchWormhole>
    implements ResearchWormhole
{
    declare type: ActionType.ResearchWormhole
    declare playerId: string
    declare corporationId: CorporationId

    constructor(data: ResearchWormhole) {
        super(data, ResearchWormholeValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonResearchWormholeInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporation = state.getCorporation(this.corporationId)
        const player = state.getPlayerState(this.playerId)
        player.spendAlienTechCubes(ALIEN_TECH_CUBES_COST)
        corporation.wormholeActive = true
        player.lastAlienTechActionId = AlienTechActionId.ResearchWormhole
    }

    isValidResearchWormhole(state: HydratedStellarVenturesGameState): boolean {
        return HydratedResearchWormhole.canResearchWormhole(state, this.playerId, this.corporationId)
    }

    reasonResearchWormholeInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedResearchWormhole.reasonResearchWormholeInvalid(
            state,
            this.playerId,
            this.corporationId
        )
    }

    static canResearchWormhole(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): boolean {
        return (
            HydratedResearchWormhole.reasonResearchWormholeInvalid(
                state,
                playerId,
                corporationId
            ) === undefined
        )
    }

    static reasonResearchWormholeInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        if (!canSelectAlienTechActionId(state, playerId, AlienTechActionId.ResearchWormhole)) {
            return 'Research Wormhole is not available right now'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.wormholeActive) {
            return 'This Corporation already has an active Wormhole'
        }
        if (corporation.shareCountForPlayer(playerId) <= 0) {
            return 'You must hold a Share in that Corporation to Research Wormhole for it'
        }
        if (state.getPlayerState(playerId).alienTechCubes < ALIEN_TECH_CUBES_COST) {
            return 'Insufficient Alien Technology cubes'
        }
        return undefined
    }

    // Whether to even offer ResearchWormhole as an option (for any Corporation) - used by the
    // state handler's validActionsForPlayer.
    static canOfferResearchWormhole(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return false
        }
        if (!canSelectAlienTechActionId(state, playerId, AlienTechActionId.ResearchWormhole)) {
            return false
        }
        if (state.getPlayerState(playerId).alienTechCubes < ALIEN_TECH_CUBES_COST) {
            return false
        }
        return state.corporations.some(
            (corporation) =>
                !corporation.wormholeActive && corporation.shareCountForPlayer(playerId) > 0
        )
    }
}
