import { MineTier, OreKind, type MineToken } from '@tabletop/rocky-ventures'

const tokenImageModules = import.meta.glob<string>('$lib/images/tokens/*.png', {
    eager: true,
    query: '?url',
    import: 'default'
})

const tokenImagesByName: Record<string, string> = Object.fromEntries(
    Object.entries(tokenImageModules).map(([path, url]) => [
        path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, ''),
        url
    ])
)

// Token faces are identical for tiers A and B; only the back shows the tier.
export function mineTokenImageUrl(token: MineToken): string | undefined {
    return tokenImagesByName[`${token.ore}${token.level}${token.scourge ? 's' : ''}`]
}

export function mineTokenBackImageUrl(ore: OreKind, tier: MineTier): string | undefined {
    return tokenImagesByName[`${ore}Back${tier}`]
}
