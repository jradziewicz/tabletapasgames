import { describe, expect, it, vi } from 'vitest'
import { AccountChangeType, Role, UserStatus, type User } from '@tabletop/common'
import { AccountDeletion, type AccountDeletionDependencies } from './accountDeletion.js'
import { UserService } from './userService.js'
import { AccountDeletionError } from './errors.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import type { StoredUser } from '../persistence/model/storedUser.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'
import { RecentAuthenticationRequiredError } from '../sessions/recentAuthentication.js'
import type { AuthenticatedSession } from '../sessions/authenticatedSession.js'

const account: User = {
    id: 'a',
    status: UserStatus.Active,
    username: 'Alice',
    email: 'alice@example.test',
    roles: [Role.User],
    externalIds: ['google:1']
}

function session(authenticatedAt: Date | undefined = new Date()): AuthenticatedSession {
    return {
        id: 's',
        userId: 'a',
        generation: 0,
        createdAt: new Date(Date.now() - 60_000),
        authenticatedAt,
        expiresAt: new Date(Date.now() + 60_000)
    }
}

function userServiceFor(existing: User) {
    const deleteUser = vi.fn<UserStore['deleteUser']>(async (_userId, validate) => {
        validate?.(existing as StoredUser)
        return [
            { id: existing.id, status: UserStatus.Deleted, roles: [], externalIds: [] },
            existing
        ]
    })
    const store: UserStore = Object.create(null)
    store.deleteUser = deleteUser
    return {
        service: new UserService(store, TokenService.prototype, LocalTaskService.prototype),
        deleteUser
    }
}

describe('deleteOwnAccount', () => {
    it('deletes the account after a recent sign-in', async () => {
        const { service, deleteUser } = userServiceFor(account)
        const [tombstone, original] = await service.deleteOwnAccount(session())
        expect(deleteUser).toHaveBeenCalledWith('a', expect.any(Function))
        expect(tombstone.status).toBe(UserStatus.Deleted)
        expect(original.username).toBe('Alice')
    })

    it('asks for the password again when the sign-in is not recent', async () => {
        const { service } = userServiceFor(account)
        await expect(
            service.deleteOwnAccount(session(new Date(Date.now() - 60 * 60_000)))
        ).rejects.toThrow(RecentAuthenticationRequiredError)
    })

    it("refuses an administrator's own deletion", async () => {
        const { service } = userServiceFor({ ...account, roles: [Role.User, Role.Admin] })
        await expect(service.deleteOwnAccount(session())).rejects.toThrow(AccountDeletionError)
    })
})

describe('AccountDeletion', () => {
    function deletion(overrides: Partial<AccountDeletionDependencies> = {}) {
        const deps = {
            users: {
                deleteOwnAccount: vi.fn(async (): Promise<[User, User]> => [
                    { id: 'a', status: UserStatus.Deleted, roles: [], externalIds: [] },
                    account
                ])
            },
            games: { releaseDeletedPlayer: vi.fn(async () => undefined) },
            sessions: { revokeAll: vi.fn(async () => undefined) },
            tokens: { cancelAllChallenges: vi.fn(async () => undefined) },
            preferences: { deletePreferences: vi.fn(async () => undefined) },
            notifications: {
                findNotificationSubscriptions: vi.fn(async () => [
                    { id: 'sub', transport: 'webpush' } as never
                ]),
                unregisterNotificationSubscription: vi.fn(async () => undefined)
            },
            tasks: { sendAccountChangeNotificationEmail: vi.fn(async () => undefined) },
            now: () => new Date(0),
            ...overrides
        }
        return { deps, service: new AccountDeletion(deps) }
    }

    it('signs out everywhere, clears what the account left and emails a confirmation', async () => {
        const { deps, service } = deletion()
        await service.deleteOwnAccount(session())
        expect(deps.sessions.revokeAll).toHaveBeenCalledWith('a')
        expect(deps.tokens.cancelAllChallenges).toHaveBeenCalledWith('a')
        expect(deps.preferences.deletePreferences).toHaveBeenCalledWith('a')
        expect(deps.notifications.findNotificationSubscriptions).toHaveBeenCalledWith('user-a')
        expect(deps.notifications.unregisterNotificationSubscription).toHaveBeenCalledOnce()
        expect(deps.games.releaseDeletedPlayer).toHaveBeenCalledWith(account)
        expect(deps.tasks.sendAccountChangeNotificationEmail).toHaveBeenCalledWith({
            email: 'alice@example.test',
            changeType: AccountChangeType.AccountDeleted,
            timestamp: new Date(0)
        })
    })

    it('keeps cleaning up after one step fails', async () => {
        const { deps, service } = deletion({
            sessions: { revokeAll: vi.fn(async () => Promise.reject(new Error('down'))) }
        })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        await expect(service.deleteOwnAccount(session())).resolves.toEqual(
            expect.objectContaining({ status: UserStatus.Deleted })
        )
        expect(deps.games.releaseDeletedPlayer).toHaveBeenCalled()
    })
})
