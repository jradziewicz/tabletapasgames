import { Images } from '$lib/images/playerCards/index.js'
import { Color } from '@tabletop/common'

// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const playerCardImagesByName: Record<string, string> = Images

const PrintedCardColors: Partial<Record<Color, string>> = {
    [Color.Yellow]: 'yellow',
    [Color.Purple]: 'purple',
    [Color.White]: 'white',
    [Color.Green]: 'green',
    [Color.Red]: 'red'
}

// Player cards p1-p5 are printed in each of the five player colours; other preferred colours
// fall back to the green set.
export function playerCardImageUrl(cardId: string, color?: Color): string | undefined {
    const printedColor = (color && PrintedCardColors[color]) ?? 'green'
    return playerCardImagesByName[`${printedColor}-${cardId}`]
}
