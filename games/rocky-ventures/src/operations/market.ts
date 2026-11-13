import type { RandomFunction } from '@tabletop/common'
import { type Card, CardKind, getCard } from '../data/cards.js'
import { MarketSize, MarketSlotPrices } from '../data/setup.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { revealMine } from './mines.js'
import { startPointBuy } from './turn.js'
import { scoreHuntHitsAtFeast } from './hunt.js'

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
    resolveEndOfEraPair(state, random)
    if (state.eraThreeEndsGame && nextId === ThirdEraCardId && isDrawPileAtGameOver(state)) {
        state.eraThreeTriggered = true
    }
    return nextId
}

export const FirstEraCardId = 'era1'
export const SecondEraCardId = 'era2'
export const ThirdEraCardId = 'era3'

// If the first and second End of Era cards are ever in the market together, both leave it: the
// first is discarded and the second's point buy triggers at once (2026-10-26). The market refills.
function resolveEndOfEraPair(state: HydratedRockyVenturesGameState, random: RandomFunction) {
    const slots = state.market.slots
    // End of Era III with either earlier card: both leave and its worse rate applies, ending the game.
    if (
        state.eraThreeEndsGame &&
        slots.includes(ThirdEraCardId) &&
        (slots.includes(FirstEraCardId) || slots.includes(SecondEraCardId))
    ) {
        state.market.slots = slots.filter(
            (cardId) => cardId !== ThirdEraCardId && cardId !== FirstEraCardId && cardId !== SecondEraCardId
        )
        scoreHuntHitsAtFeast(state, ThirdEraCardId)
        state.eraThreeTriggered = true
        return
    }
    if (!slots.includes(FirstEraCardId) || !slots.includes(SecondEraCardId)) {
        return
    }
    state.market.slots = slots.filter((cardId) => cardId !== FirstEraCardId && cardId !== SecondEraCardId)
    startPointBuy(state, SecondEraCardId)
    while (state.market.slots.length < MarketSize && drawIntoMarket(state, random) !== undefined) {
        // keep refilling until the market is full or the pile reaches the Game Over card
    }
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
    if (state.delayedMarketRefill) {
        // The replacement comes out when the turn is over (refillMarketAfterTurn).
        state.pendingMarketDraws = (state.pendingMarketDraws ?? 0) + 1
        return cardId
    }
    drawIntoMarket(state, random)
    // End of Era III left as the very last card also ends the game.
    if (
        state.eraThreeEndsGame &&
        isDrawPileAtGameOver(state) &&
        state.market.slots.length === 1 &&
        state.market.slots[0] === ThirdEraCardId
    ) {
        state.eraThreeTriggered = true
    }
    return cardId
}

export function marketCardCost(card: Card, slotIndex: number): number | undefined {
    if (card.kind === CardKind.Development || card.kind === CardKind.EndOfEra) {
        return card.baseCost + (MarketSlotPrices[slotIndex] ?? 0)
    }
    return undefined
}

// Delayed refill: the cards taken this turn are replaced once it's over, before the next turn starts.
export function refillMarketAfterTurn(state: HydratedRockyVenturesGameState, random: RandomFunction) {
    const pending = state.pendingMarketDraws ?? 0
    if (pending <= 0) {
        return
    }
    state.pendingMarketDraws = 0
    for (let drawn = 0; drawn < pending && state.market.slots.length < MarketSize; drawn++) {
        if (drawIntoMarket(state, random) === undefined) {
            break
        }
    }
    // End of Era III left as the very last card also ends the game.
    if (
        state.eraThreeEndsGame &&
        isDrawPileAtGameOver(state) &&
        state.market.slots.length === 1 &&
        state.market.slots[0] === ThirdEraCardId
    ) {
        state.eraThreeTriggered = true
    }
}
