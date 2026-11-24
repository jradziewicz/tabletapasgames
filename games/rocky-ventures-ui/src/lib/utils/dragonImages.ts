import { Images } from '$lib/images/dragon/index.js'
import { WeaponTokenKind } from '@tabletop/rocky-ventures'

// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const dragonImagesByName: Record<string, string> = Images

export const DragonTrackerImageUrl = dragonImagesByName['tracker']
export const DragonTileImageUrl = dragonImagesByName['dragon']

// Games from 2026-11-24 print the mine bonus as Gain Mine.
let gainMineArt = false

export function setGainMineArt(on: boolean) {
    gainMineArt = on
}

// Newer games print a "$3" swap on every bonus token, and the gold bonus is the free level 2 claim.
export function weaponTokenImageUrl(kind: WeaponTokenKind, cashTokens?: boolean): string | undefined {
    if (cashTokens) {
        if (kind === WeaponTokenKind.BonusGold) return dragonImagesByName[gainMineArt ? 'bonusGainMine' : 'bonusClaim']
        const cash = dragonImagesByName[`${kind}Cash`]
        if (cash) return cash
    }
    return dragonImagesByName[kind]
}

// Where the six dragon-head slots sit on tracker.png (551 x 633).
export const DragonTrackerSize = { width: 551, height: 633 }
export const DragonTrackerSlots = [
    { x: 273, y: 147 },
    { x: 426, y: 235 },
    { x: 421, y: 402 },
    { x: 278, y: 489 },
    { x: 124, y: 399 },
    { x: 130, y: 230 }
]
