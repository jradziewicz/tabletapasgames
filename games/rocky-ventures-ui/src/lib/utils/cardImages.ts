import { Images } from '$lib/images/cards/index.js'
// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const cardImagesById: Record<string, string> = Images

// Games on the revised card actions show the matching art; older games keep the art they play by.
let revisedCardArt = false

export function setRevisedCardArt(revised: boolean) {
    revisedCardArt = revised
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

export function cardImageUrl(cardId: string): string | undefined {
    const category = feastCategories?.[cardId]
    return (
        (category ? cardImagesById[`feast-${category}`] : undefined) ??
        (feastBonusArt ? cardImagesById[`${cardId}-bonus`] : undefined) ??
        (revisedCardArt ? cardImagesById[`${cardId}-revised`] : undefined) ??
        cardImagesById[cardId]
    )
}

export function cardBackImageUrl(decade: number): string | undefined {
    return cardImagesById[`back-decade${decade}`]
}
