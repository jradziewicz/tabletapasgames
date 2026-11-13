import { render } from '@react-email/components'
import { nanoid } from 'nanoid'
import {
    EmailVerification,
    PasswordReset,
    AccountChangeNotification,
    GameInvitation,
    GameEnd,
    YourTurn,
    emailVerificationText,
    passwordResetText,
    accountChangeNotificationText,
    gameInvitationText,
    gameEndText,
    yourTurnText
} from '@tabletop/email'

import { SecretsService } from '../secrets/secretsService'
import { Game, GameDefinition, User } from '@tabletop/common'
import { AccountChangeType, EmailService } from './emailService.js'
import { NullEmailService } from './nullEmailService.js'

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email'
const DEFAULT_SENDER_EMAIL = 'noreply@playtest.tabletapasgames.com'
const DEFAULT_SENDER_NAME = 'TableTapas Games'

/**
 * Sends the site's transactional email through Brevo's HTTP API
 * (https://developers.brevo.com/reference/sendtransacemail).
 *
 * Config (env / secrets):
 * - BREVO_API_KEY: required. An empty value disables email (NullEmailService).
 * - BREVO_SENDER_EMAIL: optional, must be a sender or domain verified in Brevo.
 * - BREVO_SENDER_NAME: optional display name.
 *
 * The per-email methods mirror upstream's ResendEmailService so upstream
 * changes port over by swapping `this.resend.emails.send` for `this.send`.
 */
export class BrevoEmailService implements EmailService {
    private apiKey!: string
    private sender!: { email: string; name: string }
    private constructor() {}

    static async createEmailService(secretsService: SecretsService): Promise<EmailService> {
        const emailService = new BrevoEmailService()
        const apiKey = await secretsService.getSecret('BREVO_API_KEY')
        if (!apiKey) {
            return new NullEmailService()
        }
        emailService.apiKey = apiKey
        emailService.sender = {
            email: process.env['BREVO_SENDER_EMAIL'] || DEFAULT_SENDER_EMAIL,
            name: process.env['BREVO_SENDER_NAME'] || DEFAULT_SENDER_NAME
        }
        return emailService
    }

    private async send({
        to,
        subject,
        html,
        text
    }: {
        to: string
        subject: string
        html: string
        text: string
    }): Promise<void> {
        const response = await fetch(BREVO_SEND_URL, {
            method: 'POST',
            headers: {
                'api-key': this.apiKey,
                'content-type': 'application/json',
                accept: 'application/json'
            },
            body: JSON.stringify({
                sender: this.sender,
                to: [{ email: to }],
                subject,
                htmlContent: html,
                textContent: text,
                headers: {
                    'X-Entity-Ref-ID': nanoid()
                }
            }),
            signal: AbortSignal.timeout(15_000)
        })
        if (!response.ok) {
            const detail = await response.text().catch(() => '')
            throw new Error(`Failed to send email via Brevo: ${response.status} ${detail}`)
        }
    }

    async sendVerificationEmail(token: string, toEmail: string): Promise<void> {
        const emailHTML = await render(EmailVerification({ token }))
        const emailText = emailVerificationText({ token })
        await this.send({
            to: toEmail,
            subject: 'Verify your email address',
            html: emailHTML,
            text: emailText
        })
    }

    async sendPasswordResetEmail(token: string, url: string, toEmail: string): Promise<void> {
        const emailHTML = await render(PasswordReset({ url }))
        const emailText = passwordResetText({ url })
        await this.send({
            to: toEmail,
            subject: 'Reset your password',
            html: emailHTML,
            text: emailText
        })
    }

    async sendAccountChangedNotificationEmail(
        changeType: AccountChangeType,
        timestamp: Date,
        toEmail: string
    ): Promise<void> {
        const emailHTML = await render(AccountChangeNotification({ changeType, timestamp }))
        const emailText = accountChangeNotificationText({ changeType, timestamp })
        await this.send({
            to: toEmail,
            subject: 'Account change notification',
            html: emailHTML,
            text: emailText
        })
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
        const invitation = {
            ownerName: owner.username ?? 'someone',
            gameName: game.name,
            title: definition.info.metadata.name,
            url
        }
        const emailHTML = await render(GameInvitation(invitation))
        const emailText = gameInvitationText(invitation)
        await this.send({
            to: toEmail,
            subject: `Join ${owner.username}'s game of ${definition.info.metadata.name}`,
            html: emailHTML,
            text: emailText
        })
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

        const ending = {
            result: game.result,
            winners: winners.map((w) => w.username || 'A Player'),
            gameName: game.name,
            title: definition.info.metadata.name,
            url
        }
        const emailHTML = await render(GameEnd(ending))
        const emailText = gameEndText(ending)
        await this.send({
            to: toEmail,
            subject: `Your game of ${definition.info.metadata.name} ${game.name} has ended`,
            html: emailHTML,
            text: emailText
        })
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
        const emailText = yourTurnText({ title, gameName, url })
        await this.send({
            to: toEmail,
            subject: `It's your turn in ${gameName}!`,
            html: emailHTML,
            text: emailText
        })
    }
}
