import { BaseError } from '@tabletop/common'

enum NotificationError {
    InvalidDiscordWebhookUrl = 'InvalidDiscordWebhookUrlError',
    DiscordWebhookRejected = 'DiscordWebhookRejectedError',
    InvalidDiscordUserId = 'InvalidDiscordUserIdError',
    DiscordNotLinked = 'DiscordNotLinkedError',
    DiscordDmRejected = 'DiscordDmRejectedError',
    DiscordBotUnavailable = 'DiscordBotUnavailableError'
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

export class DiscordNotLinkedError extends BaseError {
    constructor() {
        super({
            name: NotificationError.DiscordNotLinked,
            message: 'Link your Discord account first, then turn on Discord messages.'
        })
    }
}

export class DiscordBotUnavailableError extends BaseError {
    constructor() {
        super({
            name: NotificationError.DiscordBotUnavailable,
            message: 'Discord direct messages are not enabled on this site.'
        })
    }
}

// Discord codes 50007 ("Cannot send messages to this user") and 50278 ("no mutual guilds") are
// the ones players actually hit: the bot can only DM someone who has added the app to their
// account (or shares a server with it), or who allows DMs from apps.
export class DiscordDmRejectedError extends BaseError {
    constructor(status: number, code?: number) {
        super({
            name: NotificationError.DiscordDmRejected,
            message:
                code === 50007 || code === 50278
                    ? "Discord wouldn't let the bot message you yet. Use the Add the TableTapas bot button below to add it to your Discord account, then turn direct messages on again. If it still fails, check that Discord's Settings > Privacy allows direct messages from apps."
                    : `Discord rejected the test message (HTTP ${status}). Please try again in a moment.`,
            metadata: { status, code }
        })
    }
}
