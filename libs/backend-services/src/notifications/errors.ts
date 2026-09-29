import { BaseError } from '@tabletop/common'

enum NotificationError {
    InvalidDiscordWebhookUrl = 'InvalidDiscordWebhookUrlError',
    DiscordWebhookRejected = 'DiscordWebhookRejectedError',
    InvalidDiscordUserId = 'InvalidDiscordUserIdError'
}

export class InvalidDiscordUserIdError extends BaseError {
    constructor() {
        super({
            name: NotificationError.InvalidDiscordUserId,
            message:
                "That doesn't look like a Discord user ID. It's a long number (17-20 digits) - in Discord, turn on Developer Mode under Settings > Advanced, then click your avatar and choose Copy User ID."
        })
    }
}

export class InvalidDiscordWebhookUrlError extends BaseError {
    constructor() {
        super({
            name: NotificationError.InvalidDiscordWebhookUrl,
            message:
                "That doesn't look like a Discord webhook URL. It should start with https://discord.com/api/webhooks/"
        })
    }
}

export class DiscordWebhookRejectedError extends BaseError {
    constructor(status: number) {
        super({
            name: NotificationError.DiscordWebhookRejected,
            message:
                status === 404 || status === 401
                    ? 'Discord did not recognize that webhook. It may have been deleted - create a new one and copy its URL again.'
                    : `Discord rejected the test message (HTTP ${status}). Please try again in a moment.`,
            metadata: { status }
        })
    }
}
