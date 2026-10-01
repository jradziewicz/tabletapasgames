import { Images } from '$lib/images/shares/index.js'
import type { CompanyId } from '@tabletop/rocky-ventures'

// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const shareImagesByName: Record<string, string> = Images

// shareIndex is 0-based (share 1 is index 0). Flipped backs only exist for shares 1-3.
export function shareImageUrl(companyId: CompanyId, shareIndex: number, flipped: boolean): string | undefined {
    const name = `${companyId}${shareIndex + 1}${flipped && shareIndex < 3 ? '-back' : ''}`
    return shareImagesByName[name]
}
