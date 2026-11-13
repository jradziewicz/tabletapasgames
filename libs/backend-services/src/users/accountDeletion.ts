import { AccountChangeType, type User } from '@tabletop/common'
import type { GameService } from '../games/gameService.js'
import type { NotificationService } from '../notifications/notificationService.js'
import { userTopic } from '../notifications/topics.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import type { AuthenticatedSession } from '../sessions/authenticatedSession.js'
import type { SessionService } from '../sessions/sessionService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { TokenService } from '../tokens/tokenService.js'
import type { UserService } from './userService.js'

export type AccountDeletionDependencies = {
    users: Pick<UserService, 'deleteOwnAccount'>
    games: Pick<GameService, 'releaseDeletedPlayer'>
    sessions: Pick<SessionService, 'revokeAll'>
    tokens: Pick<TokenService, 'cancelAllChallenges'>
    preferences: Pick<UserStore, 'deletePreferences'>
    notifications: Pick<
        NotificationService,
        'findNotificationSubscriptions' | 'unregisterNotificationSubscription'
    >
    tasks: Pick<TaskService, 'sendAccountChangeNotificationEmail'>
    now?: () => Date
}

/**
 * Deleting an account. The account record becomes a tombstone (id, status and dates) and its
 * username, email and linked logins are freed at once; then everything else the person left is
 * cleared: sessions everywhere, email codes, saved preferences, notification subscriptions,
 * and their seats in games ("Deleted player N").
 */
export class AccountDeletion {
    constructor(private readonly deps: AccountDeletionDependencies) {}

    async deleteOwnAccount(session: AuthenticatedSession): Promise<User> {
        const [tombstone, original] = await this.deps.users.deleteOwnAccount(session)
        await this.cleanUp(original)
        if (original.email) await this.confirm(original.id, original.email)
        return tombstone
    }

    /**
     * Clears what a deleted account left behind. `original` is the account as it was before
     * deletion. Each step runs even if an earlier one fails, and the whole thing is safe to rerun.
     */
    async cleanUp(original: User): Promise<void> {
        const userId = original.id
        const steps: [string, () => Promise<void>][] = [
            ['sessions', () => this.deps.sessions.revokeAll(userId)],
            ['email codes', () => this.deps.tokens.cancelAllChallenges(userId)],
            ['preferences', () => this.deps.preferences.deletePreferences(userId)],
            ['notification subscriptions', () => this.removeSubscriptions(userId)],
            ['game seats', () => this.deps.games.releaseDeletedPlayer(original)]
        ]
        const failed: string[] = []
        for (const [name, step] of steps) {
            try {
                await step()
            } catch (error) {
                failed.push(name)
                console.error(`Deleted account clean-up step failed: ${name}`, {
                    userId,
                    error: error instanceof Error ? error.message : typeof error
                })
            }
        }
        if (failed.length > 0) {
            console.error('Deleted account was not fully cleaned up', { userId, failed })
        }
    }

    private async removeSubscriptions(userId: string): Promise<void> {
        const subscriptions = await this.deps.notifications.findNotificationSubscriptions(
            userTopic(userId)
        )
        for (const subscription of subscriptions) {
            await this.deps.notifications.unregisterNotificationSubscription(subscription)
        }
    }

    // The account is already gone, so a lost confirmation is logged rather than failing.
    private async confirm(userId: string, email: string): Promise<void> {
        try {
            await this.deps.tasks.sendAccountChangeNotificationEmail({
                email,
                changeType: AccountChangeType.AccountDeleted,
                timestamp: this.deps.now?.() ?? new Date()
            })
        } catch (error) {
            console.error('Account deletion confirmation was not dispatched', {
                userId,
                error: error instanceof Error ? error.name : typeof error
            })
        }
    }
}
