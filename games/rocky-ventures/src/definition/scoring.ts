import type { GameScoring } from '@tabletop/common'
import type { RockyVenturesGameState } from '../model/gameState.js'
import { RockyVenturesHydrator } from './hydrator.js'
import { finalScores } from '../operations/endGame.js'
import { DummyPlayerId } from '../model/dummy.js'

// A player's final score is their total Victory Points, including those converted from cash and
// shares at game end. The dummy is not a seat, so it has no score here.
export class RockyVenturesScoring implements GameScoring<RockyVenturesGameState> {
    finalScores(state: RockyVenturesGameState): Record<string, number> {
        const hydrated = new RockyVenturesHydrator().hydrateState(state)
        return Object.fromEntries(
            finalScores(hydrated)
                .filter((score) => score.playerId !== DummyPlayerId)
                .map((score) => [score.playerId, score.total])
        )
    }
}
