import type { Point } from '@tabletop/common'
import { VictoryPointCellCenters } from './vpCells.js'

// Art-space (2000 x 1481) positions on the v0.50 board.

// Weapon/tool grid, bottom-right of the board: tool 1-8 left to right, weapon 1-5 bottom to top.
const GridFirstColumnX = 1608
const GridColumnSpacing = 43.4
const GridTopRowY = 1215
const GridRowSpacing = 36.8

export const GridCellSize = { width: GridColumnSpacing, height: GridRowSpacing }

export function gridCellPosition(weaponLevel: number, toolLevel: number): Point {
    return {
        x: GridFirstColumnX + (toolLevel - 1) * GridColumnSpacing,
        y: GridTopRowY + (5 - weaponLevel) * GridRowSpacing
    }
}

export function victoryPointPosition(victoryPoints: number): Point {
    const value = ((victoryPoints % 100) + 100) % 100
    return VictoryPointCellCenters[value]!
}
