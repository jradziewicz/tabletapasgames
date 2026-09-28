import { SecretsService } from '../../secrets/secretsService.js'
import { Notification } from '@tabletop/common'

import { GameService } from '../../games/gameService.js'
import { DiscordSubscription } from '../subscriptions/discordSubscription.js'
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

    async sendNotification(
        subscription: DiscordSubscription,
        notification: Notification
    ): Promise<NotificationResult> {
        const message = discordMessageForNotification(this.gameService, notification)
        if (!message) {
            return {
                success: false,
                unregister: false
            }
        }
        await this.sendMessage({ userId: subscription.discordUserId, message })

        return {
            success: true,
            unregister: false
        }
    }

    async sendMessage({ userId, message }: { userId: string; message: string }) {
        const channelId = await this.getDmChannelId(userId)
        if (!channelId) {
            console.error('Could not get DM channel for user', userId)
            return
        }

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bot ${this.botToken}`,
            Accept: 'application/json'
        }

        const messageData: RESTPostAPIChannelMessageJSONBody = {
            content: message
        }

        const messageResponse = await fetch(`${API_ENDPOINT}/channels/${channelId}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify(messageData)
        })

        if (!messageResponse.ok) {
            console.error('Could not send DM to user', userId, messageResponse)
            return
        }
    }

    private async getDmChannelId(userId: string): Promise<string | undefined> {
        let channelId = this.dmCache.get(userId)
        if (!channelId) {
            const headers = {
                'Content-Type': 'application/json',
                Authorization: `Bot ${this.botToken}`,
                Accept: 'application/json'
            }
            const dmLookupRequestData: RESTPostAPICurrentUserCreateDMChannelJSONBody = {
                recipient_id: userId
            }

            const response = await fetch(`${API_ENDPOINT}/users/@me/channels`, {
                method: 'POST',
                headers,
                body: JSON.stringify(dmLookupRequestData)
            })

            if (!response.ok) {
                console.error('Discord error getting dm channel for user', userId, response)
                return
            }

            const channelResult =
                (await response.json()) as RESTPostAPICurrentUserCreateDMChannelResult

            channelId = channelResult.id
            this.dmCache.set(userId, channelId)
        }
        return channelId
    }
}
