import { describe, expect, it } from 'vitest'
import type { RockyVenturesGameState } from '../model/gameState.js'
import { developmentCardIdsForDecade, EndOfEraCards } from '../data/cards.js'
import { RockyVenturesProgression } from './progression.js'

const deckSize =
    [1, 2, 3, 4].reduce((total, decade) => total + developmentCardIdsForDecade(decade).length, 0) +
    EndOfEraCards.length

const progress = (cardsLeft: number, era: number, eraThreeTriggered?: boolean) =>
    new RockyVenturesProgression().progress({
        market: { drawPile: Array.from({ length: cardsLeft }, (_, index) => `card-${index}`), slots: [] },
        era,
        eraThreeTriggered
    } as unknown as RockyVenturesGameState)

describe('RockyVenturesProgression', () => {
    it('measures the cards drawn from the deck', () => {
        expect(progress(deckSize, 1)).toEqual({ fraction: 0, label: `Era 1 of 3 · ${deckSize} cards left` })
        expect(progress(1, 3).label).toBe('Era 3 of 3 · 1 card left')
    })

    it('is final once End of Era III has been taken', () => {
        expect(progress(4, 3, true)).toMatchObject({ label: 'Last turns', final: true })
    })
})
