import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    AgreementLetter,
    AgreementPointBuyCost,
    AgreementPointBuyVictoryPoints
} from '../data/agreements.js'
import { recordCash, recordVictoryPoints } from '../operations/stats.js'

export type AgreementPointBuy = Type.Static<typeof AgreementPointBuy>
export const AgreementPointBuy = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AgreementPointBuy),
            playerId: Type.String(),
            buy: Type.Boolean()
        })
    ])
)

export const AgreementPointBuyValidator = Compile(AgreementPointBuy)

export function isAgreementPointBuy(action?: GameAction): action is AgreementPointBuy {
    return action?.type === ActionType.AgreementPointBuy
}

export class HydratedAgreementPointBuy
    extends HydratableAction<typeof AgreementPointBuy>
    implements AgreementPointBuy
{
    declare type: ActionType.AgreementPointBuy
    declare playerId: string
    declare buy: boolean

    constructor(data: AgreementPointBuy) {
        super(data, AgreementPointBuyValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const pending = state.pendingAgreementBuy
        if (!pending) {
            throw Error('There is no agreement purchase to decide')
        }
        if (!state.activePlayerIds.includes(this.playerId)) {
            throw Error('It is not your turn')
        }
        if (this.buy) {
            const player = state.getPlayerState(this.playerId)
            if (player.money < AgreementPointBuyCost) {
                throw Error('Not enough money')
            }
            const agreement = `${pending.cityId}-${AgreementLetter.D}`
            player.spendMoney(AgreementPointBuyCost)
            player.addVictoryPoints(AgreementPointBuyVictoryPoints)
            recordCash(state, this.playerId, -AgreementPointBuyCost, 'agreement', { agreement })
            recordVictoryPoints(state, this.playerId, AgreementPointBuyVictoryPoints, 'agreement', {
                agreement
            })
        }
        delete state.pendingAgreementBuy
    }
}
