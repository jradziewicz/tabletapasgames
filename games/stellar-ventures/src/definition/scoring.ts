import type { GameScoring } from '@tabletop/common'
import type { StellarVenturesGameState } from '../model/gameState.js'
import { StellarVenturesHydrator } from './hydrator.js'
import { totalCredits } from '../operations/liquidation.js'

// A player's final score is the Credit total that decides the winner (Liquid + Frozen Funds).
export class StellarVenturesScoring implements GameScoring<StellarVenturesGameState> {
    finalScores(state: StellarVenturesGameState): Record<string, number> {
        const hydrated = new StellarVenturesHydrator().hydrateState(state)
        return Object.fromEntries(
            hydrated.players.map((player) => [player.playerId, totalCredits(hydrated, player.playerId)])
        )
    }
}
