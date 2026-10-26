import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    BUG_REPORT_SCREENSHOT_MAX_BYTES,
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
import type {
    BugReportStore,
    StoredBugReportScreenshot
} from '../persistence/stores/bugReportStore.js'
import { InvalidBugReportScreenshotError } from './errors.js'

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

// A tiny JPEG: start-of-image marker, an APP0 marker, end-of-image.
const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9])

function screenshotOf(bytes: Buffer, width = 640, height = 480) {
    return { jpeg: bytes.toString('base64'), width, height }
}

class MemoryBugReportStore implements BugReportStore {
    readonly reports = new Map<string, BugReport>()
    readonly screenshots = new Map<string, readonly StoredBugReportScreenshot[]>()

    async createBugReport(
        report: BugReport,
        screenshots: readonly StoredBugReportScreenshot[] = []
    ): Promise<BugReport> {
        this.reports.set(report.id, report)
        this.screenshots.set(report.id, screenshots)
        return report
    }

    async findBugReportScreenshot({ reportId, index }: { reportId: string; index: number }) {
        return this.screenshots.get(reportId)?.[index]
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

    it('stores pasted screenshots beside the report and counts them on it', async () => {
        const wide = Buffer.concat([jpegBytes, Buffer.from([1, 2, 3])])
        const stored = await service.reportBug({
            user: reporter,
            report: {
                ...report,
                screenshots: [screenshotOf(jpegBytes), screenshotOf(wide, 1920, 1080)]
            }
        })

        expect(stored.screenshotCount).toBe(2)
        expect(store.screenshots.get(stored.id)).toEqual([
            { jpeg: jpegBytes, width: 640, height: 480, contentType: 'image/jpeg' },
            { jpeg: wide, width: 1920, height: 1080, contentType: 'image/jpeg' }
        ])
        expect(await service.getScreenshot({ reportId: stored.id, index: 1 })).toEqual({
            jpeg: wide,
            width: 1920,
            height: 1080,
            contentType: 'image/jpeg'
        })
        expect(await service.getScreenshot({ reportId: stored.id, index: 2 })).toBeUndefined()
    })

    it('stores a report without screenshots with a count of zero', async () => {
        const stored = await service.reportBug({ user: reporter, report })

        expect(stored.screenshotCount).toBe(0)
        expect(store.screenshots.get(stored.id)).toEqual([])
    })

    it('rejects more than three screenshots', async () => {
        const screenshots = Array.from({ length: 4 }, () => screenshotOf(jpegBytes))

        await expect(
            service.reportBug({ user: reporter, report: { ...report, screenshots } })
        ).rejects.toBeInstanceOf(InvalidBugReportScreenshotError)
        expect(store.reports.size).toBe(0)
    })

    it('rejects a screenshot over the size limit', async () => {
        const oversized = Buffer.alloc(BUG_REPORT_SCREENSHOT_MAX_BYTES + 1)
        jpegBytes.copy(oversized)

        await expect(
            service.reportBug({
                user: reporter,
                report: { ...report, screenshots: [screenshotOf(oversized)] }
            })
        ).rejects.toBeInstanceOf(InvalidBugReportScreenshotError)
        expect(store.reports.size).toBe(0)
    })

    it('rejects a screenshot that is not a JPEG', async () => {
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

        await expect(
            service.reportBug({
                user: reporter,
                report: { ...report, screenshots: [screenshotOf(png)] }
            })
        ).rejects.toBeInstanceOf(InvalidBugReportScreenshotError)
        expect(store.reports.size).toBe(0)
    })

    it('finds no screenshot at an index outside the limit', async () => {
        const stored = await service.reportBug({
            user: reporter,
            report: { ...report, screenshots: [screenshotOf(jpegBytes)] }
        })
        const find = vi.spyOn(store, 'findBugReportScreenshot')

        expect(await service.getScreenshot({ reportId: stored.id, index: 3 })).toBeUndefined()
        expect(await service.getScreenshot({ reportId: stored.id, index: -1 })).toBeUndefined()
        expect(find).not.toHaveBeenCalled()
    })

    it('rejects a reporter who is not a player in the game', async () => {
        const outsider: User = { ...reporter, id: 'u-9' }

        await expect(service.reportBug({ user: outsider, report })).rejects.toBeInstanceOf(
            UserIsNotAllowedPlayerError
        )
        expect(store.reports.size).toBe(0)
    })

    it('accepts a report from an admin who is not a player in the game', async () => {
        const stored = await service.reportBug({ user: admin, report })

        expect(store.reports.get(stored.id)).toEqual(stored)
        expect(stored.reporterId).toBe('a-1')
        expect(stored.context.seat).toBeUndefined()
    })

    it('records the seat of an admin who is also a player in the game', async () => {
        const playingAdmin: User = { ...reporter, roles: [Role.User, Role.Admin] }
        const stored = await service.reportBug({ user: playingAdmin, report })

        expect(stored.context.seat).toBe('Alice')
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
