import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporatePowerId } from '../model/corporation.js'
import { HexType } from '../model/board.js'
import { removeOutpostForCorporation } from '../operations/network.js'

export type DismantlingOutposts = Type.Static<typeof DismantlingOutposts>
export const DismantlingOutposts = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DismantlingOutposts),
            playerId: Type.String(),
            hexId: Type.String()
        })
    ])
)

export const DismantlingOutpostsValidator = Compile(DismantlingOutposts)

export function isDismantlingOutposts(action?: GameAction): action is DismantlingOutposts {
    return action?.type === ActionType.DismantlingOutposts
}

// Glossary (page 29): "Once per Corporation Round, may return 1 Outpost from a Deep Space hex to
// the supply, paying ₮1 from the Treasury; the removed Outpost may immediately be placed as part
// of any build action."
export const DISMANTLING_OUTPOSTS_COST = 1

/**
 * Dismantling Outposts (Corporate Power Glossary, page 29): "Corporation Round, Ongoing. Once per
 * Corporation Round, may return 1 Outpost from a Deep Space hex to the supply, paying ₮1 from the
 * Treasury; the removed Outpost may immediately be placed as part of any build action." Modeled as
 * the inverse of a normal build (model/board.ts's removeOutpost / operations/network.ts's
 * removeOutpostForCorporation), which credits the Outpost back to
 * HydratedCorporationState.unbuiltOutposts - from there it's immediately available to any of this
 * Corporation's normal build actions (ExpandNetwork, CreateWormhole, etc.), so nothing further is
 * needed to model "may immediately be placed as part of any build action".
 *
 * Offered alongside Alien Alchemist during this Corporation's Expand Network / Wormhole step (the
 * "Corporation Round, Ongoing" step where the rest of this Corporation's discretionary Corporation
 * Round choices live) - see stateHandlers/expandNetworkOrWormhole.ts. The once-per-Corporation-
 * Round limit is tracked by state.dismantlingOutpostsUsedThisCorporationRound, reset alongside
 * alienAlchemistUsedThisCorporationRound in operations/corporationRound.ts's
 * advanceToNextCorporationOrInvestorRound.
 */
export class HydratedDismantlingOutposts
    extends HydratableAction<typeof DismantlingOutposts>
    implements DismantlingOutposts
{
    declare type: ActionType.DismantlingOutposts
    declare playerId: string
    declare hexId: string

    constructor(data: DismantlingOutposts) {
        super(data, DismantlingOutpostsValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDismantlingOutpostsInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.activeCorporationId
        assertExists(
            corporationId,
            'Active corporation id should be present while using Dismantling Outposts'
        )
        const corporation = state.getCorporation(corporationId)

        corporation.treasury -= DISMANTLING_OUTPOSTS_COST
        removeOutpostForCorporation(state, this.hexId, corporationId)
        state.dismantlingOutpostsUsedThisCorporationRound = true
    }

    isValidDismantlingOutposts(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDismantlingOutposts.canDismantlingOutposts(state, this.playerId, this.hexId)
    }

    reasonDismantlingOutpostsInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDismantlingOutposts.reasonDismantlingOutpostsInvalid(
            state,
            this.playerId,
            this.hexId
        )
    }

    static canDismantlingOutposts(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string
    ): boolean {
        return (
            HydratedDismantlingOutposts.reasonDismantlingOutpostsInvalid(
                state,
                playerId,
                hexId
            ) === undefined
        )
    }

    static reasonDismantlingOutpostsInvalid(
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
            return 'Only the President may use Dismantling Outposts'
        }
        if (!corporation.hasActivePower(CorporatePowerId.DismantlingOutposts)) {
            return 'This Corporation does not have the Dismantling Outposts Power'
        }
        if (state.dismantlingOutpostsUsedThisCorporationRound) {
            return 'Dismantling Outposts has already been used this Corporation Round'
        }
        if (corporation.treasury < DISMANTLING_OUTPOSTS_COST) {
            return 'Insufficient Funds'
        }
        const hex = state.board.getHex(hexId)
        if (!hex || hex.type !== HexType.DeepSpace) {
            return 'That is not a Deep Space hex'
        }
        if (!hex.outposts.includes(corporationId)) {
            return 'This Corporation does not have an Outpost there'
        }
        return undefined
    }

    // Whether to even offer DismantlingOutposts as an option - used by the state handler's
    // validActionsForPlayer. Unlike AlienAlchemist (which needs no target), this needs at least
    // one valid Deep Space hex with this Corporation's own Outpost on it.
    static canOfferDismantlingOutposts(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return false
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return false
        }
        if (!corporation.hasActivePower(CorporatePowerId.DismantlingOutposts)) {
            return false
        }
        if (state.dismantlingOutpostsUsedThisCorporationRound) {
            return false
        }
        if (corporation.treasury < DISMANTLING_OUTPOSTS_COST) {
            return false
        }
        return Object.values(state.board.hexes).some(
            (hex) => hex.type === HexType.DeepSpace && hex.outposts.includes(corporationId)
        )
    }
}
