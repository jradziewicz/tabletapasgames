import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { corporationTurnOrderByMiningCapacity, nextDirectorPlayerId } from './administrationRound.js'

function createTestState(playerCount = 4) {
    const players: Player[] = Array.from({ length: playerCount }, (_, index) => ({
        id: `p${index + 1}`,
        isHuman: true,
        userId: `u${index + 1}`,
        name: `Player ${index + 1}`,
        status: PlayerStatus.Joined
    }))

    const game: Game = {
        id: 'game-1',
        typeId: 'stellar-ventures',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Stellar Ventures Test',
        players,
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

    return new StellarVenturesGameInitializer().initializeGameState(game, state)
}

describe('corporationTurnOrderByMiningCapacity', () => {
    it('reorders Corporations by Mining Capacity, highest first', () => {
        const state = createTestState()
        const capacities: Partial<Record<CorporationId, number>> = {
            [CorporationId.PinkInc]: 5,
            [CorporationId.FrostFederated]: 20,
            [CorporationId.ScarletSyndicate]: 10,
            [CorporationId.CeruleanCouncil]: 1,
            [CorporationId.GambogeGuild]: 15
        }
        state.board.miningCapacityForCorporation = (corporationId) => capacities[corporationId] ?? 0

        expect(corporationTurnOrderByMiningCapacity(state)).toEqual([
            CorporationId.FrostFederated,
            CorporationId.GambogeGuild,
            CorporationId.ScarletSyndicate,
            CorporationId.PinkInc,
            CorporationId.CeruleanCouncil
        ])
    })

    it('keeps tied Corporations in their existing relative order', () => {
        const state = createTestState()
        // Force every Corporation to the same Mining Capacity - a stable sort should leave
        // corporationTurnOrder completely unchanged.
        state.board.miningCapacityForCorporation = () => 10
        const before = [...state.corporationTurnOrder]

        expect(corporationTurnOrderByMiningCapacity(state)).toEqual(before)
    })

    it("factors in Ore Refinement's +3 bonus when breaking a tie", () => {
        const state = createTestState()
        state.board.miningCapacityForCorporation = () => 10
        // Every Corporation ties at 10 except PinkInc, which is last in turn order but gets
        // bumped ahead of everyone by Ore Refinement's +3.
        state.getCorporation(CorporationId.PinkInc).powers.push({ id: CorporatePowerId.OreRefinement })
        const pinkIncIndex = state.corporationTurnOrder.indexOf(CorporationId.PinkInc)
        expect(corporationTurnOrderByMiningCapacity(state)[0]).toBe(CorporationId.PinkInc)
        expect(pinkIncIndex).toBeGreaterThanOrEqual(0)
    })
})

describe('nextDirectorPlayerId', () => {
    it('returns the next player clockwise, wrapping around after the last player', () => {
        const state = createTestState()
        const [p1, p2, , p4] = state.turnManager.turnOrder

        state.directorPlayerId = p1!
        expect(nextDirectorPlayerId(state)).toBe(p2)

        state.directorPlayerId = p4!
        expect(nextDirectorPlayerId(state)).toBe(p1)
    })
})
