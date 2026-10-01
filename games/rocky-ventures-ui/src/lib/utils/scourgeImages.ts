import { Images } from '$lib/images/scourges/index.js'
// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const scourgeImagesById: Record<string, string> = Images

export function scourgeImageUrl(scourgeId: string): string | undefined {
    return scourgeImagesById[scourgeId]
}
