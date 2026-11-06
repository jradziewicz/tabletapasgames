import { Images } from '$lib/images/cards/index.js'
// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const cardImagesById: Record<string, string> = Images

// Games on the revised card actions show the matching art; older games keep the art they play by.
let revisedCardArt = false

export function setRevisedCardArt(revised: boolean) {
    revisedCardArt = revised
}

export function cardImageUrl(cardId: string): string | undefined {
    return (revisedCardArt ? cardImagesById[`${cardId}-revised`] : undefined) ?? cardImagesById[cardId]
}

export function cardBackImageUrl(decade: number): string | undefined {
    return cardImagesById[`back-decade${decade}`]
}
