import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isForcedShipPurchase } from '../operations/shipOrdering.js'

export type DeclineOrderShips = Type.Static<typeof DeclineOrderShips>
export const DeclineOrderShips = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineOrderShips),
            playerId: Type.String()
        })
    ])
)

export const DeclineOrderShipsValidator = Compile(DeclineOrderShips)

export function isDeclineOrderShips(action?: GameAction): action is DeclineOrderShips {
    return action?.type === ActionType.DeclineOrderShips
}

/**
 * The Corporation's President stops Ordering Ships for this turn. Only available once the
 * Forced Purchase minimum (at least 1 Ship, if the Corporation started this step with none) has
 * been satisfied - see operations/shipOrdering.ts's isForcedShipPurchase, which is re-evaluated
 * live against the Corporation's current Ship count rather than a snapshot from step-entry, so
 * this naturally becomes available the moment a Forced Purchase's 1 required Ship is Ordered.
 */
export class HydratedDeclineOrderShips
    extends HydratableAction<typeof DeclineOrderShips>
    implements DeclineOrderShips
{
    declare type: ActionType.DeclineOrderShips
    declare playerId: string

    constructor(data: DeclineOrderShips) {
        super(data, DeclineOrderShipsValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeclineOrderShipsInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        // No state to mutate here - declining just moves this Corporation's turn on.
    }

    isValidDeclineOrderShips(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeclineOrderShips.canDeclineOrderShips(state, this.playerId)
    }

    reasonDeclineOrderShipsInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDeclineOrderShips.reasonDeclineOrderShipsInvalid(state, this.playerId)
    }

    static canDeclineOrderShips(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedDeclineOrderShips.reasonDeclineOrderShipsInvalid(state, playerId) === undefined
    }

    static reasonDeclineOrderShipsInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return 'No Corporation is currently active'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President may decline to Order Ships'
        }
        if (isForcedShipPurchase(corporation)) {
            return 'At least one Ship must be Ordered first'
        }
        return undefined
    }
}
