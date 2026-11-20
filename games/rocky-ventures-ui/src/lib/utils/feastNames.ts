import { FeastCategoriesById } from '@tabletop/rocky-ventures'

// The End of Era cards are called Feast cards at the table (2026-11-09).
export const FeastNames: Record<number, string> = {
    1: 'The Lantern Feast',
    2: 'The Feast of the Deep Seam',
    3: 'The Golden Table'
}

// Newer games draw one of three Feasts per card at setup (2026-11-20): card id -> Feast id.
let feastCategories: Record<string, string> | undefined

export function setFeastCategories(categories: Record<string, string> | undefined) {
    feastCategories = categories
}

export function feastName(era: number): string {
    const category = feastCategories?.[`era${era}`]
    return (category ? FeastCategoriesById[category]?.name : undefined) ?? FeastNames[era] ?? `Feast ${era}`
}
