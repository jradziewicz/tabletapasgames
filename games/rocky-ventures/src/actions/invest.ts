import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CardActionKind } from '../data/cards.js'
import { MarketSize } from '../data/setup.js'
import { remainingActionKinds } from '../operations/turn.js'
import { investCost, investInMarketCard } from '../operations/invest.js'

export type Invest = Type.Static<typeof Invest>
export const Invest = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Invest),
            playerId: Type.String(),
            slotIndex: Type.Number()
        })
    ])
)

export const InvestValidator = Compile(Invest)

export function isInvest(action?: GameAction): action is Invest {
    return action?.type === ActionType.Invest
}

export class HydratedInvest extends HydratableAction<typeof Invest> implements Invest {
    declare type: ActionType.Invest
    declare playerId: string
    declare slotIndex: number

    constructor(data: Invest) {
        super(data, InvestValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = HydratedInvest.reasonInvestInvalid(state, this.playerId, this.slotIndex)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        investInMarketCard(state, this.playerId, this.slotIndex)
    }

    static canInvest(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        for (let slotIndex = 0; slotIndex < MarketSize; slotIndex += 1) {
            if (HydratedInvest.reasonInvestInvalid(state, playerId, slotIndex) === undefined) {
                return true
            }
        }
        return false
    }

    static reasonInvestInvalid(
        state: HydratedRockyVenturesGameState,
        playerId: string,
        slotIndex: number
    ): string | undefined {
        if (!state.activePlayerIds.includes(playerId)) {
            return 'It is not your turn'
        }
        if (!state.bonusInvest && !remainingActionKinds(state).includes(CardActionKind.Invest)) {
            return 'Invest is not available on this card'
        }
        const cost = investCost(state, slotIndex)
        if (cost === undefined) {
            return 'There is no card to buy in that market slot'
        }
        if (cost > state.getPlayerState(playerId).money) {
            return 'Not enough money to buy that card'
        }
        return undefined
    }
}
