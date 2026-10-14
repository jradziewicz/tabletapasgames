export enum HabitatColor {
    Blue = 'blue',
    Red = 'red',
    Yellow = 'yellow',
    Green = 'green'
}

export enum ActionKind {
    JumpOrBreed = 'JumpOrBreed',
    Swarm = 'Swarm',
    Cannibalize = 'Cannibalize',
    Hatch = 'Hatch'
}

export enum BonusToken {
    Grey = 'grey',
    Orange = 'orange',
    Cream = 'cream',
    Blue = 'blue',
    Red = 'red',
    Yellow = 'yellow',
    Green = 'green'
}

export const BonusTokenTypes = Object.values(BonusToken)

export function majorityToken(color: HabitatColor): BonusToken {
    switch (color) {
        case HabitatColor.Blue:
            return BonusToken.Blue
        case HabitatColor.Red:
            return BonusToken.Red
        case HabitatColor.Yellow:
            return BonusToken.Yellow
        case HabitatColor.Green:
            return BonusToken.Green
    }
}

export const RegionLabels = ['I', 'II', 'III', 'IV', 'V', 'F'] as const
export const RegionCount = RegionLabels.length
export const FinalRegion = RegionCount - 1

export enum SpaceColumn {
    Left = 'L',
    Right = 'R'
}

export const SpaceRows = 6

export type Habitat = {
    id: string
    region: number
    row: number
    color: HabitatColor
    start: boolean
    island: boolean
}

export type ActionSpace = {
    id: string
    region: number
    column: SpaceColumn
    row: number
    kind?: ActionKind
    level: number
    color?: HabitatColor
    bonus?: BonusToken
    unlimited: boolean
}

const { Blue, Red, Yellow, Green } = HabitatColor

const HabitatColorsByRegion: HabitatColor[][] = [
    [Blue, Red, Yellow],
    [Yellow, Red, Blue, Yellow],
    [Red, Yellow, Red, Blue],
    [Yellow, Blue, Red, Green],
    [Blue, Yellow, Blue, Red],
    [Yellow, Red, Blue]
]

export function habitatId(region: number, row: number): string {
    return `${RegionLabels[region]}-${row}`
}

export const Habitats: Habitat[] = HabitatColorsByRegion.flatMap((colors, region) =>
    colors.map((color, index) => ({
        id: habitatId(region, index + 1),
        region,
        row: index + 1,
        color,
        start: region === 0,
        island: color === Green
    }))
)

export const IslandHabitatId = habitatId(3, 4)
export const StartHabitatIds = Habitats.filter((habitat) => habitat.start).map(
    (habitat) => habitat.id
)

const HabitatsById = new Map(Habitats.map((habitat) => [habitat.id, habitat]))

export function getHabitat(id: string): Habitat {
    const habitat = HabitatsById.get(id)
    if (!habitat) {
        throw Error(`Unknown habitat ${id}`)
    }
    return habitat
}

export function habitatsInRegion(region: number): Habitat[] {
    return Habitats.filter((habitat) => habitat.region === region)
}

const link = (
    fromRegion: number,
    fromRow: number,
    toRegion: number,
    toRow: number
): [string, string] => [habitatId(fromRegion, fromRow), habitatId(toRegion, toRow)]

const verticalLinks = (region: number, rowCount: number): [string, string][] =>
    Array.from({ length: rowCount - 1 }, (_, index) => link(region, index + 1, region, index + 2))

// Read off map v0-42: the Island (IV-4) has no lines at all.
export const HabitatLinks: [string, string][] = [
    link(0, 1, 1, 1),
    link(0, 1, 1, 2),
    link(0, 2, 1, 2),
    link(0, 2, 1, 3),
    link(0, 3, 1, 3),
    link(0, 3, 1, 4),
    ...verticalLinks(1, 4),
    link(1, 1, 2, 1),
    link(1, 1, 2, 2),
    link(1, 2, 2, 1),
    link(1, 2, 2, 2),
    link(1, 2, 2, 3),
    link(1, 3, 2, 2),
    link(1, 3, 2, 3),
    link(1, 3, 2, 4),
    link(1, 4, 2, 3),
    link(1, 4, 2, 4),
    ...verticalLinks(2, 4),
    link(2, 1, 3, 1),
    link(2, 1, 3, 2),
    link(2, 2, 3, 1),
    link(2, 2, 3, 2),
    link(2, 2, 3, 3),
    link(2, 3, 3, 2),
    link(2, 3, 3, 3),
    link(2, 4, 3, 3),
    ...verticalLinks(3, 3),
    link(3, 1, 4, 1),
    link(3, 1, 4, 2),
    link(3, 2, 4, 1),
    link(3, 2, 4, 2),
    link(3, 2, 4, 3),
    link(3, 3, 4, 2),
    link(3, 3, 4, 3),
    link(3, 3, 4, 4),
    ...verticalLinks(4, 4),
    link(4, 1, 5, 1),
    link(4, 2, 5, 1),
    link(4, 2, 5, 2),
    link(4, 3, 5, 2),
    link(4, 3, 5, 3),
    link(4, 4, 5, 3),
    ...verticalLinks(5, 3)
]

const NeighborsById = new Map<string, string[]>(
    Habitats.map((habitat) => [
        habitat.id,
        HabitatLinks.flatMap(([from, to]) =>
            from === habitat.id ? [to] : to === habitat.id ? [from] : []
        )
    ])
)

export function habitatNeighbors(id: string): string[] {
    return NeighborsById.get(id) ?? []
}

export function areLinked(from: string, to: string): boolean {
    return habitatNeighbors(from).includes(to)
}

type SpaceRowSpec = [
    kind: ActionKind,
    level: number,
    color: HabitatColor | undefined,
    bonus: BonusToken | undefined
]
type SpaceRow = [left: SpaceRowSpec, right: SpaceRowSpec]

const swarm = (bonus?: BonusToken): SpaceRowSpec => [ActionKind.Swarm, 1, undefined, bonus]
const cannibalize = (level: number, bonus?: BonusToken): SpaceRowSpec => [
    ActionKind.Cannibalize,
    level,
    undefined,
    bonus
]
const jumpOrBreed = (level: number, color: HabitatColor): SpaceRowSpec => [
    ActionKind.JumpOrBreed,
    level,
    color,
    undefined
]
const hatchRow: SpaceRow = [
    [ActionKind.Hatch, 3, undefined, BonusToken.Cream],
    [ActionKind.Hatch, 5, undefined, undefined]
]
const swarmFirstRow: SpaceRow = [swarm(), cannibalize(2)]
const bonusRow: SpaceRow = [cannibalize(1, BonusToken.Grey), swarm(BonusToken.Orange)]
const colorRows = (rows: [HabitatColor, HabitatColor][]): SpaceRow[] =>
    rows.map(([left, right]) => [jumpOrBreed(2, left), jumpOrBreed(3, right)])

// Rows top to bottom as printed on map v0-42. Region F's first row is its two unlimited spaces.
const SpaceRowsByRegion: SpaceRow[][] = [
    [],
    [
        swarmFirstRow,
        bonusRow,
        ...colorRows([
            [Yellow, Red],
            [Red, Blue],
            [Blue, Yellow]
        ]),
        hatchRow
    ],
    [
        bonusRow,
        swarmFirstRow,
        ...colorRows([
            [Blue, Yellow],
            [Yellow, Red],
            [Red, Blue]
        ]),
        hatchRow
    ],
    [
        swarmFirstRow,
        bonusRow,
        ...colorRows([
            [Red, Blue],
            [Blue, Yellow],
            [Yellow, Red]
        ]),
        hatchRow
    ],
    [
        bonusRow,
        swarmFirstRow,
        ...colorRows([
            [Yellow, Red],
            [Red, Blue],
            [Blue, Yellow]
        ]),
        hatchRow
    ],
    [
        [swarm(), cannibalize(1)],
        bonusRow,
        ...colorRows([
            [Blue, Yellow],
            [Yellow, Red],
            [Red, Blue]
        ]),
        hatchRow
    ]
]

export function spaceId(region: number, column: SpaceColumn, row: number): string {
    return `${RegionLabels[region]}-${column}${row}`
}

function buildSpaces(): ActionSpace[] {
    const spaces: ActionSpace[] = []
    for (let region = 0; region < RegionCount; region += 1) {
        for (const column of [SpaceColumn.Left, SpaceColumn.Right]) {
            for (let row = 1; row <= SpaceRows; row += 1) {
                const spec =
                    SpaceRowsByRegion[region]![row - 1]?.[column === SpaceColumn.Left ? 0 : 1]
                spaces.push({
                    id: spaceId(region, column, row),
                    region,
                    column,
                    row,
                    kind: spec?.[0],
                    level: spec?.[1] ?? 0,
                    color: spec?.[2],
                    bonus: spec?.[3],
                    unlimited: region === FinalRegion && row === 1
                })
            }
        }
    }
    return spaces
}

export const ActionSpaces: ActionSpace[] = buildSpaces()

const SpacesById = new Map(ActionSpaces.map((space) => [space.id, space]))

export function getSpace(id: string): ActionSpace {
    const space = SpacesById.get(id)
    if (!space) {
        throw Error(`Unknown action space ${id}`)
    }
    return space
}

// Cubes act left column bottom-up, then right column bottom-up (Justin).
export function spacesInTurnOrder(region: number): ActionSpace[] {
    const order: ActionSpace[] = []
    for (const column of [SpaceColumn.Left, SpaceColumn.Right]) {
        for (let row = SpaceRows; row >= 1; row -= 1) {
            order.push(getSpace(spaceId(region, column, row)))
        }
    }
    return order
}
