import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { BonusToken } from '../data/board.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { InsectKind } from '../model/board.js'
import {
    bonusSetPoints,
    determineWinners,
    finalTiebreakOrder,
    majorityRanking,
    supplyBonuses,
    vigorInZone
} from '../operations/scoring.js'
import {
    killingZone,
    scoringZone,
    swarmingZone,
    breedingZone,
    majorityRegion,
    levelBoostRegion
} from '../operations/zones.js'
import { LocustTable } from '../testing/table.js'
import { clearHabitats, makeActiveRegion, passTurn, put } from '../testing/scenario.js'

const { Grasshopper, Locust, Nymph } = InsectKind

function threePlayerTable() {
    const table = new LocustTable(3, 7)
    const [a, b, c] = table.view.colonies.map((colony) => colony.color) as [Color, Color, Color]
    table.edit((state) => clearHabitats(state))
    return { table, a, b, c }
}

function playUntilScoring(table: LocustTable) {
    const scoringsBefore = table.view.scoringsDone
    let guard = 0
    while (table.view.scoringsDone === scoringsBefore && guard++ < 20) {
        passTurn(table)
    }
}

describe('zone ruler', () => {
    it('places every zone relative to the Active Region', () => {
        expect(killingZone(0)).toEqual([])
        expect(killingZone(3)).toEqual([1])
        expect(swarmingZone(0)).toEqual([0])
        expect(swarmingZone(2)).toEqual([1, 2])
        expect(scoringZone(0)).toEqual([0, 1, 2])
        expect(scoringZone(4)).toEqual([3, 4, 5])
        expect(breedingZone(3)).toEqual([3, 4, 5])
        expect(majorityRegion(2)).toBe(3)
        expect(levelBoostRegion(0)).toBe(2)
    })
})

describe('crowding', () => {
    it('lets a habitat hold as many discs as its region has cubes, counting nymphs', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => {
            state.board.cubes['II-L1'] = a
            state.board.cubes['II-L2'] = a
            put(state, 'II-1', a, Grasshopper)
            put(state, 'II-1', a, Nymph)
        })
        expect(table.view.isCrowded('II-1')).toBe(false)
        table.edit((state) => put(state, 'II-1', a, Nymph))
        expect(table.view.isCrowded('II-1')).toBe(true)
        expect(table.view.isCrowded('III-1')).toBe(false)
    })
})

describe('regional scoring', () => {
    it('scores insects in the Scoring Zone: grasshopper 2, locust 1, nymph 0, Island locust +1', () => {
        const { table, a, b } = threePlayerTable()
        table.edit((state) => {
            put(state, 'I-1', a, Grasshopper, 2)
            put(state, 'II-2', a, Locust, 1)
            put(state, 'III-1', a, Nymph, 3)
            put(state, 'IV-1', a, Grasshopper, 5)
            put(state, 'IV-4', b, Locust, 2)
        })
        const atStart = vigorInZone(table.view, 0)
        expect(atStart.get(a)).toBe(5)
        const later = vigorInZone(table.view, 2)
        expect(later.get(a)).toBe(1 + 10)
        expect(later.get(b)).toBe(4)
    })

    it('ranks majorities by insect count, then quadrant priority', () => {
        const { table, a, b, c } = threePlayerTable()
        table.edit((state) => {
            put(state, 'II-1', b, Grasshopper, 2)
            put(state, 'II-1', a, Locust, 1)
            put(state, 'II-1', a, Nymph, 1)
            put(state, 'II-1', c, Grasshopper, 3)
        })
        expect(majorityRanking(table.view, 'II-1')).toEqual([c, b, a])
    })

    it('scores, awards majorities and shifts the ruler when the Active Region empties', () => {
        const { table, a, b, c } = threePlayerTable()
        table.edit((state) => {
            put(state, 'I-1', a, Grasshopper, 2)
            put(state, 'II-1', b, Grasshopper, 2)
            put(state, 'II-1', c, Grasshopper, 1)
            put(state, 'II-4', c, Locust, 1)
            put(state, 'IV-1', a, Grasshopper, 3)
            state.colony(c).dead = 6
        })
        playUntilScoring(table)
        const scoring = table.processed.find((action) => action.type === ActionType.ScoreRegion)
        expect(scoring).toBeDefined()
        const state = table.view
        expect(state.scoringsDone).toBe(1)
        expect(state.activeRegion).toBe(1)
        expect(state.colony(a).vigor).toBe(4)
        expect(state.colony(b).vigor).toBe(4)
        expect(state.colony(c).vigor).toBe(3)
        expect(state.colony(b).tokens).toContain(BonusToken.Yellow)
        expect(state.colony(c).tokens).toContain(BonusToken.Yellow)
        expect(state.colony(c).dead).toBe(5)
        expect(state.machineState).toBe(MachineState.ChooseSpace)
    })

    it('kills everything in the Killing Zone after the ruler moves', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => {
            makeActiveRegion(state, 1)
            state.scoringsDone = 1
            put(state, 'I-1', a, Grasshopper, 2)
            put(state, 'I-2', a, Nymph, 1)
            put(state, 'II-1', a, Grasshopper, 1)
        })
        playUntilScoring(table)
        const state = table.view
        expect(state.activeRegion).toBe(2)
        expect(state.board.discsIn('I-1')).toBe(0)
        expect(state.board.discsIn('I-2')).toBe(0)
        expect(state.board.count('II-1', a, Grasshopper)).toBe(1)
        expect(state.colony(a).dead).toBe(6 + 3)
    })

    it('scores again straight away when the next region has no cubes', () => {
        const { table } = threePlayerTable()
        let guard = 0
        while (table.view.scoringsDone === 0 && guard++ < 20) {
            passTurn(table, 'F-L1')
        }
        const state = table.view
        expect(state.scoringsDone).toBe(5)
        expect(state.activeRegion).toBe(4)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(
            table.processed.filter((action) => action.type === ActionType.ScoreRegion)
        ).toHaveLength(5)
    })

    it('gives the green token for the Island majority at the third scoring', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => {
            makeActiveRegion(state, 2)
            state.scoringsDone = 2
            put(state, 'IV-4', a, Locust, 1)
        })
        playUntilScoring(table)
        expect(table.view.colony(a).tokens).toContain(BonusToken.Green)
    })

    it('adds 3 VP for Region F majorities at the fifth scoring and ends the game', () => {
        const { table, a, b } = threePlayerTable()
        table.edit((state) => {
            makeActiveRegion(state, 4)
            state.scoringsDone = 4
            put(state, 'F-2', a, Grasshopper, 2)
            put(state, 'F-2', b, Grasshopper, 1)
        })
        playUntilScoring(table)
        const state = table.view
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.colony(a).vigor).toBe(4 + 3)
        expect(state.colony(a).tokens).toContain(BonusToken.Red)
        expect(state.colony(a).finalScore).toBeDefined()
        expect(state.result).toBeDefined()
    })
})

describe('final scoring', () => {
    it('scores sets of distinct bonus tokens', () => {
        const { Grey, Orange, Cream, Blue, Red, Yellow, Green } = BonusToken
        expect(bonusSetPoints([])).toBe(0)
        expect(bonusSetPoints([Grey, Orange, Cream])).toBe(6)
        expect(bonusSetPoints([Grey, Grey, Blue])).toBe(3 + 1)
        expect(bonusSetPoints([Grey, Orange, Cream, Blue, Red, Yellow, Green])).toBe(28)
        expect(bonusSetPoints([Grey, Orange, Cream, Blue, Red, Yellow, Green, Grey, Blue])).toBe(
            28 + 3
        )
    })

    it('gives the supply bonus to the most and runner-up, or 3 each when tied for most', () => {
        const { Red, Blue, Green } = Color
        expect(
            Object.fromEntries(
                supplyBonuses(
                    new Map([
                        [Red, 5],
                        [Blue, 3],
                        [Green, 3]
                    ])
                )
            )
        ).toEqual({
            red: 4,
            blue: 2,
            green: 2
        })
        expect(
            Object.fromEntries(
                supplyBonuses(
                    new Map([
                        [Red, 5],
                        [Blue, 5],
                        [Green, 1]
                    ])
                )
            )
        ).toEqual({
            red: 3,
            blue: 3,
            green: 0
        })
    })

    it('breaks ties by cube position in Region F, left column first', () => {
        const { table, a, b, c } = threePlayerTable()
        table.edit((state) => {
            state.board.cubes['F-L2'] = b
            state.board.cubes['F-L5'] = c
            state.board.cubes['F-R6'] = a
            state.board.unlimitedCubes['F-L1'] = [a]
        })
        expect(finalTiebreakOrder(table.view)).toEqual([c, b, a, a])
        table.edit((state) => {
            for (const colony of state.colonies) {
                colony.vigor = 10
                colony.finalScore = { setPoints: 0, supplyPoints: 0 }
            }
        })
        const state = table.view
        expect(determineWinners(state).winningPlayerIds).toEqual([state.colony(c).playerId])
    })
})

describe('duel', () => {
    it('lets each player pick which colour scores Vigor and which scores Bonus Points', () => {
        const table = new LocustTable(2, 5)
        table.edit((state) => {
            clearHabitats(state)
            makeActiveRegion(state, 4)
            state.scoringsDone = 4
            const [c1, c2, c3, c4] = state.colonies
            c1!.vigor = 30
            c3!.vigor = 5
            c3!.tokens = [BonusToken.Grey, BonusToken.Orange, BonusToken.Cream]
            c2!.vigor = 20
            c4!.vigor = 20
        })
        playUntilScoring(table)
        expect(table.view.machineState).toBe(MachineState.AssignDuelScoring)
        const [c1, c2] = table.view.colonies
        table.act(ActionType.AssignDuelScoring, { vigorColor: c1!.color })
        expect(() => table.act(ActionType.AssignDuelScoring, { vigorColor: c1!.color })).toThrow(
            'not one of your colours'
        )
        table.act(ActionType.AssignDuelScoring, { vigorColor: c2!.color })
        const state = table.view
        expect(state.machineState).toBe(MachineState.EndOfGame)
        const first = state.getPlayerState(c1!.playerId)
        expect(first.vigorColor).toBe(c1!.color)
        expect(first.score).toBe(
            30 + 6 + (state.colony(state.colonies[2]!.color).finalScore?.supplyPoints ?? 0)
        )
        expect(state.winningPlayerIds).toEqual([c1!.playerId])
    })
})
