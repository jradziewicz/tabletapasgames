import type { Point } from '@tabletop/common'
import { BoardNodes, RegionId, RegionIds } from '@tabletop/rocky-ventures'
import { ScourgeBoxes } from './scourgeBoxLayout.js'

export interface RegionRun {
    x: number
    y: number
    width: number
    height: number
}

export const RegionMapBounds = { x: 300, y: 50, width: 1260, height: 1390 }
const CellSize = 14

const anchors: { region: RegionId; x: number; y: number }[] = [
    ...BoardNodes.map((node) => ({ region: node.region, x: node.x, y: node.y })),
    ...RegionIds.map((region) => {
        const box = ScourgeBoxes[region]
        return { region, x: box.x + box.width / 2, y: box.y + box.height / 2 }
    })
]

export function regionAt(point: Point): RegionId | undefined {
    const bounds = RegionMapBounds
    if (
        point.x < bounds.x ||
        point.y < bounds.y ||
        point.x > bounds.x + bounds.width ||
        point.y > bounds.y + bounds.height
    ) {
        return undefined
    }
    let best: RegionId | undefined
    let bestDistance = Infinity
    for (const anchor of anchors) {
        const distance = (anchor.x - point.x) ** 2 + (anchor.y - point.y) ** 2
        if (distance < bestDistance) {
            bestDistance = distance
            best = anchor.region
        }
    }
    return best
}

function buildRuns(): Record<RegionId, RegionRun[]> {
    const runs: Record<RegionId, RegionRun[]> = {
        [RegionId.GoldValley]: [],
        [RegionId.IronsEnd]: [],
        [RegionId.TheSpine]: [],
        [RegionId.ManorsGate]: [],
        [RegionId.Riverwood]: [],
        [RegionId.Southport]: []
    }
    const bounds = RegionMapBounds
    for (let y = bounds.y; y < bounds.y + bounds.height; y += CellSize) {
        let runStart = bounds.x
        let runRegion = regionAt({ x: bounds.x + CellSize / 2, y: y + CellSize / 2 })
        for (let x = bounds.x + CellSize; x <= bounds.x + bounds.width; x += CellSize) {
            const region = x < bounds.x + bounds.width ? regionAt({ x: x + CellSize / 2, y: y + CellSize / 2 }) : undefined
            if (region !== runRegion) {
                if (runRegion) {
                    runs[runRegion].push({ x: runStart, y, width: x - runStart, height: CellSize })
                }
                runStart = x
                runRegion = region
            }
        }
    }
    return runs
}

export const RegionRuns = buildRuns()

export function regionLabelPoint(region: RegionId): Point {
    const box = ScourgeBoxes[region]
    return { x: box.x + box.width / 2, y: box.y + box.height + 34 }
}
