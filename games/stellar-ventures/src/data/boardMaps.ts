import { BoardMap } from '../definition/config.js'
import { Hex } from '../model/board.js'
import { AlphaBoardHexes, MegaEarthValueTrack } from './alphaBoard.js'
import { BordersTaxesBoardHexes, MiniEarthValueTrack } from './bordersTaxesBoard.js'

export interface BorderDefinition {
    level: number
    activationMiningCapacity: number
    tax: number
}

export interface BoardMapDefinition {
    hexes: Hex[]
    megaEarthValueTrack: number[]
    miniEarthValueTrack?: number[]
    borders: BorderDefinition[]
}

export const BoardMapDefinitions: Record<BoardMap, BoardMapDefinition> = {
    [BoardMap.Alpha]: {
        hexes: AlphaBoardHexes,
        megaEarthValueTrack: MegaEarthValueTrack,
        borders: []
    },
    [BoardMap.BordersAndTaxes]: {
        hexes: BordersTaxesBoardHexes,
        megaEarthValueTrack: MegaEarthValueTrack,
        miniEarthValueTrack: MiniEarthValueTrack,
        borders: [
            { level: 1, activationMiningCapacity: 10, tax: 2 },
            { level: 2, activationMiningCapacity: 20, tax: 3 },
            { level: 3, activationMiningCapacity: 30, tax: 4 }
        ]
    }
}
