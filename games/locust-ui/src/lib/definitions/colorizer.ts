import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

// Disc colours chosen to stand apart from the blue/red/yellow habitat rings on the board.
// Tailwind only emits classes it can see as literals, so every class string below is spelled out.
export const ColonyHex: Partial<Record<Color, string>> = {
    [Color.Green]: '#2f9e44',
    [Color.Yellow]: '#f5c400',
    [Color.Blue]: '#1c4fb8',
    [Color.Red]: '#c4281c'
}

export function isLightColonyColor(color?: Color): boolean {
    return color === Color.Yellow
}

export class LocustColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && ColonyHex[color]) ?? '#555555'
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Green:
                return 'bg-[#2f9e44]'
            case Color.Yellow:
                return 'bg-[#f5c400]'
            case Color.Blue:
                return 'bg-[#1c4fb8]'
            case Color.Red:
                return 'bg-[#c4281c]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Green:
                return 'border-[#2f9e44]'
            case Color.Yellow:
                return 'border-[#f5c400]'
            case Color.Blue:
                return 'border-[#1c4fb8]'
            case Color.Red:
                return 'border-[#c4281c]'
            default:
                return 'border-[#555555]'
        }
    }

    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (asPlayerColor) {
            switch (color) {
                case Color.Green:
                    return 'text-[#2f9e44]'
                case Color.Yellow:
                    return 'text-[#f5c400]'
                case Color.Blue:
                    return 'text-[#1c4fb8]'
                case Color.Red:
                    return 'text-[#c4281c]'
                default:
                    return 'text-[#555555]'
            }
        }
        return isLightColonyColor(color) ? 'text-black' : 'text-white'
    }
}
