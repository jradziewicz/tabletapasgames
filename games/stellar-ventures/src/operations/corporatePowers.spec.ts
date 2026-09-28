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
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import {
    CORPORATE_POWER_DRAW_PILE_COUNT,
    INITIAL_AVAILABLE_CORPORATE_POWER_COUNT,
    NeutralCorporatePowerIds,
    OreRefinementBonus,
    effectiveMiningCapacityForCorporation
} from './corporatePowers.js'

function createTestGameState(playerCount = 4) {
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

describe('NeutralCorporatePowerIds', () => {
    it('has exactly the 18 physical Neutral Corporate Power tiles, no duplicates', () => {
        expect(NeutralCorporatePowerIds).toHaveLength(18)
        expect(new Set(NeutralCorporatePowerIds).size).toBe(18)
    })

    it('excludes the Starting Powers, which are never drafted from the Neutral pool', () => {
        expect(NeutralCorporatePowerIds).not.toContain(CorporatePowerId.AlienExplorers)
        expect(NeutralCorporatePowerIds).not.toContain(CorporatePowerId.SecretAgents)
    })

    it('uses only 11 of the 18 tiles in any given game, leaving 7 out entirely', () => {
        expect(INITIAL_AVAILABLE_CORPORATE_POWER_COUNT + CORPORATE_POWER_DRAW_PILE_COUNT).toBe(11)
        expect(NeutralCorporatePowerIds.length - 11).toBe(7)
    })
})

describe('effectiveMiningCapacityForCorporation (Ore Refinement)', () => {
    it('matches the raw board value without Ore Refinement active', () => {
        const state = createTestGameState()
        const corporationId = CorporationId.PinkInc
        const base = state.board.miningCapacityForCorporation(corporationId)
        expect(effectiveMiningCapacityForCorporation(state, corporationId)).toBe(base)
    })

    it('adds the +3 bonus once Ore Refinement is active', () => {
        const state = createTestGameState()
        const corporationId = CorporationId.PinkInc
        state.getCorporation(corporationId).powers.push({ id: CorporatePowerId.OreRefinement })
        const base = state.board.miningCapacityForCorporation(corporationId)
        expect(effectiveMiningCapacityForCorporation(state, corporationId)).toBe(base + OreRefinementBonus)
    })
})
