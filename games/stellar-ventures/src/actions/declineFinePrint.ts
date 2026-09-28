import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { finePrintCorporation } from './finePrint.js'

export type DeclineFinePrint = Type.Static<typeof DeclineFinePrint>
export const DeclineFinePrint = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineFinePrint),
            playerId: Type.String()
        })
    ])
)

export const DeclineFinePrintValidator = Compile(DeclineFinePrint)

export function isDeclineFinePrint(action?: GameAction): action is DeclineFinePrint {
    return action?.type === ActionType.DeclineFinePrint
}

/**
 * Declines the one-time Fine Print offer at the start of a Boardroom Battle (see
 * actions/finePrint.ts). Doesn't discard the Power from the Corporation's Charter - only "used"
 * (Fine Print itself) does that - so a later Boardroom Battle can offer it again. Only closes
 * THIS Battle's window (state.finePrintOfferResolved), reset alongside
 * finePrintExemptCorporationId once this Battle fully resolves.
 */
export class HydratedDeclineFinePrint
    extends HydratableAction<typeof DeclineFinePrint>
    implements DeclineFinePrint
{
    declare type: ActionType.DeclineFinePrint
    declare playerId: string

    constructor(data: DeclineFinePrint) {
        super(data, DeclineFinePrintValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDeclineFinePrintInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        state.finePrintOfferResolved = true
    }

    isValidDeclineFinePrint(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDeclineFinePrint.canDeclineFinePrint(state, this.playerId)
    }

    reasonDeclineFinePrintInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDeclineFinePrint.reasonDeclineFinePrintInvalid(state, this.playerId)
    }

    static canDeclineFinePrint(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedDeclineFinePrint.reasonDeclineFinePrintInvalid(state, playerId) === undefined
    }

    static reasonDeclineFinePrintInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.machineState !== MachineState.BoardroomBattle) {
            return 'Fine Print can only be declined during a Boardroom Battle'
        }
        if (state.finePrintOfferResolved) {
            return 'Fine Print has already been resolved this Boardroom Battle'
        }
        const corporation = finePrintCorporation(state)
        if (corporation?.getPresidentPlayerId() !== playerId) {
            return 'Only the President of the Corporation holding Fine Print may decline it'
        }
        return undefined
    }
}
