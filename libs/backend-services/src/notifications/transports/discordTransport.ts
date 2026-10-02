import { SecretsService } from '../../secrets/secretsService.js'
import { Notification } from '@tabletop/common'

import { GameService } from '../../games/gameService.js'
import { DiscordSubscription } from '../subscriptions/discordSubscription.js'
import { DiscordDmRejectedError } from '../errors.js'
import { discordMessageForNotification } from './discordMessages.js'
import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'

import {
    RESTPostAPIChannelMessageJSONBody,
    RESTPostAPICurrentUserCreateDMChannelJSONBody,
    RESTPostAPICurrentUserCreateDMChannelResult
} from 'discord-api-types/v10'

const API_ENDPOINT = 'https://discord.com/api/v10'

// Discord's "Cannot send messages to this user" (50007) and "...due to having no mutual guilds"
// (50278) - the bot and the user don't share a server and the user hasn't added the app to their
// account, or their privacy settings block app DMs. 50278 is what a player who signed in with
// Discord (which doesn't add the app) gets until they link Discord from the Notifications page.
export const CANNOT_DM_USER_CODES: readonly number[] = [50007, 50278]

type DiscordSendResult = { status: number; code?: number }

// The site's own Discord bot DMing a player who linked their Discord account. Requires a bot
// token (DISCORD_BOT_TOKEN); when that is absent the transport is never registered and the
// user-webhook transport (DiscordWebhookTransport) is the only Discord option.
export class DiscordTransport implements NotificationTransport {
    type = TransportType.Discord
    private dmCache: Map<string, string> = new Map()

    constructor(
        private readonly gameService: GameService,
        private readonly botToken: string
    ) {}

    static async createDiscordTransport(
        secretsService: SecretsService,
        gameService: GameService
    ): Promise<DiscordTransport> {
        const botToken = await secretsService.getSecret('DISCORD_BOT_TOKEN')
        return new DiscordTransport(gameService, botToken)
    }

    // A player has exactly one bot-DM subscription, keyed by their Discord user id (that is what
    // the /notify and /stop slash commands know the player by).
    static subscriptionForDiscordUser(discordUserId: string): DiscordSubscription {
        return { id: discordUserId, transport: TransportType.Discord, discordUserId }
    }

    static identifierForDiscordUser(discordUserId: string) {
        return { id: discordUserId, transport: TransportType.Discord }
    }

    async sendNotification(
        subscription: DiscordSubscription,
        notification: Notification
    ): Promise<NotificationResult> {
        const message = discordMessageForNotification(this.gameService, notification)
        if (!message) {
            return { success: false, unregister: false }
        }
        const result = await this.sendMessage({ userId: subscription.discordUserId, message })
        return {
            success: result.status >= 200 && result.status < 300,
            // Nothing we send will ever get through until the player re-adds the app, so stop
            // trying; the Notifications page shows DMs as off and they can turn them back on.
            unregister: result.code !== undefined && CANNOT_DM_USER_CODES.includes(result.code)
        }
    }

    // Sends a "you're connected" DM; throws a user-facing error if Discord won't deliver it.
    async sendTestMessage(discordUserId: string): Promise<void> {
        const result = await this.sendMessage({
            userId: discordUserId,
            message:
                "TableTapas notifications are connected! You'll get a message here when it's your turn, when you're invited to a game, and when a game you're in starts."
        })
        if (result.status < 200 || result.status >= 300) {
            throw new DiscordDmRejectedError(result.status, result.code)
        }
    }

    async sendMessage({
        userId,
        message
    }: {
        userId: string
        message: string
    }): Promise<DiscordSendResult> {
        const channel = await this.getDmChannelId(userId)
        if (!channel.id) {
            return { status: channel.status, code: channel.code }
        }

        const messageData: RESTPostAPIChannelMessageJSONBody = {
            content: message,
            // Never let a user-typed game name ping anyone.
            allowed_mentions: { parse: [] }
        }

        return this.post(`/channels/${channel.id}/messages`, messageData, userId)
    }

    private async getDmChannelId(
        userId: string
    ): Promise<{ id?: string; status: number; code?: number }> {
        const cached = this.dmCache.get(userId)
        if (cached) {
            return { id: cached, status: 200 }
        }
        const dmLookupRequestData: RESTPostAPICurrentUserCreateDMChannelJSONBody = {
            recipient_id: userId
        }
        const result = await this.post('/users/@me/channels', dmLookupRequestData, userId)
        if (!result.body) {
            return { status: result.status, code: result.code }
        }
        const channelResult = result.body as RESTPostAPICurrentUserCreateDMChannelResult
        this.dmCache.set(userId, channelResult.id)
        return { id: channelResult.id, status: result.status }
    }

    private async post(
        path: string,
        body: unknown,
        userId: string
    ): Promise<DiscordSendResult & { body?: unknown }> {
        try {
            const response = await fetch(`${API_ENDPOINT}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bot ${this.botToken}`,
                    Accept: 'application/json'
                },
                body: JSON.stringify(body)
            })
            const responseBody = (await response.json().catch(() => undefined)) as
                | { code?: number; message?: string }
                | undefined
            if (!response.ok) {
                console.error(
                    'Discord API rejected request',
                    path,
                    'for user',
                    userId,
                    response.status,
                    responseBody?.code,
                    responseBody?.message
                )
                if (
                    response.status === 403 &&
                    responseBody?.code !== undefined &&
                    CANNOT_DM_USER_CODES.includes(responseBody.code)
                ) {
                    this.dmCache.delete(userId)
                }
                return { status: response.status, code: responseBody?.code }
            }
            return { status: response.status, body: responseBody }
        } catch (e) {
            console.error('Error calling Discord API', path, 'for user', userId, e)
            return { status: 0 }
        }
    }
}
