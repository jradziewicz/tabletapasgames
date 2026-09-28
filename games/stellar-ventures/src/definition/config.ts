import * as Type from 'typebox'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export enum Difficulty {
    Friendly = 'friendly',
    Adverse = 'adverse',
    Hostile = 'hostile'
}

export enum BoardMap {
    Alpha = 'alpha',
    BordersAndTaxes = 'bordersAndTaxes'
}

export const StartingAlienMiningCapacityByDifficulty: Record<Difficulty, number> = {
    [Difficulty.Friendly]: 4,
    [Difficulty.Adverse]: 7,
    [Difficulty.Hostile]: 10
}

export type StellarVenturesGameConfig = Type.Static<typeof StellarVenturesGameConfig>
export const StellarVenturesGameConfig = Type.Object({
    difficulty: Type.Enum(Difficulty),
    useNewInvestorSetup: Type.Boolean(),
    boardMap: Type.Optional(Type.Enum(BoardMap))
})

export const StellarVenturesGameConfigOptions: GameConfigOptions = [
    {
        id: 'boardMap',
        type: ConfigOptionType.List,
        name: 'Map',
        description:
            'Alpha is the standard map. Borders & Taxes adds Borders that close as Corporations grow, Taxes paid into a Tax Box, and Amethyst Agency\'s Tax Agents power.',
        default: BoardMap.Alpha,
        options: [
            { name: 'Alpha', value: BoardMap.Alpha },
            { name: 'Borders & Taxes', value: BoardMap.BordersAndTaxes }
        ]
    },
    {
        id: 'difficulty',
        type: ConfigOptionType.List,
        name: 'Alien Difficulty',
        description:
            'Sets the Alien Corporation starting Mining Capacity: Friendly (4), Adverse (7), or Hostile (10).',
        default: Difficulty.Friendly,
        options: [
            { name: 'Friendly', value: Difficulty.Friendly },
            { name: 'Adverse', value: Difficulty.Adverse },
            { name: 'Hostile', value: Difficulty.Hostile }
        ]
    },
    {
        id: 'useNewInvestorSetup',
        type: ConfigOptionType.Boolean,
        name: 'New Investor Setup',
        description:
            'Skips the Initial Auction and assigns starting Corporation Presidents automatically, for a faster start.',
        default: false
    }
]
