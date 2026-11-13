import { describe, expect, it } from 'vitest'
import type { LocustGameState } from '../model/gameState.js'
import { ScoringCount } from '../data/rules.js'
import { LocustProgression } from './progression.js'

const progress = (scoringsDone: number) =>
    new LocustProgression().progress({ scoringsDone } as LocustGameState)

describe('LocustProgression', () => {
    it('counts the scorings done', () => {
        expect(progress(0)).toEqual({ fraction: 0, label: `Scoring 1 of ${ScoringCount} next` })
    })

    it('is final once the last scoring is next', () => {
        expect(progress(ScoringCount - 1)).toMatchObject({ label: 'Final scoring next', final: true })
        expect(progress(ScoringCount)).toEqual({ fraction: 1, label: 'Final scoring', final: true })
    })
})
