import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporatePowerId } from '../model/corporation.js'

export type AlienAlchemist = Type.Static<typeof AlienAlchemist>
export const AlienAlchemist = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AlienAlchemist),
            playerId: Type.String()
        })
    ])
)

export const AlienAlchemistValidator = Compile(AlienAlchemist)

export function isAlienAlchemist(action?: GameAction): action is AlienAlchemist {
    return action?.type === ActionType.AlienAlchemist
}

// Glossary (page 29): "Once per Corporation Round, remove 2 unbuilt Outposts of this Corporation
// and return them to the box, gaining 1 Alien Technology Cube."
export const ALIEN_ALCHEMIST_OUTPOST_COST = 2
export const ALIEN_ALCHEMIST_CUBE_REWARD = 1

/**
 * Alien Alchemist (Corporate Power Glossary, page 29): "Corporation Round, Ongoing. Once per
 * Corporation Round, President may remove 2 unbuilt Outposts of this Corporation and return them
 * to the box, gaining 1 Alien Technology Cube." Modeled against a real per-Corporation Outpost
 * supply (model/corporation.ts's OutpostSupplyByCorporationId /
 * HydratedCorporationState.unbuiltOutposts) - this simply removes 2 from that count (never built,
 * so nothing changes on the board) and grants the President 1 Alien Technology Cube.
 *
 * Offered as an option during this Corporation's Expand Network / Wormhole step (the "Corporation
 * Round, Ongoing" step where the rest of this Corporation's discretionary Corporation Round
 * choices live) - see stateHandlers/expandNetworkOrWormhole.ts. The once-per-Corporation-Round
 * limit is tracked by state.alienAlchemistUsedThisCorporationRound, reset every time
 * operations/corporationRound.ts's advanceToNextCorporationOrInvestorRound hands the Corporation
 * Round off to a new Corporation (or ends it) - not by this state handler's own enter(), since
 * that can re-fire multiple times within the same Corporation's turn (e.g. after each Outpost
 * built via Expand Network) and would otherwise let the same Corporation use it again.
 */
export class HydratedAlienAlchemist
    extends HydratableAction<typeof AlienAlchemist>
    implements AlienAlchemist
{
    declare type: ActionType.AlienAlchemist
    declare playerId: string

    constructor(data: AlienAlchemist) {
        super(data, AlienAlchemistValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonAlienAlchemistInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.activeCorporationId
        assertExists(corporationId, 'Active corporation id should be present while using Alien Alchemist')
        const corporation = state.getCorporation(corporationId)

        corporation.unbuiltOutposts -= ALIEN_ALCHEMIST_OUTPOST_COST
        state.getPlayerState(this.playerId).addAlienTechCubes(ALIEN_ALCHEMIST_CUBE_REWARD)
        state.alienAlchemistUsedThisCorporationRound = true
    }

    isValidAlienAlchemist(state: HydratedStellarVenturesGameState): boolean {
        return HydratedAlienAlchemist.canAlienAlchemist(state, this.playerId)
    }

    reasonAlienAlchemistInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedAlienAlchemist.reasonAlienAlchemistInvalid(state, this.playerId)
    }

    // Used both to validate the action and to decide whether to even offer it - there's no
    // per-attempt parameter (like a target hex) that would make those two checks diverge.
    static canAlienAlchemist(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedAlienAlchemist.reasonAlienAlchemistInvalid(state, playerId) === undefined
    }

    static reasonAlienAlchemistInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return 'No Corporation is currently active'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President may use Alien Alchemist'
        }
        if (!corporation.hasActivePower(CorporatePowerId.AlienAlchemist)) {
            return 'This Corporation does not have the Alien Alchemist Power'
        }
        if (state.alienAlchemistUsedThisCorporationRound) {
            return 'Alien Alchemist has already been used this Corporation Round'
        }
        if (corporation.unbuiltOutposts < ALIEN_ALCHEMIST_OUTPOST_COST) {
            return `Needs ${ALIEN_ALCHEMIST_OUTPOST_COST} unbuilt Outposts remaining`
        }
        return undefined
    }
}
