import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

// Real palette, re-picked directly from the co-designer's own SV_PLAYER_MARKERS_TOKENS_FINAL.pdf
// player-token art (see playerSymbolDisplay.ts and runtime.ts's matching PlayerColorPalette,
// which must be kept in sync with the hex values below by hand). Stellar Ventures uses 5 of the 7
// shared Color values - see definition/colors.ts in the logic package.
export class StellarVenturesColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.Green:
                return '#c8d530'
            case Color.Yellow:
                return '#dd6b15'
            case Color.Blue:
                return '#4ab171'
            case Color.Red:
                return '#0069a9'
            case Color.Black:
                return '#b81a5d'
            default:
                return '#555555'
        }
    }

    override getBgColor(color?: string): string {
        switch (color) {
            case Color.Green:
                return 'bg-[#c8d530]'
            case Color.Yellow:
                return 'bg-[#dd6b15]'
            case Color.Blue:
                return 'bg-[#4ab171]'
            case Color.Red:
                return 'bg-[#0069a9]'
            case Color.Black:
                return 'bg-[#b81a5d]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: string): string {
        switch (color) {
            case Color.Green:
                return 'border-[#c8d530]'
            case Color.Yellow:
                return 'border-[#dd6b15]'
            case Color.Blue:
                return 'border-[#4ab171]'
            case Color.Red:
                return 'border-[#0069a9]'
            case Color.Black:
                return 'border-[#b81a5d]'
            default:
                return 'border-[#555555]'
        }
    }
}
