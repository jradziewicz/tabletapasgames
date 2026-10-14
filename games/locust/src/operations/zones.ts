import { FinalRegion } from '../data/board.js'

const regionsBetween = (from: number, to: number): number[] => {
    const regions: number[] = []
    for (let region = Math.max(0, from); region <= Math.min(FinalRegion, to); region += 1) {
        regions.push(region)
    }
    return regions
}

// Zone Ruler offsets relative to the Active Region A.
export function killingZone(activeRegion: number): number[] {
    return regionsBetween(activeRegion - 2, activeRegion - 2)
}

export function swarmingZone(activeRegion: number): number[] {
    return regionsBetween(activeRegion - 1, activeRegion)
}

export function scoringZone(activeRegion: number): number[] {
    return regionsBetween(activeRegion - 1, activeRegion + 2)
}

export function breedingZone(activeRegion: number): number[] {
    return regionsBetween(activeRegion, FinalRegion)
}

export function majorityRegion(activeRegion: number): number {
    return activeRegion + 1
}

export function levelBoostRegion(activeRegion: number): number {
    return activeRegion + 2
}
