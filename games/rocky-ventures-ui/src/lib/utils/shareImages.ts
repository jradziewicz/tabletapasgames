import type { CompanyId } from '@tabletop/rocky-ventures'

const shareImageModules = import.meta.glob<string>('$lib/images/shares/*.png', {
    eager: true,
    query: '?url',
    import: 'default'
})

const shareImagesByName: Record<string, string> = Object.fromEntries(
    Object.entries(shareImageModules).map(([path, url]) => [
        path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, ''),
        url
    ])
)

// shareIndex is 0-based (share 1 is index 0). Flipped backs only exist for shares 1-3.
export function shareImageUrl(companyId: CompanyId, shareIndex: number, flipped: boolean): string | undefined {
    const name = `${companyId}${shareIndex + 1}${flipped && shareIndex < 3 ? '-back' : ''}`
    return shareImagesByName[name]
}
