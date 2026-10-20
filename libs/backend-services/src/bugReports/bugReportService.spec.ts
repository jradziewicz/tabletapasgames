import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    BugReportStatus,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    type BugReport,
    type BugReportRequest,
    type Game,
    type GameState,
    type User
} from '@tabletop/common'
import { BugReportService } from './bugReportService.js'
import { GameService } from '../games/gameService.js'
import { GameNotFoundError, UserIsNotAllowedPlayerError } from '../games/errors.js'
import type { BugReportStore } from '../persistence/stores/bugReportStore.js'

const reporter: User = {
    id: 'u-1',
    username: 'alice',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

const admin: User = {
    id: 'a-1',
    username: 'jan',
    status: UserStatus.Active,
    roles: [Role.User, Role.Admin],
    externalIds: []
}

const state = {
    id: 'state-1',
    gameId: 'game-1',
    players: [],
    activePlayerIds: ['p-2'],
    actionCount: 14,
    actionChecksum: 7,
    prng: { seed: 1, invocations: 0 },
    machineState: 'placing',
    turnManager: { series: [], turnOrder: ['p-1', 'p-2'], turnCounts: {} },
    winningPlayerIds: []
} as unknown as GameState

const game: Game = {
    id: 'game-1',
    typeId: 'stellar-ventures',
    status: GameStatus.Started,
    isPublic: false,
    deleted: false,
    ownerId: 'u-1',
    name: 'Friday night',
    players: [
        { id: 'p-1', isHuman: true, userId: 'u-1', name: 'Alice', status: PlayerStatus.Joined },
        { id: 'p-2', isHuman: true, userId: 'u-2', name: 'Bob', status: PlayerStatus.Joined }
    ],
    config: {},
    hotseat: false,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    winningPlayerIds: [],
    state
} as unknown as Game

const report: BugReportRequest = {
    gameId: 'game-1',
    description: '  The ship would not move  ',
    view: { actionCount: 12, inHistory: true, exploring: false },
    versions: { site: '1.2.3', logic: '1.0.4', ui: '1.0.21' },
    client: { userAgent: 'test', viewport: '800x600 @1x', installedApp: false }
}

class MemoryBugReportStore implements BugReportStore {
    readonly reports = new Map<string, BugReport>()

    async createBugReport(report: BugReport): Promise<BugReport> {
        this.reports.set(report.id, report)
        return report
    }

    async findBugReports({ status, limit }: { status?: BugReportStatus; limit: number }) {
        return [...this.reports.values()]
            .filter((report) => !status || report.status === status)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit)
    }

    async setBugReportStatus({
        id,
        status,
        closedBy
    }: {
        id: string
        status: BugReportStatus
        closedBy?: string
    }): Promise<BugReport> {
        const existing = this.reports.get(id)!
        const updated: BugReport = { ...existing, status }
        delete updated.closedAt
        delete updated.closedBy
        if (status === BugReportStatus.Closed) {
            updated.closedAt = new Date()
            updated.closedBy = closedBy
        }
        this.reports.set(id, updated)
        return updated
    }
}

describe('BugReportService', () => {
    let gameService: GameService
    let store: MemoryBugReportStore
    let service: BugReportService

    beforeEach(() => {
        gameService = Object.create(GameService.prototype)
        vi.spyOn(gameService, 'getGame').mockResolvedValue(structuredClone(game))
        vi.spyOn(gameService, 'getTitle').mockReturnValue({
            info: { metadata: { name: 'Stellar Ventures' } }
        } as unknown as ReturnType<GameService['getTitle']>)
        store = new MemoryBugReportStore()
        service = new BugReportService(gameService, store)
    })

    it('stores an open report with the game context for a player in the game', async () => {
        const stored = await service.reportBug({ user: reporter, report })

        expect(gameService.getGame).toHaveBeenCalledWith({ gameId: 'game-1', withState: true })
        expect(store.reports.get(stored.id)).toEqual(stored)
        expect(stored).toMatchObject({
            status: BugReportStatus.Open,
            reporterId: 'u-1',
            reporterName: 'alice',
            gameId: 'game-1',
            gameName: 'Friday night',
            titleId: 'stellar-ventures',
            titleName: 'Stellar Ventures',
            description: 'The ship would not move',
            context: {
                seat: 'Alice',
                gameStatus: GameStatus.Started,
                liveActionCount: 14,
                activePlayers: ['Bob'],
                view: report.view,
                versions: report.versions,
                client: report.client
            }
        })
        expect(stored.createdAt).toBeInstanceOf(Date)
    })

    it('rejects a reporter who is not a player in the game', async () => {
        const outsider: User = { ...reporter, id: 'u-9' }

        await expect(service.reportBug({ user: outsider, report })).rejects.toBeInstanceOf(
            UserIsNotAllowedPlayerError
        )
        expect(store.reports.size).toBe(0)
    })

    it('rejects a report for a game that does not exist', async () => {
        vi.mocked(gameService.getGame).mockResolvedValueOnce(undefined)

        await expect(service.reportBug({ user: reporter, report })).rejects.toBeInstanceOf(
            GameNotFoundError
        )
        expect(store.reports.size).toBe(0)
    })

    it('falls back to the type id when the title is not loaded', async () => {
        vi.mocked(gameService.getTitle).mockReturnValue(undefined)

        const stored = await service.reportBug({ user: reporter, report })

        expect(stored.titleName).toBe('stellar-ventures')
    })

    it('lists reports newest first, optionally only open ones', async () => {
        const first = await service.reportBug({ user: reporter, report })
        first.createdAt = new Date('2026-10-01T00:00:00.000Z')
        const second = await service.reportBug({ user: reporter, report })
        second.createdAt = new Date('2026-10-02T00:00:00.000Z')
        await service.setStatus({ id: first.id, status: BugReportStatus.Closed, admin })

        expect((await service.listBugReports()).map((r) => r.id)).toEqual([second.id, first.id])
        expect(
            (await service.listBugReports({ status: BugReportStatus.Open })).map((r) => r.id)
        ).toEqual([second.id])
    })

    it('records who closed a report and clears it on reopen', async () => {
        const stored = await service.reportBug({ user: reporter, report })

        const closed = await service.setStatus({
            id: stored.id,
            status: BugReportStatus.Closed,
            admin
        })
        expect(closed.status).toBe(BugReportStatus.Closed)
        expect(closed.closedBy).toBe('jan')
        expect(closed.closedAt).toBeInstanceOf(Date)

        const reopened = await service.setStatus({
            id: stored.id,
            status: BugReportStatus.Open,
            admin
        })
        expect(reopened.status).toBe(BugReportStatus.Open)
        expect(reopened.closedBy).toBeUndefined()
        expect(reopened.closedAt).toBeUndefined()
    })
})
