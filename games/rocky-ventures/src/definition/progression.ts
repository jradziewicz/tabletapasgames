import type { GameProgress, GameProgression } from '@tabletop/common'
import type { RockyVenturesGameState } from '../model/gameState.js'
import { developmentCardIdsForDecade, EndOfEraCards } from '../data/cards.js'

const ERA_COUNT = 3
// The draw pile is every Development card of the four decades plus the three End of Era cards
// (initializer.ts buildDrawPile), so cards still in it measure how far the game has come.
const DECK_SIZE =
    [1, 2, 3, 4].reduce((total, decade) => total + developmentCardIdsForDecade(decade).length, 0) +
    EndOfEraCards.length

export class RockyVenturesProgression implements GameProgression<RockyVenturesGameState> {
    progress(state: RockyVenturesGameState): GameProgress {
        const cardsLeft = state.market.drawPile.length
        const fraction = 1 - cardsLeft / DECK_SIZE
        if (state.eraThreeTriggered) return { fraction, label: 'Last turns', final: true }
        const era = Math.min(Math.max(state.era, 1), ERA_COUNT)
        const cards = cardsLeft === 1 ? '1 card left' : `${cardsLeft} cards left`
        return { fraction, label: `Era ${era} of ${ERA_COUNT} · ${cards}` }
    }
}
