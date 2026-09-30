// The 5 x 8 weapon/tool grid, transcribed from the v0.50 board (it matches the draft rulebook).
// weapon = row (1 bottom .. 5 top), tool = column (1 left .. 8 right).

export const MaxWeaponLevel = 5
export const MaxToolLevel = 8

export interface OreCapacity {
    gold: number
    silver: number
}

export const OreCapacityByToolLevel: Record<number, OreCapacity> = {
    1: { gold: 1, silver: 1 },
    2: { gold: 2, silver: 1 },
    3: { gold: 2, silver: 2 },
    4: { gold: 3, silver: 2 },
    5: { gold: 3, silver: 3 },
    6: { gold: 4, silver: 4 },
    7: { gold: 5, silver: 4 },
    8: { gold: 5, silver: 5 }
}

export interface GridCell {
    weapon: number
    tool: number
}

const cellKey = (cell: GridCell) => `${cell.weapon},${cell.tool}`

export const AddedBlockedUpFrom: GridCell[] = [{ weapon: 3, tool: 1 }]

export const RemovedGemCells: GridCell[] = [{ weapon: 4, tool: 2 }]

export const PrintedBlockedUpFrom: GridCell[] = [
    { weapon: 3, tool: 4 },
    { weapon: 3, tool: 5 },
    { weapon: 2, tool: 7 },
    { weapon: 1, tool: 3 }
]

const BlockedUpFrom: GridCell[] = [...PrintedBlockedUpFrom, ...AddedBlockedUpFrom]

const BlockedRightFrom: GridCell[] = [
    { weapon: 5, tool: 2 },
    { weapon: 4, tool: 7 },
    { weapon: 2, tool: 5 }
]

export const RedGemCells: GridCell[] = [
    { weapon: 3, tool: 3 },
    { weapon: 2, tool: 4 },
    { weapon: 1, tool: 5 }
]

export const BlueGemCells: GridCell[] = [
    { weapon: 5, tool: 4 },
    { weapon: 4, tool: 5 },
    { weapon: 3, tool: 6 },
    { weapon: 2, tool: 7 },
    { weapon: 1, tool: 8 }
]

const blockedUpKeys = new Set(BlockedUpFrom.map(cellKey))
const blockedRightKeys = new Set(BlockedRightFrom.map(cellKey))
const redGemKeys = new Set(RedGemCells.map(cellKey))
const blueGemKeys = new Set(BlueGemCells.map(cellKey))

export function canMoveUp(cell: GridCell): boolean {
    return cell.weapon < MaxWeaponLevel && !blockedUpKeys.has(cellKey(cell))
}

export function canMoveRight(cell: GridCell): boolean {
    return cell.tool < MaxToolLevel && !blockedRightKeys.has(cellKey(cell))
}

export function isRedGemCell(cell: GridCell): boolean {
    return redGemKeys.has(cellKey(cell))
}

export function isBlueGemCell(cell: GridCell): boolean {
    return blueGemKeys.has(cellKey(cell))
}
