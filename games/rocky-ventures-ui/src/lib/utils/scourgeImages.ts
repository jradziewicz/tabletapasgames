const scourgeImageModules = import.meta.glob<string>('$lib/images/scourges/*.png', {
    eager: true,
    query: '?url',
    import: 'default'
})

const scourgeImagesById: Record<string, string> = Object.fromEntries(
    Object.entries(scourgeImageModules).map(([path, url]) => [
        path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, ''),
        url
    ])
)

export function scourgeImageUrl(scourgeId: string): string | undefined {
    return scourgeImagesById[scourgeId]
}
