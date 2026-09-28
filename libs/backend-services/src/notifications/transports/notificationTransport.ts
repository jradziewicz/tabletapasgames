import { Notification } from '@tabletop/common'
import { NotificationSubscription } from '../subscriptions/notificationSubscription.js'

export enum TransportType {
    WebPush = 'webPush',
    Discord = 'discord',
    // A Discord *incoming webhook* the user created themselves in a channel they control
    // (Channel Settings -> Integrations -> Webhooks), as opposed to Discord above, which is the
    // site's own bot DMing them and needs a bot token + linked account to work at all.
    DiscordWebhook = 'discordWebhook',
    Email = 'email'
}

export type NotificationResult = {
    success: boolean
    unregister: boolean
}

export interface NotificationTransport {
    type: TransportType
    sendNotification(
        subscription: NotificationSubscription,
        notification: Notification
    ): Promise<NotificationResult>
}
