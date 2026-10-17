import { render } from '@react-email/components'
import { nanoid } from 'nanoid'
import {
    EmailVerification,
    PasswordReset,
    AccountChangeNotification,
    GameInvitation,
    GameEnd,
    YourTurn,
    BugReportFiled
} from '@tabletop/email'

import { Resend } from 'resend'
import { SecretsService } from '../secrets/secretsService'
import {
    BugReport,
    bugReportViewLabel,
    bugReportVersionsLabel,
    Game,
    GameDefinition,
    User
} from '@tabletop/common'
import { AccountChangeType, EmailService } from './emailService.js'
import { NullEmailService } from './nullEmailService.js'

export class ResendEmailService implements EmailService {
    private resend!: Resend
    private constructor() {}

    static async createEmailService(secretsService: SecretsService): Promise<EmailService> {
        const emailService = new ResendEmailService()
        const resendKey = await secretsService.getSecret('RESEND_API_KEY')
        if (!resendKey) {
            return new NullEmailService()
        }
        emailService.resend = new Resend(resendKey)
        return emailService
    }

    async sendVerificationEmail(token: string, toEmail: string): Promise<void> {
        const emailHTML = await render(EmailVerification({ token }))
        const { error } = await this.resend.emails.send({
            from: 'noreply@playtest.tabletapasgames.com',
            to: toEmail,
            subject: 'Verify your email address',
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
        if (error) {
            throw new Error(`Failed to send email via Resend: ${error.message}`)
        }
    }

    async sendPasswordResetEmail(token: string, url: string, toEmail: string): Promise<void> {
        const emailHTML = await render(PasswordReset({ url }))
        const { error } = await this.resend.emails.send({
            from: 'noreply@playtest.tabletapasgames.com',
            to: toEmail,
            subject: 'Reset your password',
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
        if (error) {
            throw new Error(`Failed to send email via Resend: ${error.message}`)
        }
    }

    async sendAccountChangedNotificationEmail(
        changeType: AccountChangeType,
        timestamp: Date,
        toEmail: string
    ): Promise<void> {
        const emailHTML = await render(AccountChangeNotification({ changeType, timestamp }))
        const { error } = await this.resend.emails.send({
            from: 'noreply@playtest.tabletapasgames.com',
            to: toEmail,
            subject: 'Account change notification',
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
        if (error) {
            throw new Error(`Failed to send email via Resend: ${error.message}`)
        }
    }

    async sendGameInvitationEmail({
        owner,
        game,
        definition,
        url,
        toEmail
    }: {
        owner: User
        game: Game
        definition: GameDefinition
        url: string
        toEmail: string
    }): Promise<void> {
        const emailHTML = await render(
            GameInvitation({
                ownerName: owner.username ?? 'someone',
                gameName: game.name,
                title: definition.info.metadata.name,
                url
            })
        )
        const { error } = await this.resend.emails.send({
            from: 'noreply@playtest.tabletapasgames.com',
            to: toEmail,
            subject: `Join ${owner.username}'s game of ${definition.info.metadata.name}`,
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
        if (error) {
            throw new Error(`Failed to send email via Resend: ${error.message}`)
        }
    }

    async sendGameEndEmail({
        winners,
        game,
        definition,
        url,
        toEmail
    }: {
        winners: User[]
        game: Game
        definition: GameDefinition
        url: string
        toEmail: string
    }): Promise<void> {
        if (!game.result) {
            console.log('Game result is missing for game end email')
            return
        }

        const emailHTML = await render(
            GameEnd({
                result: game.result,
                winners: winners.map((w) => w.username || 'A Player'),
                gameName: game.name,
                title: definition.info.metadata.name,
                url
            })
        )
        const { error } = await this.resend.emails.send({
            from: 'noreply@playtest.tabletapasgames.com',
            to: toEmail,
            subject: `Your game of ${definition.info.metadata.name} ${game.name} has ended`,
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
        if (error) {
            throw new Error(`Failed to send email via Resend: ${error.message}`)
        }
    }

    async sendTurnNotificationEmail({
        title,
        gameName,
        url,
        toEmail
    }: {
        title: string
        gameName: string
        url: string
        toEmail: string
    }): Promise<void> {
        const emailHTML = await render(YourTurn({ title, gameName, url }))
        const { error } = await this.resend.emails.send({
            from: 'noreply@playtest.tabletapasgames.com',
            to: toEmail,
            subject: `It's your turn in ${gameName}!`,
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
        if (error) {
            throw new Error(`Failed to send email via Resend: ${error.message}`)
        }
    }

    async sendBugReportEmail({
        report,
        gameUrl,
        adminUrl,
        toEmail
    }: {
        report: BugReport
        gameUrl: string
        adminUrl: string
        toEmail: string
    }): Promise<void> {
        const emailHTML = await render(
            BugReportFiled({
                reporterName: report.reporterName,
                title: report.titleName,
                gameName: report.gameName,
                description: report.description,
                details: bugReportDetails(report),
                gameUrl,
                adminUrl
            })
        )
        const { error } = await this.resend.emails.send({
            from: 'noreply@playtest.tabletapasgames.com',
            to: toEmail,
            subject: `Bug report: ${report.titleName}, ${report.gameName}`,
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
        if (error) {
            throw new Error(`Failed to send email via Resend: ${error.message}`)
        }
    }
}

function bugReportDetails(report: BugReport): { label: string; value: string }[] {
    const { context } = report
    const details = [
        { label: 'Seat', value: context.seat ?? 'Unknown' },
        { label: 'Status', value: context.gameStatus },
        { label: 'Actions', value: context.liveActionCount?.toString() ?? 'Not started' },
        { label: 'Viewing', value: bugReportViewLabel(context.view, context.liveActionCount) },
        {
            label: 'Active players',
            value: context.activePlayers.length > 0 ? context.activePlayers.join(', ') : 'None'
        },
        { label: 'Versions', value: bugReportVersionsLabel(context.versions) },
        {
            label: 'Client',
            value: `${context.client.userAgent} · ${context.client.viewport}${
                context.client.installedApp ? ' · installed app' : ''
            }`
        }
    ]
    return details
}
