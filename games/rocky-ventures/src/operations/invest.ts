import { Prng } from '@tabletop/common'
import { CardActionKind, CardBonusKind, CardKind, StartingPlayerCardId, getCard } from '../data/cards.js'
import { TaxSlotIndex, taxIncomeFor } from '../data/setup.js'
import type { CompanyId } from '../data/companies.js'
import type { DeliveryCityId } from '../data/board.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { marketCardCost, removeFromMarket } from './market.js'
import { startPointBuy } from './turn.js'
import { scoreFeastBuyerBonus } from './feastBonus.js'
import { recordActionStat, recordCash, recordGems, recordStat } from './stats.js'
import { StatKind } from '../model/stats.js'
import { type AgreementLetter, isTwoSidedAgreement } from '../data/agreements.js'

// Spend this many gems to take any agreement from the city's pile instead of the top one.
export const ChooseAgreementGemCost = 1
export const StackCardGemCost = 3

export function investCost(
    state: HydratedRockyVenturesGameState,
    slotIndex: number
): number | undefined {
    const card = state.marketCard(slotIndex)
    return card ? marketCardCost(card, slotIndex) : undefined
}

// Why picking `letter` from the city's agreement pile isn't allowed, if it isn't. Picking the top
// one is free; any other costs a gem (2026-11-02).
export function reasonChooseAgreementInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    cityId: DeliveryCityId,
    letter: AgreementLetter
): string | undefined {
    const stack = state.agreementStacks[cityId] ?? []
    if (!stack.includes(letter)) {
        return 'That agreement is not in the pile'
    }
    if (isTwoSidedAgreement(letter) && stack[0] !== letter) {
        return 'Two-sided agreements are taken in order from the top of the pile'
    }
    if (stack[0] !== letter && state.getPlayerState(playerId).gems < ChooseAgreementGemCost) {
        return 'Choosing an agreement other than the top one costs a gem'
    }
    return undefined
}

export function awardAgreement(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    cityId: DeliveryCityId,
    chosenLetter?: AgreementLetter
) {
    const stack = state.agreementStacks[cityId]
    if (!stack || stack.length === 0) {
        return
    }
    const player = state.getPlayerState(playerId)
    let letter = stack[0]!
    if (
        chosenLetter !== undefined &&
        chosenLetter !== stack[0] &&
        stack.includes(chosenLetter) &&
        !isTwoSidedAgreement(chosenLetter)
    ) {
        player.spendGems(ChooseAgreementGemCost)
        state.gemsSpent += ChooseAgreementGemCost
        recordGems(state, playerId, ChooseAgreementGemCost, 'chooseAgreement', true)
        letter = chosenLetter
    }
    stack.splice(stack.indexOf(letter), 1)
    if (isTwoSidedAgreement(letter)) {
        for (const held of player.agreements) {
            if (held.cityId === cityId && isTwoSidedAgreement(held.letter)) {
                held.flipped = true
            }
        }
    }
    player.agreements.push({ cityId, letter })
}

// Tableau cards a bought card may be stacked on: not the mat, not an existing stack (two cards at
// most), and not the card the pawn is working from right now.
export function stackableCardIds(state: HydratedRockyVenturesGameState, playerId: string): string[] {
    if (!state.cardStacking) {
        return []
    }
    const player = state.getPlayerState(playerId)
    return player.tableau.filter(
        (cardId) =>
            cardId !== StartingPlayerCardId &&
            player.stackedCards?.[cardId] === undefined &&
            cardId !== player.pawnCardId
    )
}

export function reasonStackInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    slotIndex: number,
    stackOnCardId: string
): string | undefined {
    const cardId = state.market.slots[slotIndex]
    if (cardId === undefined || getCard(cardId).kind !== CardKind.Development) {
        return 'Only development cards can be stacked'
    }
    if (!stackableCardIds(state, playerId).includes(stackOnCardId)) {
        return 'That card cannot be stacked on'
    }
    if (state.getPlayerState(playerId).gems < StackCardGemCost) {
        return `Stacking a card costs ${StackCardGemCost} gems`
    }
    return undefined
}

export function investInMarketCard(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    slotIndex: number,
    agreementLetter?: AgreementLetter,
    stackOnCardId?: string
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
        scoreFeastBuyerBonus(state, playerId, cardId)
        startPointBuy(state, cardId)
        return
    }
    if (card.kind !== CardKind.Development) {
        return
    }
    if (stackOnCardId === undefined) {
        player.tableau.push(cardId)
    } else {
        player.tableau[player.tableau.indexOf(stackOnCardId)] = cardId
        player.stackedCards = { ...player.stackedCards, [cardId]: stackOnCardId }
        player.spendGems(StackCardGemCost)
        state.gemsSpent += StackCardGemCost
        recordGems(state, playerId, StackCardGemCost, 'stackCard', true)
    }
    switch (card.bonus.kind) {
        case CardBonusKind.Agreement:
            awardAgreement(state, playerId, card.bonus.cityId, agreementLetter)
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
