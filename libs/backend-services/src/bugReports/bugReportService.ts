import {
    BUG_REPORT_SCREENSHOT_MAX_BYTES,
    BUG_REPORT_SCREENSHOT_MAX_COUNT,
    BugReport,
    BugReportStatus,
    type BugReportRequest,
    type BugReportScreenshot,
    type Game,
    type User
} from '@tabletop/common'
import { nanoid } from 'nanoid'
import { GameService } from '../games/gameService.js'
import { GameNotFoundError } from '../games/errors.js'
import {
    BugReportStore,
    StoredBugReportScreenshot
} from '../persistence/stores/bugReportStore.js'
import { InvalidBugReportScreenshotError } from './errors.js'

const BUG_REPORT_LIST_LIMIT = 200

/** Bug reports players file from a game. Each one is stored for the Admin page. */
export class BugReportService {
    constructor(
        private readonly gameService: GameService,
        private readonly bugReportStore: BugReportStore
    ) {}

    async reportBug({ user, report }: { user: User; report: BugReportRequest }): Promise<BugReport> {
        const game = await this.gameService.getGame({ gameId: report.gameId, withState: true })
        if (!game) {
            throw new GameNotFoundError({ id: report.gameId })
        }
        const seat = this.gameService.findValidPlayerForUser({ user, game })
        const screenshots = decodeScreenshots(report.screenshots ?? [])

        const bugReport: BugReport = {
            id: nanoid(),
            status: BugReportStatus.Open,
            reporterId: user.id,
            reporterName: user.username ?? user.id,
            gameId: game.id,
            gameName: game.name,
            titleId: game.typeId,
            titleName: this.gameService.getTitle(game.typeId)?.info.metadata.name ?? game.typeId,
            description: report.description.trim(),
            context: {
                seat: seat.name,
                gameStatus: game.status,
                liveActionCount: game.state?.actionCount,
                activePlayers: activePlayerNames(game),
                view: report.view,
                versions: report.versions,
                client: report.client
            },
            screenshotCount: screenshots.length,
            createdAt: new Date()
        }

        return await this.bugReportStore.createBugReport(bugReport, screenshots)
    }

    /** One screenshot of a report by its index, or undefined when there is none. */
    async getScreenshot({
        reportId,
        index
    }: {
        reportId: string
        index: number
    }): Promise<StoredBugReportScreenshot | undefined> {
        if (!Number.isInteger(index) || index < 0 || index >= BUG_REPORT_SCREENSHOT_MAX_COUNT) {
            return undefined
        }
        return await this.bugReportStore.findBugReportScreenshot({ reportId, index })
    }

    async listBugReports({ status }: { status?: BugReportStatus } = {}): Promise<BugReport[]> {
        return await this.bugReportStore.findBugReports({ status, limit: BUG_REPORT_LIST_LIMIT })
    }

    async setStatus({
        id,
        status,
        admin
    }: {
        id: string
        status: BugReportStatus
        admin: User
    }): Promise<BugReport> {
        return await this.bugReportStore.setBugReportStatus({
            id,
            status,
            closedBy: status === BugReportStatus.Closed ? (admin.username ?? admin.id) : undefined
        })
    }
}

// The request schema already bounds these; checking the decoded bytes keeps the service safe on
// its own and guarantees each stored document stays under Firestore's 1 MiB limit.
function decodeScreenshots(
    screenshots: readonly BugReportScreenshot[]
): StoredBugReportScreenshot[] {
    if (screenshots.length > BUG_REPORT_SCREENSHOT_MAX_COUNT) {
        throw new InvalidBugReportScreenshotError({
            reason: `at most ${BUG_REPORT_SCREENSHOT_MAX_COUNT} screenshots are allowed`
        })
    }
    return screenshots.map((screenshot) => {
        const jpeg = Buffer.from(screenshot.jpeg, 'base64')
        if (jpeg.length === 0 || jpeg.length > BUG_REPORT_SCREENSHOT_MAX_BYTES) {
            throw new InvalidBugReportScreenshotError({
                reason: `each screenshot must be at most ${BUG_REPORT_SCREENSHOT_MAX_BYTES} bytes`
            })
        }
        if (!isJpeg(jpeg)) {
            throw new InvalidBugReportScreenshotError({ reason: 'screenshots must be JPEG images' })
        }
        return {
            jpeg,
            width: screenshot.width,
            height: screenshot.height,
            contentType: 'image/jpeg' as const
        }
    })
}

function isJpeg(bytes: Buffer): boolean {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function activePlayerNames(game: Game): string[] {
    const activeIds = game.state?.activePlayerIds ?? game.activePlayerIds ?? []
    return game.players
        .filter((player) => activeIds.includes(player.id))
        .map((player) => player.name)
}
