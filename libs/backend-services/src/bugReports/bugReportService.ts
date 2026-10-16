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
import { UserService } from '../users/userService.js'
import { EmailService } from '../email/emailService.js'
import { BugReportStore } from '../persistence/stores/bugReportStore.js'

export type BugReportServiceOptions = {
    /** The public site, e.g. https://play.tabletapasgames.com, for links in the admin email. */
    frontendHost: string
}

const BUG_REPORT_LIST_LIMIT = 200

/**
 * Bug reports players file from a game. Each one is stored for the Admin page and emailed to
 * every site admin; nothing leaves the site.
 */
export class BugReportService {
    constructor(
        private readonly gameService: GameService,
        private readonly userService: UserService,
        private readonly emailService: EmailService,
        private readonly bugReportStore: BugReportStore,
        private readonly options: BugReportServiceOptions
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

        const stored = await this.bugReportStore.createBugReport(bugReport)
        await this.notifyAdmins(stored)
        return stored
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

    // The report is already stored, so a failed email must not fail the request.
    private async notifyAdmins(report: BugReport): Promise<void> {
        let admins: User[]
        try {
            admins = await this.userService.getAdmins()
        } catch (error) {
            console.error('Could not look up admins for a bug report', error)
            return
        }

        const host = this.options.frontendHost
        const gameUrl = `${host}/game/${encodeURIComponent(report.gameId)}?admin=1`
        const adminUrl = `${host}/admin`
        const emails = admins.map((admin) => admin.email).filter((email) => !!email) as string[]

        const results = await Promise.allSettled(
            emails.map((toEmail) =>
                this.emailService.sendBugReportEmail({ report, gameUrl, adminUrl, toEmail })
            )
        )
        for (const result of results) {
            if (result.status === 'rejected') {
                console.error('Could not email a bug report to an admin', result.reason)
            }
        }
    }
}

function activePlayerNames(game: Game): string[] {
    const activeIds = game.state?.activePlayerIds ?? game.activePlayerIds ?? []
    return game.players
        .filter((player) => activeIds.includes(player.id))
        .map((player) => player.name)
}
