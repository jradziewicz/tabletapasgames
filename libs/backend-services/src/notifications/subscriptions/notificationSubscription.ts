import { Static, Type } from 'typebox'
import { DiscordSubscription } from './discordSubscription.js'
import { DiscordWebhookSubscription } from './discordWebhookSubscription.js'
import { WebPushSubscription } from './webPushSubscription.js'
import { EmailSubscription } from './emailSubscription.js'

export type NotificationSubscription = Static<typeof NotificationSubscription>
export const NotificationSubscription = Type.Union([
    DiscordSubscription,
    DiscordWebhookSubscription,
    WebPushSubscription,
    EmailSubscription
])
