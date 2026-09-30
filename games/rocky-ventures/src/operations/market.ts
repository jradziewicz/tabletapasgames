import type { RandomFunction } from '@tabletop/common'
import { type Card, CardKind, getCard } from '../data/cards.js'
import { MarketSize, MarketSlotPrices } from '../data/setup.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { revealMine } from './mines.js'

// Draws the top card of the draw pile into the newest market slot. The Game Over card is never
// drawn: it stays face up at the bottom of the pile as the deck-exhausted end trigger. Drawing a
// development card flips the gold mine in that card's city.
export function drawIntoMarket(
    state: HydratedRockyVenturesGameState,
    random: RandomFunction
): string | undefined {
    if (state.market.slots.length >= MarketSize) {
        throw Error('The market is already full')
    }
    const nextId = state.market.drawPile[0]
    if (nextId === undefined) {
        return undefined
    }
    const card = getCard(nextId)
    if (card.kind === CardKind.GameOver) {
        return undefined
    }
    state.market.drawPile.shift()
    state.market.slots.push(nextId)
    if (card.kind === CardKind.Development && card.cityNodeId) {
        revealMine(state, card.cityNodeId, random)
    }
    return nextId
}

export function isDrawPileAtGameOver(state: HydratedRockyVenturesGameState): boolean {
    const nextId = state.market.drawPile[0]
    return nextId !== undefined && getCard(nextId).kind === CardKind.GameOver
}

export function removeFromMarket(
    state: HydratedRockyVenturesGameState,
    slotIndex: number,
    random: RandomFunction
): string {
    const cardId = state.market.slots[slotIndex]
    if (cardId === undefined) {
        throw Error(`No market card in slot ${slotIndex}`)
    }
    state.market.slots.splice(slotIndex, 1)
    drawIntoMarket(state, random)
    return cardId
}

export function marketCardCost(card: Card, slotIndex: number): number | undefined {
    if (card.kind === CardKind.Development || card.kind === CardKind.EndOfEra) {
        return card.baseCost + (MarketSlotPrices[slotIndex] ?? 0)
    }
    return undefined
}
