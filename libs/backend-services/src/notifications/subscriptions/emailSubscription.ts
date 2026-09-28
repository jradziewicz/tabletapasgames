import { type Static, Type } from 'typebox'
import { TransportType } from '../transports/notificationTransport.js'
import { NotificationSubscriptionIdentifier } from './notificationSubscriptionIdentifier.js'

// Unlike Discord (requires linking a Discord account) and WebPush (requires
// browser permission), every user already has a registered email address, so
// there is nothing for the user to opt into via a persisted subscription record.
// This type exists to satisfy the NotificationTransport contract; instances are
// constructed on the fly by DefaultNotificationService rather than stored.
export type EmailSubscription = Static<typeof EmailSubscription>
export const EmailSubscription = Type.Evaluate(
    Type.Intersect([
        Type.Omit(NotificationSubscriptionIdentifier, ['transport']),
        Type.Object({
            transport: Type.Literal(TransportType.Email)
        })
    ])
)
