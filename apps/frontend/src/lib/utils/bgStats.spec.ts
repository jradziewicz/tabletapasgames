import { describe, expect, it } from 'vitest'
import {
    GameResult,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player
} from '@tabletop/common'
import { bgStatsPlay, bgStatsPlayUrl, canPostToBgStats, meaningfulFinalScores } from './bgStats'

function player(id: string, overrides: Partial<Player> = {}): Player {
    return { id, name: id, status: PlayerStatus.Joined, isHuman: true, ...overrides }
}

function finishedGame(overrides: Partial<Game> = {}): Game {
    return {
        id: 'g1',
        name: 'Friday Game',
        typeId: 'stellarventures',
        ownerId: 'u1',
        status: GameStatus.Finished,
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-09-01T00:00:00Z'),
        finishedAt: new Date('2026-10-23T19:16:58.123Z'),
        result: GameResult.Win,
        winningPlayerIds: ['p1'],
        finalScores: { p1: 47, p2: 36 },
        storage: GameStorage.Remote,
        players: [
            player('p1', { name: 'Ada', userId: 'u1' }),
            player('p2', { name: 'Bo', userId: 'u2' })
        ],
        ...overrides
    }
}

describe('canPostToBgStats', () => {
    it('allows players of a finished game', () => {
        expect(canPostToBgStats(finishedGame(), 'u2')).toBe(true)
    })

    it('rejects users who did not play', () => {
        expect(canPostToBgStats(finishedGame(), 'u3')).toBe(false)
        expect(canPostToBgStats(finishedGame(), undefined)).toBe(false)
    })

    it('rejects unfinished and abandoned games', () => {
        expect(canPostToBgStats(finishedGame({ status: GameStatus.Started }), 'u1')).toBe(false)
        expect(
            canPostToBgStats(
                finishedGame({ result: GameResult.Abandoned, winningPlayerIds: [] }),
                'u1'
            )
        ).toBe(false)
    })
})

describe('meaningfulFinalScores', () => {
    it('ignores scores that only mark the winner', () => {
        expect(meaningfulFinalScores(finishedGame({ finalScores: { p1: 1, p2: 0 } }))).toBe(
            undefined
        )
    })
})

describe('bgStatsPlay', () => {
    it('describes a scored play with its BGG id', () => {
        expect(bgStatsPlay(finishedGame(), 'Stellar Ventures')).toEqual({
            sourceName: 'TableTapas Games',
            sourcePlayId: 'g1',
            playDate: '2026-10-23 19:16:58',
            location: 'TableTapas Games',
            game: {
                name: 'Stellar Ventures',
                sourceGameId: 'stellarventures',
                bggId: 359963,
                highestWins: true,
                noPoints: false
            },
            players: [
                { name: 'Ada', sourcePlayerId: 'u1', winner: true, score: 47 },
                { name: 'Bo', sourcePlayerId: 'u2', winner: false, score: 36 }
            ]
        })
    })

    it('sends a title without a BGG listing by name only, without scores when there are none', () => {
        const play = bgStatsPlay(
            finishedGame({ typeId: 'locust', finalScores: undefined }),
            'Locust: Swarm or Die'
        )
        expect(play.game.bggId).toBe(undefined)
        expect(play.game.noPoints).toBe(true)
        expect(play.players[0].score).toBe(undefined)
    })

    it('identifies players without an account by game and seat', () => {
        const game = finishedGame({ players: [player('p1', { userId: 'u1' }), player('p2')] })
        expect(bgStatsPlay(game, 'Stellar Ventures').players[1].sourcePlayerId).toBe('g1:p2')
    })
})

describe('bgStatsPlayUrl', () => {
    it('encodes the play as the data parameter of the createPlay link', () => {
        const game = finishedGame()
        const url = bgStatsPlayUrl(game, 'Stellar Ventures')
        expect(url.startsWith('https://app.bgstatsapp.com/createPlay.html?data=')).toBe(true)
        expect(url).not.toContain('+')
        const data = new URL(url).searchParams.get('data')
        expect(JSON.parse(data ?? '')).toEqual(bgStatsPlay(game, 'Stellar Ventures'))
    })
})
