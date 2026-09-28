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
import { CorporationId } from '../model/corporation.js'
import {
    corporationsWithMostVotes,
    eligibleBoardroomBattleCorporationIds,
    firstBoardroomVoterId,
    nextBoardroomVoterId,
    resolveBoardroomVotes,
    tallyBoardroomVotes
} from './boardroomBattle.js'

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

describe('nextBoardroomVoterId', () => {
    it('returns the next player in the (non-wrapping) vote order, or undefined once done', () => {
        const state = createTestState(3)
        const voteOrder = ['p1', 'p2', 'p3']
        expect(nextBoardroomVoterId(state, voteOrder, 'p1')).toBe('p2')
        expect(nextBoardroomVoterId(state, voteOrder, 'p2')).toBe('p3')
        expect(nextBoardroomVoterId(state, voteOrder, 'p3')).toBeUndefined()
    })

    it('skips over any player with no Boardroom Votes left to place', () => {
        const state = createTestState(4)
        const voteOrder = ['p1', 'p2', 'p3', 'p4']
        state.getPlayerState('p2').spendBoardroomVotes(state.getPlayerState('p2').boardroomVotes)
        state.getPlayerState('p3').spendBoardroomVotes(state.getPlayerState('p3').boardroomVotes)

        expect(nextBoardroomVoterId(state, voteOrder, 'p1')).toBe('p4')
        expect(nextBoardroomVoterId(state, voteOrder, 'p4')).toBeUndefined()
    })
})

describe('firstBoardroomVoterId', () => {
    it('returns the Director (first in order) when they have Votes left', () => {
        const state = createTestState(3)
        const voteOrder = ['p1', 'p2', 'p3']
        expect(firstBoardroomVoterId(state, voteOrder)).toBe('p1')
    })

    it('skips ahead to the first player who still has a Vote to place', () => {
        const state = createTestState(3)
        const voteOrder = ['p1', 'p2', 'p3']
        state.getPlayerState('p1').spendBoardroomVotes(state.getPlayerState('p1').boardroomVotes)
        expect(firstBoardroomVoterId(state, voteOrder)).toBe('p2')
    })

    it('falls back to the Director rather than undefined when nobody has any Votes left', () => {
        const state = createTestState(3)
        const voteOrder = ['p1', 'p2', 'p3']
        for (const playerId of voteOrder) {
            state.getPlayerState(playerId).spendBoardroomVotes(state.getPlayerState(playerId).boardroomVotes)
        }
        expect(firstBoardroomVoterId(state, voteOrder)).toBe('p1')
    })
})

describe('eligibleBoardroomBattleCorporationIds', () => {
    it('excludes a Corporation with no Shares left to issue', () => {
        const state = createTestState()
        expect(eligibleBoardroomBattleCorporationIds(state)).toHaveLength(5)

        const corporation = state.getCorporation(CorporationId.PinkInc)
        while (corporation.availableShareCount > 0) {
            corporation.issueShareToPlayer('p1', state.actionCount)
        }

        const eligible = eligibleBoardroomBattleCorporationIds(state)
        expect(eligible).toHaveLength(4)
        expect(eligible).not.toContain(CorporationId.PinkInc)
    })
})

describe('tallyBoardroomVotes / corporationsWithMostVotes', () => {
    it('includes every eligible Corporation at 0 Votes when nobody has voted', () => {
        const state = createTestState()
        const totals = tallyBoardroomVotes(state)
        expect(totals.size).toBe(5)
        for (const total of totals.values()) {
            expect(total).toBe(0)
        }
        // A tie at 0 - every eligible Corporation is a candidate.
        expect(corporationsWithMostVotes(state)).toHaveLength(5)
    })

    it('leaves a Corporation with no Shares left to issue out of the tally entirely', () => {
        const state = createTestState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        while (corporation.availableShareCount > 0) {
            corporation.issueShareToPlayer('p1', state.actionCount)
        }

        const totals = tallyBoardroomVotes(state)
        expect(totals.has(CorporationId.PinkInc)).toBe(false)
        expect(totals.size).toBe(4)

        // With nobody having voted, the remaining 4 eligible Corporations tie at 0.
        expect(corporationsWithMostVotes(state)).toHaveLength(4)
        expect(corporationsWithMostVotes(state)).not.toContain(CorporationId.PinkInc)
    })

    it('sums multiple Votes on the same Corporation from different players', () => {
        const state = createTestState()
        state.boardroomBattleVotes = [
            { playerId: 'p1', corporationId: CorporationId.PinkInc, amount: 2 },
            { playerId: 'p2', corporationId: CorporationId.PinkInc, amount: 3 },
            { playerId: 'p3', corporationId: CorporationId.FrostFederated, amount: 1 }
        ]

        const totals = tallyBoardroomVotes(state)
        expect(totals.get(CorporationId.PinkInc)).toBe(5)
        expect(totals.get(CorporationId.FrostFederated)).toBe(1)
        expect(totals.get(CorporationId.ScarletSyndicate)).toBe(0)

        expect(corporationsWithMostVotes(state)).toEqual([CorporationId.PinkInc])
    })

    it('reports every tied Corporation when more than one shares the highest total', () => {
        const state = createTestState()
        state.boardroomBattleVotes = [
            { playerId: 'p1', corporationId: CorporationId.PinkInc, amount: 3 },
            { playerId: 'p2', corporationId: CorporationId.FrostFederated, amount: 3 }
        ]

        const candidates = corporationsWithMostVotes(state)
        expect(candidates).toHaveLength(2)
        expect(candidates).toEqual(
            expect.arrayContaining([CorporationId.PinkInc, CorporationId.FrostFederated])
        )
    })
})

describe('resolveBoardroomVotes', () => {
    it("removes the winner's Votes from the game and returns everyone else's", () => {
        const state = createTestState()
        const p1 = state.getPlayerState('p1')
        const p2 = state.getPlayerState('p2')
        const p3 = state.getPlayerState('p3')
        p1.spendBoardroomVotes(2) // simulates having placed 2 Votes on the winner
        p2.spendBoardroomVotes(3) // simulates having placed 3 Votes on a loser
        p3.spendBoardroomVotes(1) // simulates having placed 1 Vote on a different loser

        state.boardroomBattleVotes = [
            { playerId: 'p1', corporationId: CorporationId.PinkInc, amount: 2 },
            { playerId: 'p2', corporationId: CorporationId.FrostFederated, amount: 3 },
            { playerId: 'p3', corporationId: CorporationId.ScarletSyndicate, amount: 1 }
        ]

        resolveBoardroomVotes(state, CorporationId.PinkInc)

        // p1's Votes were on the winner - removed from the game for good (already deducted).
        expect(p1.boardroomVotes).toBe(4)
        // p2 and p3's Votes were on losing Corporations - returned to their pool.
        expect(p2.boardroomVotes).toBe(6)
        expect(p3.boardroomVotes).toBe(6)

        expect(state.boardroomBattleVotes).toEqual([])
    })
})
