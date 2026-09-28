// Borders & Taxes' 3 Border levels are printed on the physical board as 3 distinct nested rings
// (data/bordersTaxesBoard.ts's own top comment: "1 = teal dotted, 2 = purple dashed, 3 = green
// solid around Mega-Earth"). Shared by BorderClosedRevealOverlay.svelte and
// PayTaxesRevealOverlay.svelte so both name/color a given level the same way, rather than each
// keeping its own copy.
export interface BorderZoneDisplay {
    label: string
    color: string
}

export const BorderZoneColors: Record<number, BorderZoneDisplay> = {
    1: { label: 'Teal (Dotted)', color: '#2dd4bf' },
    2: { label: 'Purple (Dashed)', color: '#a855f7' },
    3: { label: 'Green (Solid)', color: '#3ddc84' }
}

export function borderZoneDisplay(level: number): BorderZoneDisplay {
    return BorderZoneColors[level] ?? { label: `Level ${level}`, color: '#ff6b6b' }
}
