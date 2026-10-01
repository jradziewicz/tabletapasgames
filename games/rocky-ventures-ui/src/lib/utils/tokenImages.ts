import { Images } from '$lib/images/tokens/index.js'
import { MineTier, OreKind, type MineToken } from '@tabletop/rocky-ventures'

// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const tokenImagesByName: Record<string, string> = Images

// Token faces are identical for tiers A and B; only the back shows the tier.
export function mineTokenImageUrl(token: MineToken): string | undefined {
    return tokenImagesByName[`${token.ore}${token.level}${token.scourge ? 's' : ''}`]
}

export function mineTokenBackImageUrl(ore: OreKind, tier: MineTier): string | undefined {
    return tokenImagesByName[`${ore}Back${tier}`]
}
