import { describe, expect, it } from 'vitest'
import {
    ActionKind,
    ActionSpaces,
    HabitatColor,
    HabitatLinks,
    Habitats,
    IslandHabitatId,
    RegionCount,
    getHabitat,
    habitatNeighbors,
    habitatsInRegion,
    spacesInTurnOrder
} from '../data/board.js'

describe('board data (map v0-42)', () => {
    it('has the printed habitats per region', () => {
        expect(Habitats).toHaveLength(22)
        expect(habitatsInRegion(0).map((habitat) => habitat.color)).toEqual([
            'blue',
            'red',
            'yellow'
        ])
        expect(habitatsInRegion(3).map((habitat) => habitat.color)).toEqual([
            'yellow',
            'blue',
            'red',
            'green'
        ])
        expect(habitatsInRegion(5).map((habitat) => habitat.color)).toEqual([
            'yellow',
            'red',
            'blue'
        ])
        expect(Habitats.filter((habitat) => habitat.start).map((habitat) => habitat.id)).toEqual([
            'I-1',
            'I-2',
            'I-3'
        ])
    })

    it('leaves the Island unconnected', () => {
        expect(getHabitat(IslandHabitatId).island).toBe(true)
        expect(habitatNeighbors(IslandHabitatId)).toEqual([])
    })

    it('only links habitats in the same or neighbouring regions, without duplicates', () => {
        const keys = HabitatLinks.map(([a, b]) => [a, b].sort().join('|'))
        expect(new Set(keys).size).toBe(keys.length)
        for (const [a, b] of HabitatLinks) {
            expect(Math.abs(getHabitat(a).region - getHabitat(b).region)).toBeLessThanOrEqual(1)
        }
        expect(habitatNeighbors('I-1').sort()).toEqual(['II-1', 'II-2'])
        expect(habitatNeighbors('IV-3').sort()).toEqual([
            'III-2',
            'III-3',
            'III-4',
            'IV-2',
            'V-2',
            'V-3',
            'V-4'
        ])
    })

    it('prints 12 action spaces per region with 15 action bonus tokens in II-F', () => {
        for (let region = 0; region < RegionCount; region += 1) {
            expect(ActionSpaces.filter((space) => space.region === region)).toHaveLength(12)
        }
        expect(ActionSpaces.filter((space) => space.region === 0 && space.kind)).toHaveLength(0)
        expect(ActionSpaces.filter((space) => space.bonus)).toHaveLength(15)
        expect(ActionSpaces.filter((space) => space.unlimited).map((space) => space.id)).toEqual([
            'F-L1',
            'F-R1'
        ])
    })

    it('gives every region II-V the same action mix', () => {
        for (let region = 1; region <= 4; region += 1) {
            const spaces = ActionSpaces.filter((space) => space.region === region)
            const kinds = spaces.map((space) => `${space.kind}${space.level}`).sort()
            expect(kinds).toEqual(
                [
                    'Cannibalize1',
                    'Cannibalize2',
                    'Hatch3',
                    'Hatch5',
                    'JumpOrBreed2',
                    'JumpOrBreed2',
                    'JumpOrBreed2',
                    'JumpOrBreed3',
                    'JumpOrBreed3',
                    'JumpOrBreed3',
                    'Swarm1',
                    'Swarm1'
                ].sort()
            )
            const jumpColors = spaces
                .filter((space) => space.kind === ActionKind.JumpOrBreed)
                .map((space) => space.color)
            for (const color of [HabitatColor.Blue, HabitatColor.Red, HabitatColor.Yellow]) {
                expect(jumpColors.filter((candidate) => candidate === color)).toHaveLength(2)
            }
        }
    })

    it('orders cubes left column bottom-up, then right column bottom-up', () => {
        expect(spacesInTurnOrder(0).map((space) => space.id)).toEqual([
            'I-L6',
            'I-L5',
            'I-L4',
            'I-L3',
            'I-L2',
            'I-L1',
            'I-R6',
            'I-R5',
            'I-R4',
            'I-R3',
            'I-R2',
            'I-R1'
        ])
    })
})
