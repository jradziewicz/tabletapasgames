import { Color } from '@tabletop/common'

const playerCardModules = import.meta.glob<string>('$lib/images/playerCards/*.png', {
    eager: true,
    query: '?url',
    import: 'default'
})

const playerCardImagesByName: Record<string, string> = Object.fromEntries(
    Object.entries(playerCardModules).map(([path, url]) => [
        path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, ''),
        url
    ])
)

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
