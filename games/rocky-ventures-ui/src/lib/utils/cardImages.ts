const cardImageModules = import.meta.glob<string>('$lib/images/cards/*.png', {
    eager: true,
    query: '?url',
    import: 'default'
})

const cardImagesById: Record<string, string> = Object.fromEntries(
    Object.entries(cardImageModules).map(([path, url]) => [
        path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, ''),
        url
    ])
)

export function cardImageUrl(cardId: string): string | undefined {
    return cardImagesById[cardId]
}

export function cardBackImageUrl(decade: number): string | undefined {
    return cardImagesById[`back-decade${decade}`]
}
