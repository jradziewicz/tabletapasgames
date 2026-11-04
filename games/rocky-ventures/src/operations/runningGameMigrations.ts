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

// Running games Justin asked to move onto the End of Era III ending (2026-11-04).
export const EraThreeEndingGameIds: string[] = [
    'Vfz4QAGhl4cfVpTXYAxw8' // Eye of the Tiger
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

function migrateToEraThreeEnding(state: HydratedRockyVenturesGameState) {
    if (!EraThreeEndingGameIds.includes(state.gameId) || state.eraThreeEndsGame) {
        return
    }
    state.eraThreeEndsGame = true
    const pile = state.market.drawPile
    const isDecadeFour = (cardId: string) => {
        const card = getCard(cardId)
        return card.kind === CardKind.Development && card.decade === 4
    }
    const firstDecadeFour = pile.findIndex(isDecadeFour)
    const bottom = pile.findIndex((cardId) => getCard(cardId).kind === CardKind.GameOver)
    const end = bottom < 0 ? pile.length : bottom
    const start = firstDecadeFour < 0 ? end : firstDecadeFour
    pile.splice(start + stablePick(pile.join(), end - start + 1), 0, ThirdEraCardId)
}

export function migrateRunningGame(state: HydratedRockyVenturesGameState) {
    migrateToEraThreeEnding(state)
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
    for (const cityId of cities) {
        state.agreementStacks[cityId] = [...TwoSidedAgreementLetters]
    }
    for (const player of state.players) {
        player.gems = Math.min(MaxGems, player.gems + 1)
    }
}
