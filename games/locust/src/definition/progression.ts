import type { GameProgress, GameProgression } from '@tabletop/common'
import type { LocustGameState } from '../model/gameState.js'
import { ScoringCount } from '../data/rules.js'

// Locust is played out between a fixed number of scorings, so scorings done is its clock.
export class LocustProgression implements GameProgression<LocustGameState> {
    progress(state: LocustGameState): GameProgress {
        const done = Math.min(state.scoringsDone, ScoringCount)
        const fraction = done / ScoringCount
        if (done >= ScoringCount) return { fraction, label: 'Final scoring', final: true }
        if (done === ScoringCount - 1) return { fraction, label: 'Final scoring next', final: true }
        return { fraction, label: `Scoring ${done + 1} of ${ScoringCount} next` }
    }
}
