import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

// Player colours sampled from the printed starter card banners. The platform's Green and Red
// seats show as the cards' teal and pink.
// Tailwind only emits classes it can see as literals, so every class string below is spelled out.
export const PlayerColorHex: Partial<Record<Color, string>> = {
    [Color.Yellow]: '#fab220',
    [Color.Purple]: '#5c3079',
    [Color.White]: '#f1eeec',
    [Color.Green]: '#66ccce',
    [Color.Red]: '#f580c5'
}

export function isLightPlayerColor(color?: Color): boolean {
    return color !== undefined && color !== Color.Purple
}

export class RockyVenturesColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && PlayerColorHex[color]) ?? '#555555'
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Yellow:
                return 'bg-[#fab220]'
            case Color.Purple:
                return 'bg-[#5c3079]'
            case Color.White:
                return 'bg-[#f1eeec]'
            case Color.Green:
                return 'bg-[#66ccce]'
            case Color.Red:
                return 'bg-[#f580c5]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Yellow:
                return 'border-[#fab220]'
            case Color.Purple:
                return 'border-[#5c3079]'
            case Color.White:
                return 'border-[#f1eeec]'
            case Color.Green:
                return 'border-[#66ccce]'
            case Color.Red:
                return 'border-[#f580c5]'
            default:
                return 'border-[#555555]'
        }
    }

    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (asPlayerColor) {
            switch (color) {
                case Color.Yellow:
                    return 'text-[#fab220]'
                case Color.Purple:
                    return 'text-[#5c3079]'
                case Color.White:
                    return 'text-[#f1eeec]'
                case Color.Green:
                    return 'text-[#66ccce]'
                case Color.Red:
                    return 'text-[#f580c5]'
                default:
                    return 'text-[#555555]'
            }
        }
        return isLightPlayerColor(color) ? 'text-black' : 'text-white'
    }
}
