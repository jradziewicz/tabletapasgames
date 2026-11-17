import { expect, it, vi } from 'vitest'
import {
    NotificationChannel,
    NotificationEventType,
    TabletopApi,
    type NotificationEvent,
    type NotificationListener
} from '@tabletop/frontend-components'
import {
    GameNotificationAction,
    GameResult,
    GameStatus,
    GameStorage,
    NotificationCategory,
    PlayerStatus,
    Role,
    UserStatus,
    type Game,
    type GameState,
    type User
} from '@tabletop/common'
import { GameService } from './gameService.svelte.js'
import type { LibraryService } from './libraryService.svelte'

vi.mock('$env/static/public', () => ({ PUBLIC_VAPID_KEY: '' }))
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }))

const user: User = { id: 'user', status: UserStatus.Active, roles: [Role.User], externalIds: [] }
const later = new Date('2026-10-02')

function game(id: string, overrides: Partial<Game> = {}): Game {
    return {
        id,
        name: id,
        typeId: 'test',
        ownerId: 'other',
        status: GameStatus.WaitingForPlayers,
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-10-01'),
        winningPlayerIds: [],
        players: [
            {
                id: 'p1',
                userId: 'other',
                name: 'Other',
                status: PlayerStatus.Joined,
                isHuman: true
            },
            { id: 'p2', userId: 'user', name: 'User', status: PlayerStatus.Reserved, isHuman: true }
        ],
        ...overrides
    }
}

function fixture() {
    let listener: NotificationListener | undefined
    const api = new TabletopApi()
    const getMyGames = vi.spyOn(api, 'getMyGames')
    const service = new GameService(
        { getTitle: () => undefined, whenReady: async () => {} } as unknown as LibraryService,
        { getSessionUser: () => user },
        { addListener: (value: NotificationListener) => (listener = value) },
        api
    )
    service.localGameStore.findGamesForUser = async () => []
    return {
        service,
        getMyGames,
        emit: async (event: NotificationEvent) => listener?.(event),
        created: (createdGame: Game): NotificationEvent => ({
            eventType: NotificationEventType.Data,
            channel: NotificationChannel.User,
            notification: {
                id: 'notice',
                type: NotificationCategory.Game,
                action: GameNotificationAction.Create,
                data: { game: createdGame }
            }
        })
    }
}

it('keeps a game created while an older list response is in flight', async () => {
    const { service, getMyGames, emit, created } = fixture()
    const olderResponse = Promise.withResolvers<Game[]>()
    getMyGames.mockReturnValueOnce(olderResponse.promise).mockResolvedValueOnce([game('new')])

    const loading = service.loadGames()
    // Our load waits for the library before fetching, so let the first fetch start.
    await vi.waitFor(() => expect(getMyGames).toHaveBeenCalledTimes(1))
    await emit(created(game('new')))
    olderResponse.resolve([])
    await loading

    expect(getMyGames).toHaveBeenCalledTimes(2)
    expect(service.waitingGames.map((waiting) => waiting.id)).toEqual(['new'])
})

it('fetches again when a load is requested while one is running', async () => {
    const { service, getMyGames } = fixture()
    const olderResponse = Promise.withResolvers<Game[]>()
    getMyGames.mockReturnValueOnce(olderResponse.promise).mockResolvedValueOnce([game('later')])

    const first = service.loadGames()
    await vi.waitFor(() => expect(getMyGames).toHaveBeenCalledTimes(1))
    const second = service.loadGames()
    olderResponse.resolve([])
    await Promise.all([first, second])

    expect(getMyGames).toHaveBeenCalledTimes(2)
    expect(service.waitingGames.map((waiting) => waiting.id)).toEqual(['later'])
})

it('fetches once when nothing changes during the load', async () => {
    const { service, getMyGames } = fixture()
    getMyGames.mockResolvedValueOnce([game('only')])
    await service.loadGames()
    expect(getMyGames).toHaveBeenCalledTimes(1)
    expect(service.waitingGames.map((waiting) => waiting.id)).toEqual(['only'])
})

function hotseat(id: string, overrides: Partial<Game> = {}): Game {
    return game(id, {
        ownerId: 'user',
        status: GameStatus.Started,
        hotseat: true,
        storage: GameStorage.Local,
        activePlayerIds: ['p1'],
        updatedAt: later,
        players: [
            { id: 'p1', userId: 'user', name: 'One', status: PlayerStatus.Joined, isHuman: true },
            { id: 'p2', userId: 'user', name: 'Two', status: PlayerStatus.Joined, isHuman: true }
        ],
        ...overrides
    })
}

function finalState(gameId: string): GameState {
    return {
        id: `${gameId}-state`,
        gameId,
        activePlayerIds: [],
        winningPlayerIds: ['p2'],
        actionCount: 22,
        result: GameResult.Win
    } as Partial<GameState> as GameState
}

it('lists a hotseat game saved as started after it ended as finished', async () => {
    const { service, getMyGames } = fixture()
    getMyGames.mockResolvedValueOnce([])
    const ended = hotseat('ended', { activePlayerIds: [] })
    service.localGameStore.findGamesForUser = async () => [ended, hotseat('playing')]
    service.localGameStore.loadGameState = async (gameId) =>
        gameId === 'ended' ? finalState('ended') : undefined
    await service.loadGames()

    expect(service.activeGames.map((active) => active.id)).toEqual(['playing'])
    expect(service.finishedLocalGames).toMatchObject([
        {
            id: 'ended',
            status: GameStatus.Finished,
            result: GameResult.Win,
            winningPlayerIds: ['p2'],
            finishedAt: later
        }
    ])
})

it('does not read the state of a hotseat game with a player to move', async () => {
    const { service, getMyGames } = fixture()
    getMyGames.mockResolvedValueOnce([])
    service.localGameStore.findGamesForUser = async () => [hotseat('playing')]
    const loadGameState = vi.fn(async () => undefined)
    service.localGameStore.loadGameState = loadGameState
    await service.loadGames()

    expect(loadGameState).not.toHaveBeenCalled()
})
