import { describe, expect, it } from 'vitest'
import { validateGameResult } from '@tabletop/common'
import { DiscsPerColony, ScoringCount } from '../data/rules.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { LocustTable } from '../testing/table.js'
import { playRandomGame } from '../testing/scenario.js'

describe.each([2, 3, 4])('random full games with %i players', (playerCount) => {
    it.each([1, 2, 3, 4, 5, 6])('seed %i finishes with a valid result', (seed) => {
        const table = new LocustTable(playerCount, seed)
        const processed = playRandomGame(table, seed * 31)
        const state = table.view
        validateGameResult(state)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.scoringsDone).toBe(ScoringCount)
        expect(processed.filter((action) => action.type === ActionType.ScoreRegion)).toHaveLength(
            ScoringCount
        )
        for (const colony of state.colonies) {
            expect(colony.supply + colony.dead + state.board.discsOfColor(colony.color)).toBe(
                DiscsPerColony
            )
            expect(colony.finalScore).toBeDefined()
        }
        for (const player of state.players) {
            expect(player.score).toBeTypeOf('number')
            if (playerCount === 2) {
                expect(player.vigorColor).toBeDefined()
            }
        }
        expect(Object.keys(state.board.cubes).every((spaceId) => spaceId.startsWith('F-'))).toBe(
            true
        )
    })
})
