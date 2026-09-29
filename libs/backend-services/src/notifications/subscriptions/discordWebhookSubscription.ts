import { type Static, Type } from 'typebox'
import { TransportType } from '../transports/notificationTransport.js'
import { NotificationSubscriptionIdentifier } from './notificationSubscriptionIdentifier.js'

// One webhook per user: id is the user's own id, so the stored document is simply
// `discordWebhook:<userId>` and "change my webhook" is a delete + re-register of that one doc
// (the store's upsert deliberately never rewrites an existing subscription's data - see
// FirestoreNotificationStore.upsertNotificationSubscription).
export type DiscordWebhookSubscription = Static<typeof DiscordWebhookSubscription>
export const DiscordWebhookSubscription = Type.Evaluate(
    Type.Intersect([
        Type.Omit(NotificationSubscriptionIdentifier, ['transport']),
        Type.Object({
            transport: Type.Literal(TransportType.DiscordWebhook),
            webhookUrl: Type.String(),
            // The user's own Discord user id (a 17-20 digit snowflake). When present, every
            // message starts with <@id> so Discord actually pings them rather than just
            // dropping a message in the channel. Optional: without it, messages still post.
            discordUserId: Type.Optional(Type.String({ pattern: '^\\d{17,20}$' }))
        })
    ])
)
