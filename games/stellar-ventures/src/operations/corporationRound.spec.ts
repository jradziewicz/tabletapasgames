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
import { MachineState } from '../definition/states.js'
import { advanceToNextCorporationOrInvestorRound } from './corporationRound.js'

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

describe('advanceToNextCorporationOrInvestorRound', () => {
    it("advances to the next Corporation's Issue Share while turn order remains", () => {
        const state = createTestState()
        state.activeCorporationIndex = 0

        const nextState = advanceToNextCorporationOrInvestorRound(state)

        expect(nextState).toBe(MachineState.IssueShare)
        expect(state.activeCorporationIndex).toBe(1)
    })

    it('returns Release Dividends once the last Corporation finishes, before the Final Era', () => {
        const state = createTestState()
        state.era = 2
        state.activeCorporationIndex = state.corporationTurnOrder.length - 1

        const nextState = advanceToNextCorporationOrInvestorRound(state)

        expect(nextState).toBe(MachineState.ReleaseDividends)
    })

    it("returns Liquidation once the last Corporation finishes in Era 5 (rulebook: 'Era 5 proceeds to Liquidation after the Corporation Round')", () => {
        const state = createTestState()
        state.era = 5
        state.activeCorporationIndex = state.corporationTurnOrder.length - 1

        const nextState = advanceToNextCorporationOrInvestorRound(state)

        expect(nextState).toBe(MachineState.Liquidation)
    })

    it("resets Alien Alchemist's once-per-Corporation-Round limit on every hand-off, including the round's end", () => {
        const state = createTestState()
        state.activeCorporationIndex = 0
        state.alienAlchemistUsedThisCorporationRound = true

        advanceToNextCorporationOrInvestorRound(state)
        expect(state.alienAlchemistUsedThisCorporationRound).toBe(false)

        state.alienAlchemistUsedThisCorporationRound = true
        state.activeCorporationIndex = state.corporationTurnOrder.length - 1
        advanceToNextCorporationOrInvestorRound(state)
        expect(state.alienAlchemistUsedThisCorporationRound).toBe(false)
    })

    it("resets Dismantling Outposts' once-per-Corporation-Round limit on every hand-off, including the round's end", () => {
        const state = createTestState()
        state.activeCorporationIndex = 0
        state.dismantlingOutpostsUsedThisCorporationRound = true

        advanceToNextCorporationOrInvestorRound(state)
        expect(state.dismantlingOutpostsUsedThisCorporationRound).toBe(false)

        state.dismantlingOutpostsUsedThisCorporationRound = true
        state.activeCorporationIndex = state.corporationTurnOrder.length - 1
        advanceToNextCorporationOrInvestorRound(state)
        expect(state.dismantlingOutpostsUsedThisCorporationRound).toBe(false)
    })
})
