export enum RegionId {
    GoldValley = 'goldValley',
    IronsEnd = 'ironsEnd',
    TheSpine = 'theSpine',
    ManorsGate = 'manorsGate',
    Riverwood = 'riverwood',
    Southport = 'southport'
}

export const RegionIds: RegionId[] = [
    RegionId.GoldValley,
    RegionId.IronsEnd,
    RegionId.TheSpine,
    RegionId.ManorsGate,
    RegionId.Riverwood,
    RegionId.Southport
]

export const RegionNames: Record<RegionId, string> = {
    [RegionId.GoldValley]: 'Gold Valley',
    [RegionId.IronsEnd]: "Iron's End",
    [RegionId.TheSpine]: 'The Spine',
    [RegionId.ManorsGate]: "Manor's Gate",
    [RegionId.Riverwood]: 'Riverwood',
    [RegionId.Southport]: 'Southport'
}

export const NorthernRegionIds: RegionId[] = [
    RegionId.GoldValley,
    RegionId.IronsEnd,
    RegionId.TheSpine
]

export const SouthernRegionIds: RegionId[] = [
    RegionId.ManorsGate,
    RegionId.Riverwood,
    RegionId.Southport
]
