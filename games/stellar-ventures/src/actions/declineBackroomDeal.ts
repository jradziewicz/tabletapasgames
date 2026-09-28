import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { backroomDealCorporation } from './backroomDeal.js'

export type DeclineBackroomDeal = Type.Static<typeof DeclineBackroomDeal>
export const DeclineBackroomDeal = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineBackroomDeal),
            playerId: Type.String()
        })
    ])
)

export const DeclineBackroomDealValidator = Compile(DeclineBackroomDeal)

export function isDeclineBackroomDeal(action?: GameAction): action is DeclineBackroomDeal {
    return action?.type === ActionType.DeclineBackroomDeal
}

/**
 * Declines the one-time Backroom Deal offer at the start of Liquidation (see
 * actions/backroomDeal.ts). Doesn't discard the Power from the Corporation's Charter - only
 * "used" (Backroom Deal itself) does that - but since Liquidation only ever happens once per
 * game, state.backroomDealResolved permanently closes this window either way.
 */
export class HydratedDeclineBackroomDeal
    extends HydratableAction<typeof DeclineBackroomDeal>
    implements DeclineBackroomDeal
{
    declare type: ActionType.DeclineBackroomDeal
    declare playerId: string

    constructor(data: DeclineBackroomDeal) {
        super(data, DeclineBackroomDealValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeclineBackroomDealInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        state.backroomDealResolved = true
    }

    isValidDeclineBackroomDeal(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeclineBackroomDeal.canDeclineBackroomDeal(state, this.playerId)
    }

    reasonDeclineBackroomDealInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDeclineBackroomDeal.reasonDeclineBackroomDealInvalid(state, this.playerId)
    }

    static canDeclineBackroomDeal(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return HydratedDeclineBackroomDeal.reasonDeclineBackroomDealInvalid(state, playerId) === undefined
    }

    static reasonDeclineBackroomDealInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.machineState !== MachineState.Liquidation) {
            return 'Backroom Deal can only be declined during Liquidation'
        }
        if (state.backroomDealResolved) {
            return 'Backroom Deal has already been resolved this game'
        }
        const corporation = backroomDealCorporation(state)
        if (corporation?.getPresidentPlayerId() !== playerId) {
            return 'Only the President of the Corporation holding Backroom Deal may decline it'
        }
        return undefined
    }
}
