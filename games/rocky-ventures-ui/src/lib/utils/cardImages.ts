import { Images } from '$lib/images/cards/index.js'
// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const cardImagesById: Record<string, string> = Images

// Games on the revised card actions show the matching art; older games keep the art they play by.
let revisedCardArt = false

export function setRevisedCardArt(revised: boolean) {
    revisedCardArt = revised
}

// Games on the 2026-11-24 card list show cards 15 and 19 with their hunt.
let trackAndHuntArt = false

export function setTrackAndHuntArt(on: boolean) {
    trackAndHuntArt = on
}

// Games with the Feast buyer bonus show Feast cards that print the bonus.
let feastBonusArt = false

export function setFeastBonusArt(on: boolean) {
    feastBonusArt = on
}

// Newer games draw one of three Feasts per card; each has its own card art (card id -> Feast id).
let feastCategories: Record<string, string> | undefined

export function setFeastCardCategories(categories: Record<string, string> | undefined) {
    feastCategories = categories
}

// Games where Feasts have a base cost print it on those cards: the final Feast, and in newer games
// the first two as well. Takes the card ids whose art prints a cost.
let feastCostArt: string[] = []

export function setFeastCostArt(cardIds: string[]) {
    feastCostArt = cardIds
}

// Games where Feasts cost a multiple of their slot price print 2x, 3x or 4x on them.
let feastMultipleArt = false

export function setFeastMultipleArt(on: boolean) {
    feastMultipleArt = on
}

export function cardImageUrl(cardId: string): string | undefined {
    const category = feastCategories?.[cardId]
    return (
        (category && feastMultipleArt ? cardImagesById[`feast-${category}-mult`] : undefined) ??
        (category && feastCostArt.includes(cardId) ? cardImagesById[`feast-${category}-cost`] : undefined) ??
        (category ? cardImagesById[`feast-${category}`] : undefined) ??
        (feastBonusArt ? cardImagesById[`${cardId}-bonus`] : undefined) ??
        (trackAndHuntArt ? cardImagesById[`${cardId}-hunt`] : undefined) ??
        (revisedCardArt ? cardImagesById[`${cardId}-revised`] : undefined) ??
        cardImagesById[cardId]
    )
}

export function cardBackImageUrl(decade: number): string | undefined {
    return cardImagesById[`back-decade${decade}`]
}
