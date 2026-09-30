import { RegionId } from '@tabletop/rocky-ventures'

// Art-space (2000 x 1481) scourge boxes printed on the v0.50 board, one per region. Gold Valley
// and Riverwood print landscape boxes, so their cards sit rotated 90 degrees clockwise.
export interface ScourgeBox {
    x: number
    y: number
    width: number
    height: number
    landscape: boolean
}

export const ScourgeBoxes: Record<RegionId, ScourgeBox> = {
    [RegionId.TheSpine]: { x: 353, y: 188, width: 116, height: 168, landscape: false },
    [RegionId.IronsEnd]: { x: 828, y: 116, width: 117, height: 170, landscape: false },
    [RegionId.GoldValley]: { x: 1225, y: 89, width: 170, height: 118, landscape: true },
    [RegionId.Southport]: { x: 362, y: 856, width: 116, height: 170, landscape: false },
    [RegionId.Riverwood]: { x: 819, y: 1285, width: 167, height: 115, landscape: true },
    [RegionId.ManorsGate]: { x: 1108, y: 1075, width: 117, height: 167, landscape: false }
}

export const ScourgeCardWidth = 106
export const ScourgeCardHeight = 150
export const ScourgeSplayStep = 30
