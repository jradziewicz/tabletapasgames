import { ExternalAuthService, User } from '@tabletop/common'
import {
    APIBaseInteraction,
    APIApplicationCommandInteraction,
    InteractionResponseType,
    InteractionType,
    MessageFlags
} from 'discord-api-types/v10'

import { UserService } from '../users/userService.js'
import { NotificationService } from '../notifications/notificationService.js'
import { DiscordTransport } from '../notifications/transports/discordTransport.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import { DiscordBotUnavailableError, DiscordNotLinkedError } from '../notifications/errors.js'

const NOTIFY_COMMAND_NAME = 'notify'
const STOP_COMMAND_NAME = 'stop'
const DISCORD_ID_PREFIX = `${ExternalAuthService.Discord}:`

export type DiscordDmStatus = {
    // Whether this site has a bot at all (DISCORD_BOT_TOKEN configured).
    available: boolean
    // The player's linked Discord user id, if they have linked an account.
    discordUserId?: string
    // Whether the bot is currently set to DM them.
    enabled: boolean
}

// Bot direct messages to players: the on-site Notifications page and the /notify and /stop
// slash commands are two front doors to the same subscription, so both come through here.
export class DiscordService {
    constructor(
        private readonly notificationService: NotificationService,
        private readonly userService: UserService,
        private readonly discordTransport?: DiscordTransport
    ) {}

    get available(): boolean {
        return this.discordTransport !== undefined
    }

    static discordUserIdForUser(user: User): string | undefined {
        const externalId = user.externalIds?.find((id) => id.startsWith(DISCORD_ID_PREFIX))
        return externalId?.slice(DISCORD_ID_PREFIX.length)
    }

    async getStatus(user: User): Promise<DiscordDmStatus> {
        const discordUserId = DiscordService.discordUserIdForUser(user)
        const subscriptions = await this.notificationService.findNotificationSubscriptions(
            `user-${user.id}`
        )
        const enabled = subscriptions.some(
            (subscription) =>
                subscription.transport === TransportType.Discord &&
                'discordUserId' in subscription &&
                subscription.discordUserId === discordUserId
        )
        return { available: this.available, discordUserId, enabled }
    }

    // Turns bot DMs on for a signed-in user. A test DM goes out first so a player who can't be
    // reached (app not added to their account) finds out here rather than never hearing from us.
    async subscribe(user: User): Promise<DiscordDmStatus> {
        if (!this.discordTransport) {
            throw new DiscordBotUnavailableError()
        }
        const discordUserId = DiscordService.discordUserIdForUser(user)
        if (!discordUserId) {
            throw new DiscordNotLinkedError()
        }
        await this.discordTransport.sendTestMessage(discordUserId)
        await this.registerSubscription(user.id, discordUserId)
        return { available: true, discordUserId, enabled: true }
    }

    async unsubscribe(user: User): Promise<DiscordDmStatus> {
        const discordUserId = DiscordService.discordUserIdForUser(user)
        if (discordUserId) {
            await this.notificationService.unregisterNotificationSubscription(
                DiscordTransport.identifierForDiscordUser(discordUserId)
            )
        }
        return { available: this.available, discordUserId, enabled: false }
    }

    private async registerSubscription(userId: string, discordUserId: string) {
        await this.notificationService.registerNotificationSubscription({
            subscription: DiscordTransport.subscriptionForDiscordUser(discordUserId),
            topic: `user-${userId}`
        })
    }

    async handleInteraction(interaction: APIBaseInteraction<InteractionType, unknown>) {
        if (interaction.type === InteractionType.ApplicationCommand) {
            const commandInteraction = interaction as APIApplicationCommandInteraction
            if (commandInteraction.data.name === NOTIFY_COMMAND_NAME) {
                return this.handleNotifyCommand(commandInteraction)
            } else if (commandInteraction.data.name === STOP_COMMAND_NAME) {
                return this.handleStopCommand(commandInteraction)
            } else {
                return { type: InteractionResponseType.Pong }
            }
        } else {
            return { type: InteractionResponseType.Pong }
        }
    }

    private async handleNotifyCommand(commandInteraction: APIApplicationCommandInteraction) {
        const discordUserId = commandInteraction.user?.id ?? commandInteraction.member?.user?.id
        if (!discordUserId) {
            return this.ephemeral('For some reason I could not identify your user id. Try again?')
        }

        const user = await this.userService.getUserByExternalId(
            discordUserId,
            ExternalAuthService.Discord
        )
        if (!user) {
            return this.ephemeral(
                "I couldn't find a TableTapas account linked to your Discord. Sign in at TableTapas, open your profile, and link your Discord account - then run /notify again."
            )
        }

        await this.registerSubscription(user.id, discordUserId)
        return this.ephemeral(
            "You'll now get a DM when it's your turn, when you're invited to a game, and when a game starts. Type /stop to turn this off."
        )
    }

    private async handleStopCommand(commandInteraction: APIApplicationCommandInteraction) {
        const discordUserId = commandInteraction.user?.id ?? commandInteraction.member?.user?.id
        if (!discordUserId) {
            return this.ephemeral('For some reason I could not identify your user id. Try again?')
        }

        await this.notificationService.unregisterNotificationSubscription(
            DiscordTransport.identifierForDiscordUser(discordUserId)
        )
        return this.ephemeral('Notifications will no longer be sent. Type /notify to turn them back on.')
    }

    private ephemeral(content: string) {
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { content, flags: MessageFlags.Ephemeral }
        }
    }
}
