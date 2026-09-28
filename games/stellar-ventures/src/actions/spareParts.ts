import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { CorporatePowerId } from '../model/corporation.js'

export type SpareParts = Type.Static<typeof SpareParts>
export const SpareParts = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SpareParts),
            playerId: Type.String()
        })
    ])
)

export const SparePartsValidator = Compile(SpareParts)

export function isSpareParts(action?: GameAction): action is SpareParts {
    return action?.type === ActionType.SpareParts
}

/**
 * Spare Parts (Corporate Power Glossary, page 29): "Anytime, One-Time (limit 1 Ship). When a Ship
 * of this Corporation would be Scrapped, the President may move 1 of those Ships onto this tile
 * instead, delaying its Scrap (and the CARGO reduction) by one Dividend payment." Offered only via
 * OfferSparePartsStateHandler, immediately after operations/shipOrdering.ts's applyScrappingEvent
 * pulls one qualifying Delivered Ship off this Corporation's Charter without yet reducing CARGO -
 * state.pendingSparePartsCorporationId / pendingSparePartsShipLevel name it.
 *
 * Using the Power moves that Ship onto the Spare Parts tile (state.sparePartsParkedCorporationId /
 * sparePartsParkedShipLevel) instead of scrapping it for good right now, and - being One-Time -
 * discards the Power from the Charter. actions/payDividends.ts is what finally scraps the parked
 * Ship for real (reducing CARGO then), exactly one Dividend payment later. See
 * actions/declineSpareParts.ts for the alternative.
 */
export class HydratedSpareParts extends HydratableAction<typeof SpareParts> implements SpareParts {
    declare type: ActionType.SpareParts
    declare playerId: string

    constructor(data: SpareParts) {
        super(data, SparePartsValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonSparePartsInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.pendingSparePartsCorporationId
        assertExists(corporationId, 'A Corporation should be pending Spare Parts')
        const corporation = state.getCorporation(corporationId)

        state.sparePartsParkedCorporationId = corporationId
        state.sparePartsParkedShipLevel = state.pendingSparePartsShipLevel
        state.pendingSparePartsCorporationId = undefined
        state.pendingSparePartsShipLevel = undefined

        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.SpareParts
        )
    }

    isValidSpareParts(state: HydratedStellarVenturesGameState): boolean {
        return HydratedSpareParts.canSpareParts(state, this.playerId)
    }

    reasonSparePartsInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedSpareParts.reasonSparePartsInvalid(state, this.playerId)
    }

    static canSpareParts(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedSpareParts.reasonSparePartsInvalid(state, playerId) === undefined
    }

    static reasonSparePartsInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.machineState !== MachineState.OfferSpareParts) {
            return 'Spare Parts can only be used when it is being offered'
        }
        const corporationId = state.pendingSparePartsCorporationId
        if (!corporationId) {
            return 'No Corporation is currently pending a Spare Parts decision'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President of the Corporation may use Spare Parts'
        }
        return undefined
    }
}
