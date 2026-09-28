import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

export type DeclineSpareParts = Type.Static<typeof DeclineSpareParts>
export const DeclineSpareParts = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineSpareParts),
            playerId: Type.String()
        })
    ])
)

export const DeclineSparePartsValidator = Compile(DeclineSpareParts)

export function isDeclineSpareParts(action?: GameAction): action is DeclineSpareParts {
    return action?.type === ActionType.DeclineSpareParts
}

/**
 * Declines the Spare Parts offer (see actions/spareParts.ts): the at-risk Ship is simply Scrapped
 * for real right now instead of being moved onto the tile - reducing CARGO immediately, exactly as
 * if this Corporation hadn't held the Power at all. The Power itself is NOT discarded (nothing was
 * used), so it remains on the Charter, available the next time one of this Corporation's Delivered
 * Ships would be Scrapped.
 */
export class HydratedDeclineSpareParts
    extends HydratableAction<typeof DeclineSpareParts>
    implements DeclineSpareParts
{
    declare type: ActionType.DeclineSpareParts
    declare playerId: string

    constructor(data: DeclineSpareParts) {
        super(data, DeclineSparePartsValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeclineSparePartsInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.pendingSparePartsCorporationId
        assertExists(corporationId, 'A Corporation should be pending Spare Parts')
        const corporation = state.getCorporation(corporationId)

        corporation.cargo = Math.max(0, corporation.cargo - 1)
        state.pendingSparePartsCorporationId = undefined
        state.pendingSparePartsShipLevel = undefined
    }

    isValidDeclineSpareParts(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeclineSpareParts.canDeclineSpareParts(state, this.playerId)
    }

    reasonDeclineSparePartsInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDeclineSpareParts.reasonDeclineSparePartsInvalid(state, this.playerId)
    }

    static canDeclineSpareParts(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return (
            HydratedDeclineSpareParts.reasonDeclineSparePartsInvalid(state, playerId) === undefined
        )
    }

    static reasonDeclineSparePartsInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.machineState !== MachineState.OfferSpareParts) {
            return 'Spare Parts can only be declined when it is being offered'
        }
        const corporationId = state.pendingSparePartsCorporationId
        if (!corporationId) {
            return 'No Corporation is currently pending a Spare Parts decision'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President of the Corporation may decline Spare Parts'
        }
        return undefined
    }
}
