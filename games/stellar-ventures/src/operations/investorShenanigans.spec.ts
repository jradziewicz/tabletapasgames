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
import { AlienTechActionId, InvestorActionId } from '../model/investorBoard.js'
import {
    canSelectAlienTechActionId,
    canSelectInvestorActionId,
    nextInvestorShenanigansPlayerId
} from './investorShenanigans.js'

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

describe('nextInvestorShenanigansPlayerId', () => {
    it('returns the next player in the (non-wrapping) player order, or undefined once done', () => {
        const playerOrder = ['p1', 'p2', 'p3']
        expect(nextInvestorShenanigansPlayerId(playerOrder, 'p1')).toBe('p2')
        expect(nextInvestorShenanigansPlayerId(playerOrder, 'p2')).toBe('p3')
        expect(nextInvestorShenanigansPlayerId(playerOrder, 'p3')).toBeUndefined()
    })
})

describe('canSelectInvestorActionId', () => {
    it('allows any Investor Action when the disc is off the board (never used, or just passed)', () => {
        const state = createTestState()
        expect(canSelectInvestorActionId(state, 'p1', InvestorActionId.BlackMarket)).toBe(true)
        expect(canSelectInvestorActionId(state, 'p1', InvestorActionId.JerryRig)).toBe(true)
    })

    it('disallows only the specific action the disc currently sits on', () => {
        const state = createTestState()
        state.getPlayerState('p1').lastInvestorActionId = InvestorActionId.BlackMarket

        expect(canSelectInvestorActionId(state, 'p1', InvestorActionId.BlackMarket)).toBe(false)
        expect(canSelectInvestorActionId(state, 'p1', InvestorActionId.JerryRig)).toBe(true)
        // Doesn't affect other players.
        expect(canSelectInvestorActionId(state, 'p2', InvestorActionId.BlackMarket)).toBe(true)
    })
})

describe('canSelectAlienTechActionId', () => {
    it('allows any Alien Tech Action when the disc is off the board', () => {
        const state = createTestState()
        expect(canSelectAlienTechActionId(state, 'p1', AlienTechActionId.Launder)).toBe(true)
    })

    it('disallows only the specific action the disc currently sits on', () => {
        const state = createTestState()
        state.getPlayerState('p1').lastAlienTechActionId = AlienTechActionId.Launder

        expect(canSelectAlienTechActionId(state, 'p1', AlienTechActionId.Launder)).toBe(false)
        expect(canSelectAlienTechActionId(state, 'p1', AlienTechActionId.CargoBoost)).toBe(true)
    })
})
