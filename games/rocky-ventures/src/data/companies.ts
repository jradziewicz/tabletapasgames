export enum CompanyId {
    WizardCannonball = 'wc',
    DwarvenPacific = 'dp',
    GoblinCentral = 'gcr',
    WingedWyrm = 'wwr'
}

export const CompanyIds: CompanyId[] = [
    CompanyId.WizardCannonball,
    CompanyId.DwarvenPacific,
    CompanyId.GoblinCentral,
    CompanyId.WingedWyrm
]

export const CompanyNames: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: 'Wizard Cannonball',
    [CompanyId.DwarvenPacific]: 'Dwarven Pacific',
    [CompanyId.GoblinCentral]: 'Goblin Central RR',
    [CompanyId.WingedWyrm]: 'Winged Wyrm RR'
}

export const CompanyAbbreviations: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: 'WC',
    [CompanyId.DwarvenPacific]: 'DP',
    [CompanyId.GoblinCentral]: 'GCR',
    [CompanyId.WingedWyrm]: 'WWR'
}

// Company board value slots, bottom to top. The "1" slot is the cube already on the map at setup;
// the other 15 slots are covered by cubes and each cube laid uncovers the next value (Justin,
// 2026-09-28; transcribed from the v0.50 board).
export const TrackValueByCubeCount: number[] = [1, 2, 3, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 9, 10]

export const MaxCubesPerCompany = TrackValueByCubeCount.length

export const MaxDeliveriesPerCompany = 10

// The 17th cube sits on the company board's "+5" box at setup and is the cube used for the special
// Dornoch-Dur connection box; laying it does not advance the value track (Justin, 2026-09-28).
export const DornochDurConnectionBonus = 5

// Shares are stacked 1 on top and taken in order. Buying share 4 flips shares 1-3 to their back
// side, which lowers their multipliers (Justin, 2026-09-28).
export const ShareMultipliers: number[] = [4, 3, 3, 2, 1]
export const FlippedShareMultipliers: number[] = [3, 2, 2, 2, 1]
export const ShareFlipTriggerIndex = 3
export const SharesPerCompany = ShareMultipliers.length
