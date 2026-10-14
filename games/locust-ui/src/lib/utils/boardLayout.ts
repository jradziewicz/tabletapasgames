import type { Point } from '@tabletop/common'
import { FinalRegion, SpaceColumn, type ActionSpace, type Habitat } from '@tabletop/locust'

// Coordinates are in a 2000-wide frame laid over the v0-42 board image (8859 x 6798 px).
export const BoardWidth = 2000
export const BoardHeight = 1535

export const RegionBounds: [number, number][] = [
    [68, 378],
    [378, 688],
    [688, 998],
    [998, 1308],
    [1308, 1620],
    [1620, 1930]
]

const RegionCenterX = [221, 533, 843, 1152, 1465, 1776]
const FourHabitatRowsY = [530, 805, 1080, 1350]
const ThreeHabitatRowsY = [665, 940, 1210]
const SpaceRowsY = [75, 130, 186, 243, 301, 358]
const SpaceColumnOffset = 39
const UnlimitedSpaceCenters: Record<SpaceColumn, Point> = {
    [SpaceColumn.Left]: { x: 1723, y: 57 },
    [SpaceColumn.Right]: { x: 1835, y: 57 }
}

export const HabitatRadius = 82
export const SpaceSize = 34
export const UnlimitedSpaceSize = 62

export function habitatCenter(habitat: Habitat): Point {
    const rows = habitat.region === 0 || habitat.region === FinalRegion ? ThreeHabitatRowsY : FourHabitatRowsY
    return { x: RegionCenterX[habitat.region] ?? 0, y: rows[habitat.row - 1] ?? 0 }
}

export function spaceCenter(space: ActionSpace): Point {
    if (space.unlimited) {
        return UnlimitedSpaceCenters[space.column]
    }
    const offset = space.column === SpaceColumn.Left ? -SpaceColumnOffset : SpaceColumnOffset
    return { x: (RegionCenterX[space.region] ?? 0) + offset, y: SpaceRowsY[space.row - 1] ?? 0 }
}

// Quadrant priority order on the board: NE, SE, SW, NW.
const QuadrantOffsets: Point[] = [
    { x: 34, y: -34 },
    { x: 34, y: 34 },
    { x: -34, y: 34 },
    { x: -34, y: -34 }
]

const NymphDistance = 2.02

function quadrantOffset(quadrant: number): Point {
    return QuadrantOffsets[quadrant % QuadrantOffsets.length] ?? { x: 0, y: 0 }
}

export function quadrantPoint(center: Point, quadrant: number, shift: Point = { x: 0, y: 0 }): Point {
    const offset = quadrantOffset(quadrant)
    return { x: center.x + offset.x + shift.x, y: center.y + offset.y + shift.y }
}

export function nymphPoint(center: Point, quadrant: number): Point {
    const offset = quadrantOffset(quadrant)
    return { x: center.x + offset.x * NymphDistance, y: center.y + offset.y * NymphDistance }
}
