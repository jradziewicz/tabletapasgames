import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    GameVisibility,
    type Game,
    type GameDefinition,
    type User
} from '@tabletop/common'
import { GameService } from './gameService.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { UserIsNotAllowedPlayerError } from './errors.js'

afterEach(() => vi.restoreAllMocks())

function user(id: string, roles: Role[]): User {
    return { id, username: id, status: UserStatus.Active, roles, externalIds: [] }
}

function definition(visibility: GameVisibility): GameDefinition {
    const unused = () => {
        throw new Error('unused')
    }
    return {
        info: {
            id: `${visibility}-title`,
            metadata: {
                name: 'Title',
                designer: 'Test',
                description: 'Test',
                year: '2026',
                minPlayers: 2,
                maxPlayers: 2,
                defaultPlayerCount: 2,
                version: '1.0.0',
                beta: visibility !== GameVisibility.Public,
                visibility
            }
        },
        runtime: {
            initializer: { initializeGame: unused, initializeGameState: unused },
            hydrator: { hydrateAction: unused, hydrateState: unused },
            playerColors: [],
            apiActions: {},
            stateHandlers: {}
        }
    }
}

function service(titles: GameDefinition[], game: Game) {
    const store: FirestoreGameStore = Object.create(FirestoreGameStore.prototype)
    vi.spyOn(store, 'findGameById').mockResolvedValue(structuredClone(game))
    const updateGame = vi
        .spyOn(store, 'updateGame')
        .mockRejectedValue(new Error('reached store update'))
    const availableTitles = Object.fromEntries(titles.map((title) => [title.info.id, title]))
    const gameService = new GameService(
        store,
        Object.create(null),
        Object.create(null),
        Object.create(null),
        Object.create(null),
        Object.create(null),
        availableTitles
    )
    return { gameService, updateGame }
}

function openGame(typeId: string): Game {
    return {
        id: 'lobby',
        typeId,
        ownerId: 'owner',
        name: 'Lobby',
        isPublic: true,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date(),
        winningPlayerIds: [],
        status: GameStatus.WaitingForPlayers,
        players: [
            { id: 'p0', isHuman: true, name: 'owner', userId: 'owner', status: PlayerStatus.Joined },
            { id: 'p1', isHuman: true, name: '', status: PlayerStatus.Open }
        ]
    }
}

describe('restricted title access', () => {
    it('lets anyone play public titles', () => {
        const live = definition(GameVisibility.Public)
        const { gameService } = service([live], openGame(live.info.id))
        expect(gameService.canPlayTitle(user('u', [Role.User]), live)).toBe(true)
    })

    it('limits alpha titles to admins and alpha testers', () => {
        const alpha = definition(GameVisibility.Alpha)
        const { gameService } = service([alpha], openGame(alpha.info.id))
        expect(gameService.canPlayTitle(user('u', [Role.User]), alpha)).toBe(false)
        expect(gameService.canPlayTitle(user('u', [Role.User, Role.BetaTester]), alpha)).toBe(
            false
        )
        expect(gameService.canPlayTitle(user('u', [Role.User, Role.AlphaTester]), alpha)).toBe(
            true
        )
        expect(gameService.canPlayTitle(user('u', [Role.User, Role.Admin]), alpha)).toBe(true)
    })

    it('rejects a non-tester joining an alpha game before touching the store', async () => {
        const alpha = definition(GameVisibility.Alpha)
        const { gameService, updateGame } = service([alpha], openGame(alpha.info.id))
        await expect(
            gameService.joinGame({ user: user('outsider', [Role.User]), gameId: 'lobby' })
        ).rejects.toBeInstanceOf(UserIsNotAllowedPlayerError)
        expect(updateGame).not.toHaveBeenCalled()
    })

    it('lets an alpha tester through to the join', async () => {
        const alpha = definition(GameVisibility.Alpha)
        const { gameService, updateGame } = service([alpha], openGame(alpha.info.id))
        await expect(
            gameService.joinGame({
                user: user('tester', [Role.User, Role.AlphaTester]),
                gameId: 'lobby'
            })
        ).rejects.toThrow('reached store update')
        expect(updateGame).toHaveBeenCalledOnce()
    })
})
