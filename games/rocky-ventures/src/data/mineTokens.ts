import * as Type from 'typebox'

export enum OreKind {
    Gold = 'gold',
    Silver = 'silver'
}

export enum MineTier {
    A = 'A',
    B = 'B'
}

export type MineToken = Type.Static<typeof MineToken>
export const MineToken = Type.Object({
    id: Type.String(),
    ore: Type.Enum(OreKind),
    tier: Type.Enum(MineTier),
    level: Type.Number(),
    scourge: Type.Boolean()
})

interface TokenSpec {
    level: number
    count: number
    scourge?: boolean
}

function buildTokens(ore: OreKind, tier: MineTier, specs: TokenSpec[]): MineToken[] {
    const tokens: MineToken[] = []
    for (const spec of specs) {
        for (let index = 0; index < spec.count; index += 1) {
            const scourge = spec.scourge ?? false
            tokens.push({
                id: `${ore}${tier}${spec.level}${scourge ? 's' : ''}-${index + 1}`,
                ore,
                tier,
                level: spec.level,
                scourge
            })
        }
    }
    return tokens
}

// Transcribed from RV-v043b Tokens-Front. One gold token per gold mine site: Gold A 17 for the 17 A
// cities, Gold B 13 for the 13 B sites (including Dornoch-Dur's fixed level 5). The two Gold A
// level-3 scourge tokens use the level-3 scourge face art (Justin, 2026-09-29).
export const GoldATokens: MineToken[] = buildTokens(OreKind.Gold, MineTier.A, [
    { level: 2, count: 10 },
    { level: 3, count: 5 },
    { level: 3, count: 2, scourge: true }
])

export const GoldBTokens: MineToken[] = buildTokens(OreKind.Gold, MineTier.B, [
    { level: 3, count: 3 },
    { level: 4, count: 4 },
    { level: 4, count: 2, scourge: true },
    { level: 5, count: 2 },
    { level: 5, count: 2, scourge: true }
])

export const SilverATokens: MineToken[] = buildTokens(OreKind.Silver, MineTier.A, [
    { level: 2, count: 4 },
    { level: 2, count: 4, scourge: true },
    { level: 3, count: 4 },
    { level: 3, count: 5, scourge: true }
])

export const SilverBTokens: MineToken[] = buildTokens(OreKind.Silver, MineTier.B, [
    { level: 3, count: 3 },
    { level: 4, count: 6 },
    { level: 5, count: 4 }
])

export const RedRestrictedMineLevel = 4
export const BlueRestrictedMineLevel = 5

export const AllMineTokens: MineToken[] = [
    ...GoldATokens,
    ...GoldBTokens,
    ...SilverATokens,
    ...SilverBTokens
]

export const MineTokensById: Record<string, MineToken> = Object.fromEntries(
    AllMineTokens.map((token) => [token.id, token])
)
