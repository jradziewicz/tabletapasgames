import { Prng } from '@tabletop/common'
import { CardActionKind, CardBonusKind, CardKind, getCard } from '../data/cards.js'
import { TaxSlotIndex, taxIncomeFor } from '../data/setup.js'
import type { CompanyId } from '../data/companies.js'
import type { DeliveryCityId } from '../data/board.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { marketCardCost, removeFromMarket } from './market.js'
import { startPointBuy } from './turn.js'
import { recordActionStat, recordCash, recordStat } from './stats.js'
import { StatKind } from '../model/stats.js'

export function investCost(
    state: HydratedRockyVenturesGameState,
    slotIndex: number
): number | undefined {
    const card = state.marketCard(slotIndex)
    return card ? marketCardCost(card, slotIndex) : undefined
}

export function awardAgreement(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    cityId: DeliveryCityId
) {
    const letter = state.agreementStacks[cityId]?.shift()
    if (letter !== undefined) {
        state.getPlayerState(playerId).agreements.push({ cityId, letter })
    }
}

export function investInMarketCard(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    slotIndex: number
) {
    const player = state.getPlayerState(playerId)
    const cardId = state.market.slots[slotIndex]
    const cost = investCost(state, slotIndex)
    if (cardId === undefined || cost === undefined) {
        throw Error(`No card to buy in slot ${slotIndex}`)
    }
    const card = getCard(cardId)
    player.spendMoney(cost)
    recordActionStat(state, playerId, state.bonusInvest ? 'BonusInvest' : 'Invest')
    recordStat(state, {
        kind: StatKind.Purchase,
        playerId,
        amount: cost,
        cardId,
        detail: `slot${slotIndex}`
    })
    recordCash(state, playerId, -cost, 'purchase', { cardId })
    removeFromMarket(state, slotIndex, new Prng(state.prng).random)
    if (state.bonusInvest) {
        delete state.bonusInvest
    } else {
        state.turnActionsTaken.push(CardActionKind.Invest)
        state.turnOver = true
    }

    if (card.kind === CardKind.EndOfEra) {
        player.tuckedCardIds.push(cardId)
        startPointBuy(state, cardId)
        return
    }
    if (card.kind !== CardKind.Development) {
        return
    }
    player.tableau.push(cardId)
    switch (card.bonus.kind) {
        case CardBonusKind.Agreement:
            awardAgreement(state, playerId, card.bonus.cityId)
            return
        case CardBonusKind.Share: {
            const companyIds: CompanyId[] = card.bonus.companyIds.filter(
                (companyId) => state.getCompany(companyId).sharesRemaining > 0
            )
            if (companyIds.length > 0) {
                state.pendingShare = { companyIds, amount: cost, cardId }
            }
            return
        }
        case CardBonusKind.ImmediateAction:
            state.immediateCardId = cardId
            state.immediateStart = state.turnActionsTaken.length
            return
    }
}

export function takeTaxCard(state: HydratedRockyVenturesGameState, playerId: string): number {
    const player = state.getPlayerState(playerId)
    const cardId = removeFromMarket(state, TaxSlotIndex, new Prng(state.prng).random)
    player.tuckedCardIds.push(cardId)
    const income = taxIncomeFor(player.tuckedCardIds.length)
    player.addMoney(income)
    recordActionStat(state, playerId, 'Tax')
    recordCash(state, playerId, income, 'tax')
    state.turnActionsTaken.push(CardActionKind.Tax)
    if (getCard(cardId).kind === CardKind.EndOfEra) {
        startPointBuy(state, cardId)
    }
    return income
}
