import {
    Notification,
    NotificationCategory,
    UserNotification,
    UserNotificationAction
} from '@tabletop/common'
import { GameService } from '../../games/gameService.js'

const FRONTEND_HOST = process.env.FRONTEND_HOST ?? ''

// The one-line Discord-flavoured text for each user notification, shared by the bot-DM
// transport (DiscordTransport) and the user-webhook transport (DiscordWebhookTransport) so the
// two never drift apart. Masked links ([text](url)) render in message content for bot and
// webhook messages (they don't for ordinary user messages, but neither of these is one).
export function discordMessageForNotification(
    gameService: GameService,
    notification: Notification
): string | undefined {
    if (!isUserNotification(notification)) {
        return
    }
    const title = gameService.getTitle(notification.data.game.typeId)?.info.metadata.name
    const gameName = notification.data.game.name

    switch (notification.action) {
        case UserNotificationAction.PlayerJoined:
            return `${notification.data.player.name} joined your ${title} game [${gameName}](${FRONTEND_HOST}/dashboard)`
        case UserNotificationAction.PlayerDeclined:
            return `${notification.data.player.name} has declined to join your ${title} game [${gameName}](${FRONTEND_HOST}/dashboard)`
        case UserNotificationAction.GameStarted:
            return `Your ${title} game [${gameName}](${FRONTEND_HOST}/game/${notification.data.game.id}) has begun!`
        case UserNotificationAction.WasInvited:
            return `${notification.data.owner.username} invited you to join their ${title} game [${gameName}](${FRONTEND_HOST}/dashboard)`
        case UserNotificationAction.IsYourTurn:
            return `It's your turn in your ${title} game [${gameName}](${FRONTEND_HOST}/game/${notification.data.game.id})`
    }
    return
}

function isUserNotification(notification: Notification): notification is UserNotification {
    return notification.type === NotificationCategory.User
}
