import { describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { AbandonedSignUps } from './abandonedSignUps.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import type { StoredUser } from '../persistence/model/storedUser.js'

const now = new Date('2026-11-20T00:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

const signUp = (id: string, createdAt: Date, extra: Partial<User> = {}): User => ({
    id,
    status: UserStatus.Incomplete,
    roles: [Role.User],
    externalIds: [],
    createdAt,
    ...extra
})

function fixture(users: User[], seated: string[] = []) {
    const byId = new Map(users.map((user) => [user.id, user]))
    const deleteUser = vi.fn<UserStore['deleteUser']>(async (userId, validate) => {
        const existing = byId.get(userId)!
        validate?.(existing as StoredUser)
        return [{ id: userId, status: UserStatus.Deleted, roles: [], externalIds: [] }, existing]
    })
    const cleanUp = vi.fn(async () => undefined)
    const service = new AbandonedSignUps(
        { findIncompleteUsers: async () => users, deleteUser },
        { hasGamesForUser: async (userId) => seated.includes(userId) },
        { cleanUp },
        () => now
    )
    return { service, deleteUser, cleanUp }
}

describe('AbandonedSignUps', () => {
    it('deletes and cleans up sign-ups left unfinished for 3 days', async () => {
        const old = signUp('old', daysAgo(3))
        const { service, cleanUp } = fixture([old, signUp('new', daysAgo(2))])
        vi.spyOn(console, 'log').mockImplementation(() => undefined)
        expect(await service.sweep()).toEqual({ old: 'deleted' })
        expect(cleanUp).toHaveBeenCalledWith(old)
    })

    it('keeps accounts that were ever active or sit in a game', async () => {
        const { service, deleteUser } = fixture(
            [
                signUp('was-active', daysAgo(9), { activatedAt: daysAgo(8) }),
                signUp('seated', daysAgo(9))
            ],
            ['seated']
        )
        vi.spyOn(console, 'log').mockImplementation(() => undefined)
        expect(await service.sweep()).toEqual({ seated: 'seated' })
        expect(deleteUser).not.toHaveBeenCalled()
    })

    it('reports who is due without deleting on a dry run', async () => {
        const { service, deleteUser } = fixture([signUp('old', daysAgo(4))])
        vi.spyOn(console, 'log').mockImplementation(() => undefined)
        expect(await service.sweep({ dryRun: true })).toEqual({ old: 'due' })
        expect(deleteUser).not.toHaveBeenCalled()
    })
})
