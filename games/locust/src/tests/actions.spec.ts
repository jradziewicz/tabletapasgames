import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { isPlaceCube } from '../actions/placeCube.js'
import { MachineState } from '../definition/states.js'
import { InsectKind } from '../model/board.js'
import { LocustTable } from '../testing/table.js'
import { clearHabitats, makeActiveRegion, passTurn, put } from '../testing/scenario.js'
import { evenVictims, legalCubeSpaceIds } from '../operations/rules.js'

const { Grasshopper, Locust, Nymph } = InsectKind

function threePlayerTable() {
    const table = new LocustTable(3, 7)
    const [a, b, c] = table.view.colonies.map((colony) => colony.color) as [Color, Color, Color]
    table.edit((state) => clearHabitats(state))
    return { table, a, b, c }
}

function place(table: LocustTable, spaceId: string, alternative = false) {
    table.act(ActionType.PlaceCube, { spaceId, alternative })
}

describe('choosing an action space', () => {
    it('only allows empty spaces right of the Active Region', () => {
        const { table } = threePlayerTable()
        const legal = legalCubeSpaceIds(table.view)
        expect(legal.some((spaceId) => spaceId.startsWith('I-'))).toBe(false)
        expect(legal).toContain('II-L1')
        expect(() => place(table, 'I-L1')).toThrow()
        place(table, 'II-L1')
        passEmptyAction(table)
        expect(legalCubeSpaceIds(table.view)).not.toContain('II-L1')
    })

    it('moves the active cube, takes the bonus token and changes the rain', () => {
        const { table, a } = threePlayerTable()
        expect(table.view.cubesInRegion(0)).toBe(12)
        place(table, 'II-L2')
        const state = table.view
        expect(state.board.cubeOn('I-L6')).toBeUndefined()
        expect(state.board.cubeOn('II-L2')).toBe(a)
        expect(state.colony(a).tokens).toEqual(['grey'])
        expect(state.board.bonusTokens['II-L2']).toBeUndefined()
        expect(state.cubesInRegion(0)).toBe(11)
        expect(state.cubesInRegion(1)).toBe(1)
        expect(state.pendingAction).toMatchObject({ kind: 'Cannibalize', level: 1 })
    })

    it('boosts the level by one in the region two right of the Active Region', () => {
        const { table } = threePlayerTable()
        place(table, 'III-L3')
        expect(table.view.pendingAction).toMatchObject({ kind: 'JumpOrBreed', level: 3 })
    })

    it('lets the next cube in line act after an action', () => {
        const { table, a, b, c } = threePlayerTable()
        expect(table.view.activeColor).toBe(a)
        passTurn(table)
        expect(table.view.activeColor).toBe(b)
        passTurn(table)
        expect(table.view.activeColor).toBe(c)
        passTurn(table)
        expect(table.view.activeColor).toBe(a)
        expect(table.view.machineState).toBe(MachineState.ChooseSpace)
    })

    it('offers the Alternative Action in 3 players only in the final round', () => {
        const { table } = threePlayerTable()
        expect(() => place(table, 'II-L1', true)).toThrow('Alternative Action')
        table.edit((state) => makeActiveRegion(state, 4))
        place(table, 'F-L1', true)
        expect(table.view.pendingAction).toMatchObject({
            kind: 'JumpOrBreed',
            level: 1,
            alternative: true
        })
        expect(table.view.pendingAction?.color).toBeUndefined()
    })

    it('always offers the Alternative Action with four colonies', () => {
        const table = new LocustTable(4, 2)
        place(table, 'II-L6', true)
        expect(table.view.pendingAction).toMatchObject({
            kind: 'JumpOrBreed',
            level: 1,
            alternative: true
        })
        expect(table.validActionTypes(table.state.activePlayerIds[0]!)).toEqual([
            ActionType.Jump,
            ActionType.Breed
        ])
    })

    it('stacks any number of cubes on the unlimited Region F spaces', () => {
        const { table } = threePlayerTable()
        place(table, 'F-L1')
        passEmptyAction(table)
        place(table, 'F-L1')
        passEmptyAction(table)
        expect(table.view.board.unlimitedCubes['F-L1']).toHaveLength(2)
        expect(table.view.cubesInRegion(5)).toBe(2)
    })
})

function passEmptyAction(table: LocustTable) {
    if (table.view.machineState !== MachineState.PerformAction) return
    const kind = table.view.pendingAction!.kind
    const empty: Record<string, [string, Record<string, unknown>]> = {
        JumpOrBreed: [ActionType.Jump, { hops: [] }],
        Hatch: [ActionType.Hatch, { count: 0 }],
        Cannibalize: [ActionType.Cannibalize, { attacks: [] }],
        Swarm: [ActionType.Swarm, { habitatIds: [] }]
    }
    const [type, fields] = empty[kind]!
    table.act(type, fields)
}

describe('JUMP', () => {
    // II-L5 is a blue JUMP/BREED level 2.
    it('moves grasshoppers from habitats of the action colour along lines', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => {
            put(state, 'II-3', a, Grasshopper, 2)
            state.board.cubes['III-L3'] = Color.Gray
            state.board.cubes['IV-L3'] = Color.Gray
        })
        place(table, 'II-L5')
        table.act(ActionType.Jump, {
            hops: [
                { from: 'II-3', to: 'III-4' },
                { from: 'III-4', to: 'IV-3' }
            ]
        })
        const state = table.view
        expect(state.board.count('II-3', a, Grasshopper)).toBe(1)
        expect(state.board.count('IV-3', a, Grasshopper)).toBe(1)
        expect(state.board.count('III-4', a, Grasshopper)).toBe(0)
    })

    it('requires every jump to start in a habitat of the action colour', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => put(state, 'I-1', a, Grasshopper))
        place(table, 'II-L5')
        expect(() =>
            table.act(ActionType.Jump, {
                hops: [
                    { from: 'I-1', to: 'II-1' },
                    { from: 'II-1', to: 'III-1' }
                ]
            })
        ).toThrow('blue habitat')
    })

    it('never lets the destination become crowded', () => {
        const { table, a, b } = threePlayerTable()
        table.edit((state) => {
            put(state, 'I-1', a, Grasshopper)
            put(state, 'II-1', b, Grasshopper)
        })
        place(table, 'II-L5')
        expect(() => table.act(ActionType.Jump, { hops: [{ from: 'I-1', to: 'II-1' }] })).toThrow(
            'crowded'
        )
        expect(() => table.act(ActionType.Jump, { hops: [{ from: 'I-1', to: 'III-1' }] })).toThrow(
            'not linked'
        )
        table.act(ActionType.Jump, { hops: [{ from: 'I-1', to: 'II-2' }] })
        expect(table.view.board.count('II-2', a, Grasshopper)).toBe(1)
    })

    it('only moves grasshoppers, up to the action level', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => {
            put(state, 'I-1', a, Locust)
            put(state, 'I-1', a, Nymph)
            state.board.cubes['II-L4'] = Color.Gray
            state.board.cubes['II-R4'] = Color.Gray
        })
        place(table, 'II-L5')
        expect(() => table.act(ActionType.Jump, { hops: [{ from: 'I-1', to: 'II-1' }] })).toThrow(
            'No grasshopper'
        )
        table.edit((state) => put(state, 'I-1', a, Grasshopper, 3))
        const hops = [
            { from: 'I-1', to: 'II-1' },
            { from: 'I-1', to: 'II-2' },
            { from: 'I-1', to: 'II-2' }
        ]
        expect(() => table.act(ActionType.Jump, { hops })).toThrow('At most 2')
    })
})

describe('BREED', () => {
    // II-R4 is a blue JUMP/BREED level 3.
    it('adds nymphs from supply where the colony has a grasshopper or locust, ignoring crowding', () => {
        const { table, a, b } = threePlayerTable()
        table.edit((state) => {
            put(state, 'II-3', a, Locust)
            put(state, 'II-3', b, Grasshopper)
            put(state, 'I-1', a, Grasshopper)
        })
        place(table, 'II-R4')
        table.act(ActionType.Breed, { habitatIds: ['II-3', 'II-3', 'I-1'] })
        const state = table.view
        expect(state.board.count('II-3', a, Nymph)).toBe(2)
        expect(state.board.count('I-1', a, Nymph)).toBe(1)
        expect(state.colony(a).supply).toBe(3)
        expect(state.isCrowded('II-3')).toBe(true)
    })

    it('rejects habitats of another colour, without an adult, or outside the Breeding Zone', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => {
            put(state, 'I-2', a, Grasshopper)
            put(state, 'II-3', a, Nymph)
            put(state, 'I-1', a, Grasshopper)
            makeActiveRegion(state, 1)
        })
        place(table, 'III-R5')
        expect(table.view.pendingAction).toMatchObject({ color: 'blue' })
        expect(() => table.act(ActionType.Breed, { habitatIds: ['I-2'] })).toThrow(
            'Cannot breed in I-2'
        )
        expect(() => table.act(ActionType.Breed, { habitatIds: ['II-3'] })).toThrow(
            'Cannot breed in II-3'
        )
        expect(() => table.act(ActionType.Breed, { habitatIds: ['I-1'] })).toThrow(
            'Cannot breed in I-1'
        )
    })

    it('is limited by the discs in supply', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => {
            put(state, 'I-1', a, Grasshopper)
            state.colony(a).supply = 1
        })
        place(table, 'II-R4')
        expect(() => table.act(ActionType.Breed, { habitatIds: ['I-1', 'I-1'] })).toThrow('supply')
    })

    it('turns nymphs into grasshoppers at the start of their colony’s next turn', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => put(state, 'I-1', a, Grasshopper))
        place(table, 'II-R4')
        table.act(ActionType.Breed, { habitatIds: ['I-1', 'I-1'] })
        passTurn(table)
        expect(table.view.activeColor).not.toBe(a)
        expect(table.view.board.count('I-1', a, Nymph)).toBe(2)
        passTurn(table)
        const processed = table.processed.at(-1)
        expect(processed?.type).toBe(ActionType.MatureNymphs)
        expect(table.view.activeColor).toBe(a)
        expect(table.view.board.count('I-1', a, Nymph)).toBe(0)
        expect(table.view.board.count('I-1', a, Grasshopper)).toBe(3)
    })

    it('can never place nymphs on the Island', () => {
        const table = new LocustTable(4, 2)
        const a = table.view.activeColor!
        table.edit((state) => put(state, 'IV-4', a, Locust))
        place(table, 'II-L4', true)
        expect(() => table.act(ActionType.Breed, { habitatIds: ['IV-4'] })).toThrow(
            'Cannot breed in IV-4'
        )
    })
})

describe('HATCH', () => {
    function hatchedBy(table: LocustTable): number | undefined {
        const placed = table.processed.findLast((action) => action.type === ActionType.PlaceCube)
        return placed && isPlaceCube(placed) ? placed.metadata?.hatched : undefined
    }

    it('automatically hatches as many dead discs as the level allows and ends the turn', () => {
        const { table, a, b } = threePlayerTable()
        place(table, 'II-L6')
        expect(table.view.colony(a).supply).toBe(9)
        expect(table.view.colony(a).dead).toBe(3)
        expect(hatchedBy(table)).toBe(3)
        expect(table.view.machineState).toBe(MachineState.ChooseSpace)
        expect(table.view.activeColor).toBe(b)
    })

    it('hatches only the dead discs there are', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => {
            state.colony(a).dead = 1
        })
        place(table, 'II-R6')
        expect(table.view.colony(a).dead).toBe(0)
        expect(hatchedBy(table)).toBe(1)
    })

    it('gets the Level +1 boost', () => {
        const { table, a } = threePlayerTable()
        table.edit((state) => {
            state.colony(a).dead = 9
        })
        place(table, 'III-R6')
        expect(hatchedBy(table)).toBe(6)
    })
})

describe('CANNIBALIZE', () => {
    function setupFight() {
        const { table, a, b, c } = threePlayerTable()
        table.edit((state) => {
            put(state, 'I-1', a, Locust, 3)
            put(state, 'I-1', b, Grasshopper, 3)
            put(state, 'I-1', c, Nymph, 1)
        })
        return { table, a, b, c }
    }

    it('removes one opposing insect per own locust, spread as evenly as possible', () => {
        const { table, a, b, c } = setupFight()
        place(table, 'II-L2')
        expect(() =>
            table.act(ActionType.Cannibalize, {
                attacks: [
                    { habitatId: 'I-1', victims: [{ color: b, kind: Grasshopper, count: 3 }] }
                ]
            })
        ).toThrow('evenly')
        table.act(ActionType.Cannibalize, {
            attacks: [
                {
                    habitatId: 'I-1',
                    victims: [
                        { color: b, kind: Grasshopper, count: 2 },
                        { color: c, kind: Nymph, count: 1 }
                    ]
                }
            ]
        })
        const state = table.view
        expect(state.board.count('I-1', b, Grasshopper)).toBe(1)
        expect(state.board.count('I-1', c, Nymph)).toBe(0)
        expect(state.colony(b).dead).toBe(8)
        expect(state.colony(c).dead).toBe(7)
        expect(state.board.count('I-1', a, Locust)).toBe(3)
    })

    it('must remove exactly as many insects as it can', () => {
        const { table, b } = setupFight()
        place(table, 'II-L2')
        expect(() =>
            table.act(ActionType.Cannibalize, {
                attacks: [
                    { habitatId: 'I-1', victims: [{ color: b, kind: Grasshopper, count: 1 }] }
                ]
            })
        ).toThrow('exactly 3')
    })

    it('needs a locust in each chosen habitat and at most level habitats', () => {
        const { table, a, b } = setupFight()
        table.edit((state) => {
            put(state, 'I-2', a, Locust)
            put(state, 'I-2', b, Locust)
            put(state, 'I-3', b, Locust)
            put(state, 'I-3', a, Locust)
        })
        place(table, 'II-R1')
        expect(table.view.pendingAction?.level).toBe(2)
        const attackOn = (habitatId: string) => ({
            habitatId,
            victims: evenVictims(table.view, a, habitatId)
        })
        expect(() =>
            table.act(ActionType.Cannibalize, {
                attacks: [attackOn('I-1'), attackOn('I-2'), attackOn('I-3')]
            })
        ).toThrow('At most 2')
        table.act(ActionType.Cannibalize, { attacks: [attackOn('I-1'), attackOn('I-2')] })
        expect(table.view.board.count('I-2', b, Locust)).toBe(0)
        expect(table.view.board.count('I-3', b, Locust)).toBe(1)
    })

    it('suggests an even split', () => {
        const { table, a, b, c } = setupFight()
        const victims = evenVictims(table.view, a, 'I-1')
        expect(victims).toEqual([
            { color: b, kind: Grasshopper, count: 2 },
            { color: c, kind: Nymph, count: 1 }
        ])
    })
})

describe('SWARM', () => {
    // II-L1 is SWARM 1; after the first cube leaves Region I it holds 11 discs per habitat.
    function setupCrowd() {
        const { table, a, b, c } = threePlayerTable()
        table.edit((state) => {
            put(state, 'I-2', a, Grasshopper, 3)
            put(state, 'I-2', a, Nymph, 1)
            put(state, 'I-2', a, Locust, 1)
            put(state, 'I-2', b, Grasshopper, 4)
            put(state, 'I-2', c, Grasshopper, 3)
        })
        return { table, a, b, c }
    }

    it('kills nymphs and locusts and makes every colony relocate its new locusts', () => {
        const { table, a, b, c } = setupCrowd()
        place(table, 'II-L1')
        expect(table.view.isCrowded('I-2')).toBe(true)
        table.act(ActionType.Swarm, { habitatIds: ['I-2'] })
        let state = table.view
        expect(state.machineState).toBe(MachineState.RelocateLocusts)
        expect(state.colony(a).dead).toBe(8)
        expect(state.board.count('I-2', a, Locust)).toBe(3)
        expect(state.board.count('I-2', b, Locust)).toBe(4)
        expect(state.swarm?.relocators).toEqual([a, b, c])
        expect(state.activePlayerIds).toEqual([state.colony(a).playerId])

        expect(() =>
            table.act(ActionType.RelocateLocusts, { destinations: ['I-1', 'I-1'] })
        ).toThrow('exactly 3')
        expect(() =>
            table.act(ActionType.RelocateLocusts, { destinations: ['II-1', 'II-1', 'I-1'] })
        ).toThrow('crowded')
        expect(() =>
            table.act(ActionType.RelocateLocusts, { destinations: ['I-2', 'I-1', 'I-1'] })
        ).toThrow('leave')
        expect(() =>
            table.act(ActionType.RelocateLocusts, { destinations: ['II-1', 'I-1', 'IV-4'] })
        ).toThrow('IV-4 would become crowded')
        table.act(ActionType.RelocateLocusts, { destinations: ['II-1', 'I-1', 'I-3'] })
        state = table.view
        expect(state.board.count('II-1', a, Locust)).toBe(1)
        expect(state.activePlayerIds).toEqual([state.colony(b).playerId])
        expect(() =>
            table.act(
                ActionType.RelocateLocusts,
                { destinations: ['I-1', 'I-1', 'I-1', 'I-1'] },
                state.colony(a).playerId
            )
        ).toThrow()
        table.act(ActionType.RelocateLocusts, { destinations: ['I-1', 'I-1', 'I-3', 'II-2'] })
        table.act(ActionType.RelocateLocusts, { destinations: ['I-3', 'I-3', 'II-3'] })
        state = table.view
        expect(state.board.discsIn('I-2')).toBe(0)
        expect(state.board.count('I-1', b, Locust)).toBe(2)
        expect(state.swarm).toBeUndefined()
        expect(state.machineState).toBe(MachineState.ChooseSpace)
    })

    it('lets locusts reach the Island and kills those with nowhere to go', () => {
        const { table, a, b, c } = setupCrowd()
        table.edit((state) => {
            put(state, 'I-1', c, Grasshopper, 11)
            put(state, 'I-3', c, Grasshopper, 11)
            state.board.cubes['IV-L3'] = Color.Gray
        })
        place(table, 'II-L1')
        table.act(ActionType.Swarm, { habitatIds: ['I-2'] })
        expect(table.view.machineState).toBe(MachineState.RelocateLocusts)
        table.act(ActionType.RelocateLocusts, { destinations: ['II-1', 'IV-4', 'IV-1'] })
        let state = table.view
        expect(state.board.count('IV-4', a, Locust)).toBe(1)
        expect(state.swarm?.relocators).toEqual([b, c])
        expect(state.activePlayerIds).toEqual([state.colony(b).playerId])
        table.act(ActionType.RelocateLocusts, { destinations: ['II-2', 'II-3', 'II-4', 'IV-2'] })
        state = table.view
        expect(state.swarm).toBeDefined()
        table.act(ActionType.RelocateLocusts, { destinations: ['IV-3'] })
        state = table.view
        expect(state.board.count('I-2', c, Locust)).toBe(0)
        expect(state.colony(c).dead).toBe(6 + 2)
        expect(state.swarm).toBeUndefined()
        expect(state.machineState).toBe(MachineState.ChooseSpace)
        expect(state.activeColor).toBe(b)
    })

    it('only swarms crowded habitats in the Swarming Zone', () => {
        const { table, a } = setupCrowd()
        table.edit((state) => put(state, 'II-1', a, Grasshopper, 2))
        place(table, 'II-L1')
        expect(() => table.act(ActionType.Swarm, { habitatIds: ['I-1'] })).toThrow('not a crowded')
        expect(() => table.act(ActionType.Swarm, { habitatIds: ['II-1'] })).toThrow('not a crowded')
    })

    it('swarms two habitats from the Level +1 region, one after the other', () => {
        const { table, a, b } = setupCrowd()
        table.edit((state) => put(state, 'I-3', b, Grasshopper, 12))
        place(table, 'III-R1')
        expect(table.view.pendingAction).toMatchObject({ kind: 'Swarm', level: 2 })
        table.act(ActionType.Swarm, { habitatIds: ['I-2', 'I-3'] })
        expect(table.view.swarm).toMatchObject({ habitatId: 'I-2', queue: ['I-3'] })
        let guard = 0
        while (table.view.machineState === MachineState.RelocateLocusts && guard++ < 10) {
            const state = table.view
            const color = state.swarm!.relocators[0]!
            const needed = Math.min(state.board.count(state.swarm!.habitatId, color, Locust), 100)
            const open = state.board.habitats
                .filter((habitat) => habitat.id !== state.swarm!.habitatId)
                .flatMap((habitat) =>
                    Array.from({ length: state.freeRoom(habitat.id) }, () => habitat.id)
                )
            table.act(ActionType.RelocateLocusts, { destinations: open.slice(0, needed) })
        }
        const state = table.view
        expect(state.colony(a).dead).toBe(8)
        expect(state.board.discsIn('I-3')).toBe(0)
        expect(state.board.habitat('I-2').occupants.every((occupant) => occupant.color === b)).toBe(
            true
        )
        expect(state.board.count('I-1', a, Locust)).toBe(3)
        expect(state.machineState).toBe(MachineState.ChooseSpace)
    })
})
