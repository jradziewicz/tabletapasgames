import { describe, expect, it } from 'vitest'
import { HydratedStellarVenturesGameState } from './gameState.js'
import { HexType } from './board.js'
import { CorporationId } from './corporation.js'
import { BoardMap } from '../definition/config.js'
import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type UninitializedGameState
} from '@tabletop/common'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import type { StellarVenturesGameState } from './gameState.js'

function createTestGameState(): StellarVenturesGameState {
    const game: Game = {
        id: 'game-1',
        typeId: 'stellar-ventures',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Stellar Ventures Test',
        players: [1, 2, 3].map((n) => ({
            id: `p${n}`,
            isHuman: true,
            userId: `u${n}`,
            name: `Player ${n}`,
            status: PlayerStatus.Joined
        })),
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }
    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }
    const initial = new StellarVenturesGameInitializer().initializeGameState(game, state)
    return JSON.parse(JSON.stringify(initial)) as StellarVenturesGameState
}

describe('Alpha map hexes saved before the 2026-10-28 fix', () => {
    it('loads -1,10 as Deep Space and 0,10 as a value-2 planet, keeping Outposts', () => {
        const data = createTestGameState()
        data.board.hexes['-1,10'] = {
            ...data.board.hexes['-1,10'],
            type: HexType.NeutralPlanet,
            baseValue: 2,
            outposts: [CorporationId.FrostFederated]
        }
        data.board.hexes['0,10'] = {
            ...data.board.hexes['0,10'],
            type: HexType.NeutralPlanet,
            baseValue: 1,
            outposts: [CorporationId.FrostFederated]
        }

        const state = new HydratedStellarVenturesGameState(data)

        expect(state.board.hexes['-1,10'].type).toBe(HexType.DeepSpace)
        expect(state.board.hexes['-1,10'].baseValue).toBeUndefined()
        expect(state.board.hexes['-1,10'].outposts).toEqual([CorporationId.FrostFederated])
        expect(state.board.hexes['0,10'].baseValue).toBe(2)
        expect(state.board.miningValueForHex(state.board.hexes['0,10'])).toBe(2)
        expect(state.board.miningValueForHex(state.board.hexes['-1,10'])).toBe(0)
    })

    it('leaves the Borders & Taxes map alone', () => {
        const data = createTestGameState()
        data.boardMap = BoardMap.BordersAndTaxes
        data.board.hexes['0,10'] = { ...data.board.hexes['0,10'], type: HexType.NeutralPlanet, baseValue: 1 }
        const state = new HydratedStellarVenturesGameState(data)
        expect(state.board.hexes['0,10'].baseValue).toBe(1)
    })
})
