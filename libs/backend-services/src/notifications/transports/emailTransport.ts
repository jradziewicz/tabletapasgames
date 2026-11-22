import {
    Notification,
    NotificationCategory,
    PlayerVoteKind,
    UserNotification,
    UserNotificationAction
} from '@tabletop/common'

import { GameService } from '../../games/gameService.js'
import { UserService } from '../../users/userService.js'
import { EmailService } from '../../email/emailService.js'
import { RedisCacheService } from '../../cache/cacheService.js'
import { isUserActive } from '../../users/userActivity.js'
import { EmailSubscription } from '../subscriptions/emailSubscription.js'
import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'

const FRONTEND_HOST = process.env.FRONTEND_HOST ?? ''

export class EmailTransport implements NotificationTransport {
    type = TransportType.Email

    constructor(
        private readonly emailService: EmailService,
        private readonly userService: UserService,
        private readonly gameService: GameService,
        private readonly cacheService: RedisCacheService
    ) {}

    async sendNotification(
        subscription: EmailSubscription,
        notification: Notification
    ): Promise<NotificationResult> {
        try {
            if (!this.isUserNotification(notification)) {
                return { success: false, unregister: false }
            }

            // Only "it's your turn" alerts go out over email for now, so people
            // aren't flooded with a message for every join/decline/invite as well,
            // the way Discord DMs and web push already cover those.
            // ...plus a player asking the others to vote on a rewind or on calling the game
            // (Justin, 2026-11-22), so nobody misses a request that's waiting on them.
            if (
                notification.action !== UserNotificationAction.IsYourTurn &&
                notification.action !== UserNotificationAction.PlayerVoteRequested
            ) {
                return { success: false, unregister: false }
            }

            const userId = subscription.id

            // Don't email someone who currently has the site open - they'll see it there.
            if (await isUserActive(this.cacheService, userId)) {
                return { success: false, unregister: false }
            }

            const user = await this.userService.getUser(userId)
            if (!user || !user.email || !user.emailVerified) {
                return { success: false, unregister: false }
            }

            // Explicit opt-out (Notifications page). Undefined/true both mean "still on" -
            // see the field's own doc comment on UserPreferences for why.
            if (user.preferences?.emailNotificationsEnabled === false) {
                return { success: false, unregister: false }
            }

            const title = this.gameService.getTitle(notification.data.game.typeId)?.info.metadata
                .name
            const url = `${FRONTEND_HOST}/game/${notification.data.game.id}`

            if (notification.action === UserNotificationAction.PlayerVoteRequested) {
                await this.emailService.sendVoteRequestedEmail({
                    title: title ?? 'your game',
                    gameName: notification.data.game.name,
                    request: voteRequestText(notification.data.initiator.name, notification.data.kind),
                    url,
                    toEmail: user.email
                })
                return { success: true, unregister: false }
            }

            await this.emailService.sendTurnNotificationEmail({
                title: title ?? 'your game',
                gameName: notification.data.game.name,
                url,
                toEmail: user.email
            })

            return { success: true, unregister: false }
        } catch (e) {
            console.log('Error sending turn notification email', e)
            return { success: false, unregister: false }
        }
    }

    private isUserNotification(notification: Notification): notification is UserNotification {
        return notification.type === NotificationCategory.User
    }
}

// "Ana asks to go back" / "Ana asks to end the game", as the web push alert words it.
export function voteRequestText(initiatorName: string, kind: PlayerVoteKind): string {
    return kind === PlayerVoteKind.Call ? `${initiatorName} asks to end the game` : `${initiatorName} asks to go back`
}
