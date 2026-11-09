import * as Type from 'typebox'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type RockyVenturesGameConfig = Type.Static<typeof RockyVenturesGameConfig>
export const RockyVenturesGameConfig = Type.Object({
    hunterBots: Type.Optional(Type.String()),
    taxBots: Type.Optional(Type.String()),
    livePlay: Type.Optional(Type.Boolean())
})

const BotCountChoices = ['0', '1', '2', '3', '4'].map((value) => ({ name: value, value }))

export const RockyVenturesGameConfigOptions: GameConfigOptions = [
    {
        id: 'hunterBots',
        type: ConfigOptionType.List,
        name: 'Hunter bots',
        description: 'Bots take the last seats.',
        default: '0',
        options: BotCountChoices
    },
    {
        id: 'taxBots',
        type: ConfigOptionType.List,
        name: 'Tax bots',
        description: 'Bots take the last seats.',
        default: '0',
        options: BotCountChoices
    },
    {
        id: 'livePlay',
        type: ConfigOptionType.Boolean,
        name: 'Live play',
        description: 'Everyone sees what the current player selects as they click.',
        default: false
    }
]
