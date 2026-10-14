import { Color, Hydratable } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { BonusToken, Habitats, getSpace } from '../data/board.js'

export enum InsectKind {
    Grasshopper = 'grasshopper',
    Locust = 'locust',
    Nymph = 'nymph'
}

export const InsectKinds = [InsectKind.Grasshopper, InsectKind.Locust, InsectKind.Nymph]

export type Occupant = Type.Static<typeof Occupant>
export const Occupant = Type.Object({
    color: Type.Enum(Color),
    grasshopper: Type.Number(),
    locust: Type.Number(),
    nymph: Type.Number()
})

// Occupants are kept in quadrant priority order: NE, SE, SW, NW.
export type HabitatState = Type.Static<typeof HabitatState>
export const HabitatState = Type.Object({
    id: Type.String(),
    occupants: Type.Array(Occupant)
})

export type BoardState = Type.Static<typeof BoardState>
export const BoardState = Type.Object({
    habitats: Type.Array(HabitatState),
    cubes: Type.Record(Type.String(), Type.Enum(Color)),
    unlimitedCubes: Type.Record(Type.String(), Type.Array(Type.Enum(Color))),
    bonusTokens: Type.Record(Type.String(), Type.Enum(BonusToken))
})

export const BoardStateValidator = Compile(BoardState)

export function occupantDiscs(occupant: Occupant): number {
    return occupant.grasshopper + occupant.locust + occupant.nymph
}

export function emptyBoard(): BoardState {
    return {
        habitats: Habitats.map((habitat) => ({ id: habitat.id, occupants: [] })),
        cubes: {},
        unlimitedCubes: {},
        bonusTokens: {}
    }
}

export class HydratedBoardState extends Hydratable<typeof BoardState> implements BoardState {
    declare habitats: HabitatState[]
    declare cubes: Record<string, Color>
    declare unlimitedCubes: Record<string, Color[]>
    declare bonusTokens: Record<string, BonusToken>

    constructor(data: BoardState) {
        super(data, BoardStateValidator)
    }

    habitat(id: string): HabitatState {
        const habitat = this.habitats.find((candidate) => candidate.id === id)
        if (!habitat) {
            throw Error(`Unknown habitat ${id}`)
        }
        return habitat
    }

    occupant(habitatId: string, color: Color): Occupant | undefined {
        return this.habitat(habitatId).occupants.find((occupant) => occupant.color === color)
    }

    count(habitatId: string, color: Color, kind: InsectKind): number {
        return this.occupant(habitatId, color)?.[kind] ?? 0
    }

    discsIn(habitatId: string): number {
        return this.habitat(habitatId).occupants.reduce(
            (sum, occupant) => sum + occupantDiscs(occupant),
            0
        )
    }

    add(habitatId: string, color: Color, kind: InsectKind, amount: number = 1) {
        if (amount <= 0) {
            return
        }
        const habitat = this.habitat(habitatId)
        let occupant = habitat.occupants.find((candidate) => candidate.color === color)
        if (!occupant) {
            occupant = { color, grasshopper: 0, locust: 0, nymph: 0 }
            habitat.occupants.push(occupant)
        }
        occupant[kind] += amount
    }

    remove(habitatId: string, color: Color, kind: InsectKind, amount: number = 1) {
        if (amount <= 0) {
            return
        }
        const habitat = this.habitat(habitatId)
        const occupant = habitat.occupants.find((candidate) => candidate.color === color)
        if (!occupant || occupant[kind] < amount) {
            throw Error(`Not enough ${color} ${kind}s in ${habitatId}`)
        }
        occupant[kind] -= amount
        if (occupantDiscs(occupant) === 0) {
            habitat.occupants = habitat.occupants.filter((candidate) => candidate !== occupant)
        }
    }

    // Swarming: nymphs and locusts die and grasshoppers become locusts, keeping quadrant order.
    swarmHabitat(habitatId: string): { color: Color; died: number }[] {
        const habitat = this.habitat(habitatId)
        const deaths = habitat.occupants.map((occupant) => {
            const died = occupant.nymph + occupant.locust
            occupant.locust = occupant.grasshopper
            occupant.grasshopper = 0
            occupant.nymph = 0
            return { color: occupant.color, died }
        })
        habitat.occupants = habitat.occupants.filter((occupant) => occupantDiscs(occupant) > 0)
        return deaths
    }

    matureNymphs(color: Color): number {
        let matured = 0
        for (const habitat of this.habitats) {
            const occupant = habitat.occupants.find((candidate) => candidate.color === color)
            if (occupant) {
                matured += occupant.nymph
                occupant.grasshopper += occupant.nymph
                occupant.nymph = 0
            }
        }
        return matured
    }

    clearHabitat(habitatId: string): { color: Color; died: number }[] {
        const habitat = this.habitat(habitatId)
        const deaths = habitat.occupants.map((occupant) => ({
            color: occupant.color,
            died: occupantDiscs(occupant)
        }))
        habitat.occupants = []
        return deaths
    }

    nymphsOf(color: Color): number {
        return this.habitats.reduce(
            (sum, habitat) =>
                sum +
                (habitat.occupants.find((candidate) => candidate.color === color)?.nymph ?? 0),
            0
        )
    }

    cubeOn(spaceId: string): Color | undefined {
        return this.cubes[spaceId]
    }

    isSpaceFree(spaceId: string): boolean {
        return getSpace(spaceId).unlimited || this.cubes[spaceId] === undefined
    }

    placeCube(spaceId: string, color: Color) {
        if (getSpace(spaceId).unlimited) {
            this.unlimitedCubes[spaceId] = [...(this.unlimitedCubes[spaceId] ?? []), color]
            return
        }
        if (this.cubes[spaceId] !== undefined) {
            throw Error(`Action space ${spaceId} is occupied`)
        }
        this.cubes[spaceId] = color
    }

    removeCube(spaceId: string): Color {
        const color = this.cubes[spaceId]
        if (color === undefined) {
            throw Error(`No cube on ${spaceId}`)
        }
        delete this.cubes[spaceId]
        return color
    }

    takeBonusToken(spaceId: string): BonusToken | undefined {
        const token = this.bonusTokens[spaceId]
        delete this.bonusTokens[spaceId]
        return token
    }

    discsOfColor(color: Color): number {
        return this.habitats.reduce((sum, habitat) => {
            const occupant = habitat.occupants.find((candidate) => candidate.color === color)
            return sum + (occupant ? occupantDiscs(occupant) : 0)
        }, 0)
    }
}
