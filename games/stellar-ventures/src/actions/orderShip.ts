import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    canOrderAnotherShip,
    emptyShipColumnCount,
    resolveFirstShipOrderedEffects,
    shipCost
} from '../operations/shipOrdering.js'

export type OrderShip = Type.Static<typeof OrderShip>
export const OrderShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.OrderShip),
            playerId: Type.String(),
            // Echoes the Shipyard's current lowest-available level, so the action is explicit
            // about (and can validate) exactly which Ship it's ordering - see the "Lowest Level
            // First" Ship Buying Restriction (rulebook page 16).
            level: Type.Number()
        })
    ])
)

export const OrderShipValidator = Compile(OrderShip)

export function isOrderShip(action?: GameAction): action is OrderShip {
    return action?.type === ActionType.OrderShip
}

/**
 * The Corporation's President orders a single Ship from the Shipyard, one at a time (rulebook
 * page 16). Order Ships is "Conditionally Mandatory": a Corporation with zero Ships anywhere on
 * its Charter must Order at least 1 (Forced Purchase); otherwise ordering is entirely optional,
 * up to 1 Ship per empty Ship column (Standard Purchase) - see operations/shipOrdering.ts and
 * DeclineOrderShips. Ships can only ever be Ordered from the Shipyard's current lowest available
 * level. Ordering a section's first-ever Ship may also flip its Alien Shipyard tile and/or
 * trigger a Scrapping Event - see resolveFirstShipOrderedEffects.
 */
export class HydratedOrderShip extends HydratableAction<typeof OrderShip> implements OrderShip {
    declare type: ActionType.OrderShip
    declare playerId: string
    declare level: number

    constructor(data: OrderShip) {
        super(data, OrderShipValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonOrderShipInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.activeCorporationId
        assertExists(corporationId, 'Active corporation id should be present while ordering a ship')
        const corporation = state.getCorporation(corporationId)

        const orderedLevel = state.shipyard.takeLowestShip()
        corporation.orderedShipLevels.push(orderedLevel)
        corporation.treasury -= shipCost(orderedLevel)

        // Flags this action itself as beyond Undo whenever it happens to be the one that flips a
        // still-hidden Alien Shipyard tile face up - secret information a player must not be able
        // to peek at and then take back (see resolveFirstShipOrderedEffects).
        if (resolveFirstShipOrderedEffects(state, orderedLevel)) {
            this.revealsInfo = true
        }
    }

    isValidOrderShip(state: HydratedStellarVenturesGameState): boolean {
        return HydratedOrderShip.canOrderShip(state, this.playerId, this.level)
    }

    reasonOrderShipInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedOrderShip.reasonOrderShipInvalid(state, this.playerId, this.level)
    }

    static canOrderShip(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        level: number
    ): boolean {
        return HydratedOrderShip.reasonOrderShipInvalid(state, playerId, level) === undefined
    }

    static reasonOrderShipInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        level: number
    ): string | undefined {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return 'No Corporation is currently active'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President may Order a Ship'
        }
        const section = state.shipyard.lowestAvailableSection()
        if (!section || section.level !== level) {
            return 'That Ship level is not currently available to order'
        }
        if (!canOrderAnotherShip(state.shipyard, corporation)) {
            return 'No more Ships may be Ordered right now'
        }
        return undefined
    }

    // Whether to even offer OrderShip as an option - used by the state handler's
    // validActionsForPlayer.
    static canOfferOrderShip(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return false
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return false
        }
        if (emptyShipColumnCount(corporation) <= 0) {
            return false
        }
        return canOrderAnotherShip(state.shipyard, corporation)
    }
}
