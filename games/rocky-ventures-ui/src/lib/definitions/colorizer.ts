import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

// Player colours sampled from the v0.40 player card headers (yellow, purple, white, green, red).
// Tailwind only emits classes it can see as literals, so every class string below is spelled out.
export const PlayerColorHex: Partial<Record<Color, string>> = {
    [Color.Yellow]: '#d9d24a',
    [Color.Purple]: '#8a2fc9',
    [Color.White]: '#f5f2dc',
    [Color.Green]: '#5cb85c',
    [Color.Red]: '#c9302c'
}

export function isLightPlayerColor(color?: Color): boolean {
    return color === Color.Yellow || color === Color.White
}

export class RockyVenturesColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && PlayerColorHex[color]) ?? '#555555'
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Yellow:
                return 'bg-[#d9d24a]'
            case Color.Purple:
                return 'bg-[#8a2fc9]'
            case Color.White:
                return 'bg-[#f5f2dc]'
            case Color.Green:
                return 'bg-[#5cb85c]'
            case Color.Red:
                return 'bg-[#c9302c]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Yellow:
                return 'border-[#d9d24a]'
            case Color.Purple:
                return 'border-[#8a2fc9]'
            case Color.White:
                return 'border-[#f5f2dc]'
            case Color.Green:
                return 'border-[#5cb85c]'
            case Color.Red:
                return 'border-[#c9302c]'
            default:
                return 'border-[#555555]'
        }
    }

    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (asPlayerColor) {
            switch (color) {
                case Color.Yellow:
                    return 'text-[#d9d24a]'
                case Color.Purple:
                    return 'text-[#8a2fc9]'
                case Color.White:
                    return 'text-[#f5f2dc]'
                case Color.Green:
                    return 'text-[#5cb85c]'
                case Color.Red:
                    return 'text-[#c9302c]'
                default:
                    return 'text-[#555555]'
            }
        }
        return isLightPlayerColor(color) ? 'text-black' : 'text-white'
    }
}
