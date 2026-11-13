import { isAbandonedSignUp } from '@tabletop/common'
import type { GameStore } from '../persistence/stores/gameStore.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import type { AccountDeletion } from './accountDeletion.js'
import { AccountDeletionError } from './errors.js'
import { NotFoundError } from '../persistence/stores/errors.js'

export type AbandonedSignUpOutcome = 'deleted' | 'due' | 'kept' | 'seated' | 'missing' | 'failed'

/**
 * Deletes sign-ups left unfinished for 3 days (see isAbandonedSignUp), through the same
 * deletion and clean-up a player's own account deletion uses. Run daily by Cloud Scheduler.
 */
export class AbandonedSignUps {
    constructor(
        private readonly users: Pick<UserStore, 'findIncompleteUsers' | 'deleteUser'>,
        private readonly games: Pick<GameStore, 'hasGamesForUser'>,
        private readonly deletion: Pick<AccountDeletion, 'cleanUp'>,
        private readonly now: () => Date = () => new Date()
    ) {}

    // dryRun reports who is due ('due', or 'seated') without deleting anyone.
    async sweep({ dryRun = false }: { dryRun?: boolean } = {}): Promise<
        Record<string, AbandonedSignUpOutcome>
    > {
        const now = this.now()
        const due = (await this.users.findIncompleteUsers()).filter((user) =>
            isAbandonedSignUp(user, now)
        )
        const outcomes: Record<string, AbandonedSignUpOutcome> = {}
        for (const user of due) {
            try {
                outcomes[user.id] = dryRun
                    ? (await this.games.hasGamesForUser(user.id))
                        ? 'seated'
                        : 'due'
                    : await this.deleteIfAbandoned(user.id)
            } catch (error) {
                outcomes[user.id] = 'failed'
                console.error('Abandoned sign-up was not deleted', {
                    userId: user.id,
                    error: error instanceof Error ? error.message : typeof error
                })
            }
        }
        console.log(JSON.stringify({ event: 'abandoned_sign_up_sweep', dryRun, outcomes }))
        return outcomes
    }

    private async deleteIfAbandoned(userId: string): Promise<AbandonedSignUpOutcome> {
        // Only an Active account can take a seat, so a seat means it once played: keep it.
        if (await this.games.hasGamesForUser(userId)) return 'seated'
        let original
        try {
            ;[, original] = await this.users.deleteUser(userId, (existing) => {
                // Rechecked inside the transaction, in case they finished signing up just now.
                if (!isAbandonedSignUp(existing, this.now())) {
                    throw new AccountDeletionError('The sign-up was finished')
                }
            })
        } catch (error) {
            if (error instanceof AccountDeletionError) return 'kept'
            if (error instanceof NotFoundError) return 'missing'
            throw error
        }
        await this.deletion.cleanUp(original)
        return 'deleted'
    }
}
