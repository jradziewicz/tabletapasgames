import { describe, expect, it } from 'vitest'
import { BoardState, HexType, HydratedBoardState } from './board.js'
import { CorporationId } from './corporation.js'
import { AlphaBoardHexes } from '../data/alphaBoard.js'

// Mega-Earth's art spans 3 physical hexes on the Alpha map (11,8 / 12,8 / 11,9), which count
// as ONE hex for every rule.
function alphaBoard(): HydratedBoardState {
    const board: BoardState = {
        hexes: Object.fromEntries(
            structuredClone(AlphaBoardHexes).map((hex) => [hex.id, { ...hex, outposts: [] }])
        ),
        megaEarth: { valueTrack: [6, 9, 12, 15], fillOrder: [] }
    }
    return new HydratedBoardState(board)
}

const MEGA = ['11,8', '12,8', '11,9']

describe('Mega-Earth as one hex', () => {
    it('lets a Corporation on Mega-Earth expand next to ANY of its 3 spaces', () => {
        const board = alphaBoard()
        board.buildOutpost('11,8', CorporationId.PinkInc)
        // 13,7 only touches 12,8 and 10,10 only touches 11,9 - neither touches 11,8, where the
        // Outpost physically sits.
        expect(board.isAdjacent('11,8', '13,7')).toBe(true)
        expect(board.isAdjacentToOutpost('13,7', CorporationId.PinkInc)).toBe(true)
        expect(board.isAdjacentToOutpost('10,10', CorporationId.PinkInc)).toBe(true)
    })

    it('lets a Corporation reach Mega-Earth from next to any one of its spaces', () => {
        const board = alphaBoard()
        // 13,7 only physically touches 12,8.
        board.buildOutpost('13,7', CorporationId.PinkInc)
        for (const id of MEGA) {
            expect(board.isAdjacentToOutpost(id, CorporationId.PinkInc)).toBe(true)
        }
    })

    it('measures Wormhole distance from the nearest of its spaces', () => {
        const board = alphaBoard()
        // Outpost on 12,8; 10,10 is next to 11,9 (another Mega-Earth space), so it's 1 away.
        board.buildOutpost('12,8', CorporationId.PinkInc)
        expect(board.distanceToNearestOutpost('10,10', CorporationId.PinkInc)).toBe(1)
    })

    it('never treats its own spaces as neighbours of each other', () => {
        const board = alphaBoard()
        expect(board.isAdjacent('11,8', '12,8')).toBe(false)
        expect(board.getHex('11,8')?.type).toBe(HexType.MegaEarth)
    })
})
