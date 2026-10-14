import { describe, expect, it } from 'vitest'
import { StartHabitatIds, spacesInTurnOrder } from '../data/board.js'
import { DiscsPerColony } from '../data/rules.js'
import { InsectKind } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { LocustTable } from '../testing/table.js'

describe.each([
    [2, 4, 3],
    [3, 3, 4],
    [4, 4, 3]
])('setup with %i players', (playerCount, colonyCount, cubesPerColony) => {
    const table = new LocustTable(playerCount, 7)
    const state = table.view

    it(`creates ${colonyCount} colonies with 6 discs in supply and 6 dead`, () => {
        expect(state.colonies).toHaveLength(colonyCount)
        for (const colony of state.colonies) {
            expect(colony.supply).toBe(6)
            expect(colony.dead).toBe(6)
            expect(colony.supply + colony.dead + state.board.discsOfColor(colony.color)).toBe(
                DiscsPerColony
            )
        }
    })

    it('puts one grasshopper per colony on each start habitat in turn order', () => {
        for (const habitatId of StartHabitatIds) {
            const occupants = state.board.habitat(habitatId).occupants
            expect(occupants.map((occupant) => occupant.color)).toEqual(
                state.colonies.map((colony) => colony.color)
            )
            expect(occupants.every((occupant) => occupant[InsectKind.Grasshopper] === 1)).toBe(true)
        }
    })

    it(`fills Region I round-robin with ${cubesPerColony} cubes per colony`, () => {
        const order = spacesInTurnOrder(0).map((space) => state.board.cubeOn(space.id))
        expect(order).toEqual(order.map((_, index) => state.colonies[index % colonyCount]!.color))
        expect(state.cubesInRegion(0)).toBe(12)
        for (const colony of state.colonies) {
            expect(order.filter((color) => color === colony.color)).toHaveLength(cubesPerColony)
        }
    })

    it('starts with the colony on the bottom-left cube choosing a space', () => {
        expect(state.machineState).toBe(MachineState.ChooseSpace)
        expect(state.activeColor).toBe(state.board.cubeOn('I-L6'))
        expect(state.activePlayerIds).toEqual([state.colony(state.activeColor!).playerId])
    })

    it('places all 15 action bonus tokens', () => {
        expect(Object.keys(state.board.bonusTokens)).toHaveLength(15)
    })
})

describe('duel setup', () => {
    it('gives each player alternating colours 1&3 and 2&4', () => {
        const state = new LocustTable(2, 3).view
        const [first, second] = state.turnManager.turnOrder
        expect(state.colonies.map((colony) => colony.playerId)).toEqual([
            first,
            second,
            first,
            second
        ])
        expect(state.isDuel).toBe(true)
    })
})
