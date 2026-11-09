// The End of Era cards are called Feast cards at the table (2026-11-09).
export const FeastNames: Record<number, string> = {
    1: 'The Lantern Feast',
    2: 'The Feast of the Deep Seam',
    3: 'The Golden Table'
}

export function feastName(era: number): string {
    return FeastNames[era] ?? `Feast ${era}`
}
