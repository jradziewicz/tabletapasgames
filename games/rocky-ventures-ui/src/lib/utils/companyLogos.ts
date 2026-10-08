import { Images } from '$lib/images/companyLogos/index.js'
import type { CompanyId } from '@tabletop/rocky-ventures'

// Logos cropped from the share card art (scripts/generate-image-index.mjs lists them).
export function companyLogoUrl(companyId: CompanyId): string | undefined {
    return Images[companyId]
}
