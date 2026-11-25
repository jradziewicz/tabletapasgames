import { Images } from '$lib/images/scourges/index.js'
// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const scourgeImagesById: Record<string, string> = Images

// Games where a hit moves the battle axe print that on the scourge cards; older games keep "2 VP".
let battleAxeArt = false

export function setBattleAxeScourgeArt(on: boolean) {
    battleAxeArt = on
}

export function scourgeImageUrl(scourgeId: string): string | undefined {
    return (battleAxeArt ? scourgeImagesById[`${scourgeId}-axe`] : undefined) ?? scourgeImagesById[scourgeId]
}
