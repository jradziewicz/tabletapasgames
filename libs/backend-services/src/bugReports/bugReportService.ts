import {
    BugReport,
    BugReportStatus,
    type BugReportRequest,
    type Game,
    type User
} from '@tabletop/common'
import { nanoid } from 'nanoid'
import { GameService } from '../games/gameService.js'
import { GameNotFoundError } from '../games/errors.js'
import { BugReportStore } from '../persistence/stores/bugReportStore.js'

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
            createdAt: new Date()
        }

        return await this.bugReportStore.createBugReport(bugReport)
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

function activePlayerNames(game: Game): string[] {
    const activeIds = game.state?.activePlayerIds ?? game.activePlayerIds ?? []
    return game.players
        .filter((player) => activeIds.includes(player.id))
        .map((player) => player.name)
}
