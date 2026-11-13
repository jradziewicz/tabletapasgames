import { DeliveryCityId } from '../data/board.js'
import { isTwoSidedAgreement, TwoSidedAgreementLetters } from '../data/agreements.js'
import { MaxGems } from '../model/playerState.js'
import { getCard, CardKind } from '../data/cards.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ThirdEraCardId } from './market.js'

// Running games Justin asked to move onto the two-sided agreements and the 2-gem start
// (2026-11-03). Each switches the first time it loads after the change, as long as nobody holds
// an agreement yet; the switched state is saved with the next action.
export const TwoSidedAgreementGameIds: string[] = [
    'Vfz4QAGhl4cfVpTXYAxw8' // Eye of the Tiger
]

// Running games Justin asked to move onto top-to-bottom actions and agreements that score on
// delivery (2026-11-09).
export const InOrderAndDeliveryScoringGameIds: string[] = [
    'oQaV2siAfrrbFOfbLkgvv' // Paulies Robot
]

// Same on every load until it's saved, so the spot comes from the pile itself, not the game's
// random numbers.
function stablePick(text: string, choices: number): number {
    let hash = 0
    for (const character of text) {
        hash = (hash * 31 + character.charCodeAt(0)) >>> 0
    }
    return hash % choices
}

// Hydrating shares nested objects with the stored state, and the same stored state is hydrated
// over and over, so these switches build new objects and never change the shared ones.
function migrateToEraThreeEnding(state: HydratedRockyVenturesGameState) {
    const inMarket = state.market.slots.includes(ThirdEraCardId)
    const pile = state.market.drawPile
    const copies = pile.filter((cardId) => cardId === ThirdEraCardId).length
    if (state.eraThreeEndsGame) {
        // Repairs a pile that picked up extra copies before this was fixed.
        if (copies > (inMarket ? 0 : 1)) {
            const first = pile.indexOf(ThirdEraCardId)
            const drawPile = pile.filter(
                (cardId, index) => cardId !== ThirdEraCardId || (!inMarket && index === first)
            )
            state.market = { ...state.market, drawPile }
        }
        return
    }
    state.eraThreeEndsGame = true
    const drawPile = pile.filter((cardId) => cardId !== ThirdEraCardId)
    if (!inMarket) {
        const isDecadeFour = (cardId: string) => {
            const card = getCard(cardId)
            return card.kind === CardKind.Development && card.decade === 4
        }
        const firstDecadeFour = drawPile.findIndex(isDecadeFour)
        const bottom = drawPile.findIndex((cardId) => getCard(cardId).kind === CardKind.GameOver)
        const end = bottom < 0 ? drawPile.length : bottom
        const start = firstDecadeFour < 0 ? end : firstDecadeFour
        drawPile.splice(start + stablePick(drawPile.join(), end - start + 1), 0, ThirdEraCardId)
    }
    state.market = { ...state.market, drawPile }
}

function migrateToNoGameOverCard(state: HydratedRockyVenturesGameState) {
    const drawPile = state.market.drawPile.filter((cardId) => getCard(cardId).kind !== CardKind.GameOver)
    if (drawPile.length !== state.market.drawPile.length) {
        state.market = { ...state.market, drawPile }
    }
}

// Every open game moves onto the End of Era III ending with no Game Over card (Justin, 2026-11-06).
// Finished games are left as they ended.
export function migrateRunningGame(state: HydratedRockyVenturesGameState) {
    if (!state.result) {
        migrateToEraThreeEnding(state)
        migrateToNoGameOverCard(state)
        // Every open game moves onto refilling the market only after the turn (Justin, 2026-11-13).
        state.delayedMarketRefill = true
        if (InOrderAndDeliveryScoringGameIds.includes(state.gameId)) {
            state.actionsInOrder = true
            state.agreementsScoreOnDelivery = true
            state.noAgreementDiscard = true
            state.gemOnlyOnCircle = true
        }
    }
    if (!TwoSidedAgreementGameIds.includes(state.gameId)) {
        return
    }
    const cities = [DeliveryCityId.Dornoch, DeliveryCityId.Manor]
    const stillOriginal = cities.every((cityId) =>
        (state.agreementStacks[cityId] ?? []).every((letter) => !isTwoSidedAgreement(letter))
    )
    if (!stillOriginal || state.players.some((player) => player.agreements.length > 0)) {
        return
    }
    state.agreementStacks = Object.fromEntries(
        cities.map((cityId) => [cityId, [...TwoSidedAgreementLetters]])
    )
    for (const player of state.players) {
        player.gems = Math.min(MaxGems, player.gems + 1)
    }
}
