import * as Type from 'typebox'
import { recordCash, recordVictoryPoints } from '../operations/stats.js'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CardKind, getCard } from '../data/cards.js'
import { CompanyId } from '../data/companies.js'

export type PointBuy = Type.Static<typeof PointBuy>
export const PointBuy = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PointBuy),
            playerId: Type.String(),
            bundles: Type.Number(),
            convertShare: Type.Optional(
                Type.Object({ companyId: Type.Enum(CompanyId), shareIndex: Type.Number() })
            )
        })
    ])
)

export const PointBuyValidator = Compile(PointBuy)

export function isPointBuy(action?: GameAction): action is PointBuy {
    return action?.type === ActionType.PointBuy
}

export class HydratedPointBuy extends HydratableAction<typeof PointBuy> implements PointBuy {
    declare type: ActionType.PointBuy
    declare playerId: string
    declare bundles: number
    declare convertShare?: { companyId: CompanyId; shareIndex: number }

    constructor(data: PointBuy) {
        super(data, PointBuyValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = HydratedPointBuy.reasonPointBuyInvalid(
            state,
            this.playerId,
            this.bundles,
            this.convertShare
        )
        if (invalidReason) {
            throw Error(invalidReason)
        }
        const pointBuy = state.pointBuy
        if (!pointBuy) {
            throw Error('There is no point buy in progress')
        }
        const card = getCard(pointBuy.cardId)
        if (card.kind !== CardKind.EndOfEra) {
            throw Error('The point buy card is not an End of Era card')
        }
        const player = state.getPlayerState(this.playerId)
        if (this.convertShare) {
            const { companyId, shareIndex } = this.convertShare
            const company = state.getCompany(companyId)
            const value = company.multiplierForShare(shareIndex) * company.value
            player.addMoney(value)
            const index = player.shares.findIndex(
                (share) => share.companyId === companyId && share.shareIndex === shareIndex
            )
            recordCash(state, this.playerId, value, 'shareSale', {
                cardId: player.shares[index]?.cardId
            })
            player.shares.splice(index, 1)
        }
        player.spendMoney(card.pointBuyCost * this.bundles)
        player.addVictoryPoints(card.pointBuyVictoryPoints * this.bundles)
        recordCash(state, this.playerId, -card.pointBuyCost * this.bundles, 'pointBuy', {
            cardId: pointBuy.cardId
        })
        recordVictoryPoints(state, this.playerId, card.pointBuyVictoryPoints * this.bundles, 'pointBuy', {
            cardId: pointBuy.cardId
        })
        pointBuy.queue.shift()
        if (pointBuy.queue.length === 0) {
            delete state.pointBuy
            state.era += 1
        }
    }

    static reasonPointBuyInvalid(
        state: HydratedRockyVenturesGameState,
        playerId: string,
        bundles: number,
        convertShare?: { companyId: CompanyId; shareIndex: number }
    ): string | undefined {
        const pointBuy = state.pointBuy
        if (!pointBuy || pointBuy.queue[0] !== playerId) {
            return 'It is not your turn to buy points'
        }
        const card = getCard(pointBuy.cardId)
        if (card.kind !== CardKind.EndOfEra) {
            return 'The point buy card is not an End of Era card'
        }
        if (!Number.isInteger(bundles) || bundles < 0) {
            return 'Invalid number of point bundles'
        }
        const player = state.getPlayerState(playerId)
        let money = player.money
        if (convertShare) {
            const owns = player.shares.some(
                (share) =>
                    share.companyId === convertShare.companyId &&
                    share.shareIndex === convertShare.shareIndex
            )
            if (!owns) {
                return 'You do not own that share'
            }
            const company = state.getCompany(convertShare.companyId)
            money += company.multiplierForShare(convertShare.shareIndex) * company.value
        }
        if (card.pointBuyCost * bundles > money) {
            return 'Not enough money to buy that many points'
        }
        return undefined
    }
}
