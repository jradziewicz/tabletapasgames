import { Notification } from '@tabletop/common'
import { GameService } from '../../games/gameService.js'
import { DiscordWebhookSubscription } from '../subscriptions/discordWebhookSubscription.js'
import { DiscordWebhookRejectedError, InvalidDiscordWebhookUrlError } from '../errors.js'
import { discordMessageForNotification } from './discordMessages.js'
import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'

// Only ever POST to Discord's own webhook endpoints - a stored URL is user-supplied, and the
// server is the one making the request, so anything else would be an open relay (SSRF).
const DISCORD_WEBHOOK_HOSTS = new Set([
    'discord.com',
    'discordapp.com',
    'ptb.discord.com',
    'canary.discord.com'
])
const DISCORD_WEBHOOK_PATH = /^\/api\/(v\d+\/)?webhooks\/\d+\/[A-Za-z0-9_-]+\/?$/

// Posts to a Discord *incoming webhook* the user set up themselves in a channel they control.
// Nothing to configure on our side - no bot, no token, no OAuth app - which is the whole point
// versus DiscordTransport (the site bot DMing a linked account).
export class DiscordWebhookTransport implements NotificationTransport {
    type = TransportType.DiscordWebhook

    constructor(private readonly gameService: GameService) {}

    static normalizeWebhookUrl(raw: string): string {
        let url: URL
        try {
            url = new URL(raw.trim())
        } catch {
            throw new InvalidDiscordWebhookUrlError()
        }
        if (
            url.protocol !== 'https:' ||
            !DISCORD_WEBHOOK_HOSTS.has(url.hostname) ||
            !DISCORD_WEBHOOK_PATH.test(url.pathname)
        ) {
            throw new InvalidDiscordWebhookUrlError()
        }
        // Drop query/hash (e.g. ?wait=true) and any trailing slash so equal webhooks compare equal.
        return `${url.origin}${url.pathname.replace(/\/$/, '')}`
    }

    // For showing the user which webhook is connected without echoing the secret token part:
    // https://discord.com/api/webhooks/<id>/<token>  ->  https://discord.com/api/webhooks/<id>/…
    static maskWebhookUrl(webhookUrl: string): string {
        const segments = webhookUrl.split('/')
        segments[segments.length - 1] = '\u2026'
        return segments.join('/')
    }

    static subscriptionForUser(userId: string, webhookUrl: string): DiscordWebhookSubscription {
        return {
            id: userId,
            transport: TransportType.DiscordWebhook,
            webhookUrl: DiscordWebhookTransport.normalizeWebhookUrl(webhookUrl)
        }
    }

    static identifierForUser(userId: string) {
        return { id: userId, transport: TransportType.DiscordWebhook }
    }

    async sendNotification(
        subscription: DiscordWebhookSubscription,
        notification: Notification
    ): Promise<NotificationResult> {
        const message = discordMessageForNotification(this.gameService, notification)
        if (!message) {
            return { success: false, unregister: false }
        }
        const status = await this.post(subscription.webhookUrl, message)
        // 404/401 mean the user deleted the webhook in Discord - stop trying and clean it up.
        return {
            success: status >= 200 && status < 300,
            unregister: status === 404 || status === 401
        }
    }

    // Sends a "you're connected" message; throws a user-facing error if Discord won't take it.
    async sendTestMessage(webhookUrl: string): Promise<void> {
        const status = await this.post(
            webhookUrl,
            "TableTapas notifications are connected! You'll be pinged here when it's your turn."
        )
        if (status < 200 || status >= 300) {
            throw new DiscordWebhookRejectedError(status)
        }
    }

    private async post(webhookUrl: string, content: string): Promise<number> {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'TableTapas',
                    content,
                    allowed_mentions: { parse: [] }
                })
            })
            if (!response.ok) {
                console.error('Discord webhook rejected message', response.status)
            }
            return response.status
        } catch (e) {
            console.error('Error posting to Discord webhook', e)
            return 0
        }
    }
}
