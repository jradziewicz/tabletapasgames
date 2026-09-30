import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { recordCash, recordVictoryPoints } from '../operations/stats.js'

export const VictoryPointSalePrice = 1

export type SellVictoryPoints = Type.Static<typeof SellVictoryPoints>
export const SellVictoryPoints = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SellVictoryPoints),
            playerId: Type.String(),
            amount: Type.Number()
        })
    ])
)

export const SellVictoryPointsValidator = Compile(SellVictoryPoints)

export function isSellVictoryPoints(action?: GameAction): action is SellVictoryPoints {
    return action?.type === ActionType.SellVictoryPoints
}

export class HydratedSellVictoryPoints
    extends HydratableAction<typeof SellVictoryPoints>
    implements SellVictoryPoints
{
    declare type: ActionType.SellVictoryPoints
    declare playerId: string
    declare amount: number

    constructor(data: SellVictoryPoints) {
        super(data, SellVictoryPointsValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        if (!state.activePlayerIds.includes(this.playerId)) {
            throw Error('It is not your turn')
        }
        const player = state.getPlayerState(this.playerId)
        if (!Number.isInteger(this.amount) || this.amount < 1 || this.amount > player.victoryPoints) {
            throw Error('Invalid number of victory points to sell')
        }
        const cash = this.amount * VictoryPointSalePrice
        player.victoryPoints -= this.amount
        player.addMoney(cash)
        recordVictoryPoints(state, this.playerId, -this.amount, 'vpSale', { cardId: undefined })
        recordCash(state, this.playerId, cash, 'vpSale', { cardId: undefined })
    }

    static canSellVictoryPoints(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        return (
            state.activePlayerIds.includes(playerId) &&
            state.getPlayerState(playerId).victoryPoints > 0
        )
    }
}
