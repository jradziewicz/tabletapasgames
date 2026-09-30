import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CardActionKind } from '../data/cards.js'
import { TaxSlotIndex } from '../data/setup.js'
import { remainingActionKinds } from '../operations/turn.js'
import { takeTaxCard } from '../operations/invest.js'

export type Tax = Type.Static<typeof Tax>
export const Tax = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Tax),
            playerId: Type.String()
        })
    ])
)

export const TaxValidator = Compile(Tax)

export function isTax(action?: GameAction): action is Tax {
    return action?.type === ActionType.Tax
}

export class HydratedTax extends HydratableAction<typeof Tax> implements Tax {
    declare type: ActionType.Tax
    declare playerId: string

    constructor(data: Tax) {
        super(data, TaxValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = HydratedTax.reasonTaxInvalid(state, this.playerId)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        takeTaxCard(state, this.playerId)
    }

    static canTax(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        return HydratedTax.reasonTaxInvalid(state, playerId) === undefined
    }

    static reasonTaxInvalid(
        state: HydratedRockyVenturesGameState,
        playerId: string
    ): string | undefined {
        if (!state.activePlayerIds.includes(playerId)) {
            return 'It is not your turn'
        }
        if (!remainingActionKinds(state).includes(CardActionKind.Tax)) {
            return 'Tax is not available on this card'
        }
        if (state.market.slots[TaxSlotIndex] === undefined) {
            return 'There is no card in the $1 market slot'
        }
        return undefined
    }
}
