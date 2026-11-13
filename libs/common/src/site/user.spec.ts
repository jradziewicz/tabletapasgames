import { describe, expect, it } from 'vitest'
import {
    deletedAccountRecord,
    isReservedUsername,
    isAbandonedSignUp,
    accountStatusAfterCompletionCheck,
    canHoldAuthenticatedSession,
    Role,
    UserStatus,
    withAssignedRoles
} from './user.js'

describe('withAssignedRoles', () => {
    it('keeps non-assignable roles and replaces the assignable ones', () => {
        expect(
            withAssignedRoles([Role.User, Role.Admin, Role.BetaTester], [Role.AlphaTester])
        ).toEqual([Role.User, Role.Admin, Role.AlphaTester])
    })

    it('clears every assignable role when none are requested', () => {
        expect(withAssignedRoles([Role.User, Role.Developer, Role.AlphaTester], [])).toEqual([
            Role.User
        ])
    })

    it('stores assignable roles in a stable order without duplicates', () => {
        expect(
            withAssignedRoles([Role.User], [Role.Developer, Role.AlphaTester, Role.Developer])
        ).toEqual([Role.User, Role.AlphaTester, Role.Developer])
    })
})

describe('canHoldAuthenticatedSession', () => {
    it('admits Active and Incomplete Accounts', () => {
        expect(canHoldAuthenticatedSession({ status: UserStatus.Active })).toBe(true)
        expect(canHoldAuthenticatedSession({ status: UserStatus.Incomplete })).toBe(true)
    })

    it('refuses Inactive and Deleted Accounts', () => {
        expect(canHoldAuthenticatedSession({ status: UserStatus.Inactive })).toBe(false)
        expect(canHoldAuthenticatedSession({ status: UserStatus.Deleted })).toBe(false)
    })
})

describe('accountStatusAfterCompletionCheck', () => {
    it('promotes an Incomplete Account that satisfies Account Completion', () => {
        expect(accountStatusAfterCompletionCheck(UserStatus.Incomplete, true)).toBe(
            UserStatus.Active
        )
        expect(accountStatusAfterCompletionCheck(UserStatus.Incomplete, false)).toBe(
            UserStatus.Incomplete
        )
    })

    it('keeps an Active Account Active only while it satisfies Account Completion', () => {
        expect(accountStatusAfterCompletionCheck(UserStatus.Active, true)).toBe(UserStatus.Active)
        expect(accountStatusAfterCompletionCheck(UserStatus.Active, false)).toBe(
            UserStatus.Incomplete
        )
    })

    it('never moves an Inactive or Deleted Account', () => {
        for (const satisfiesCompletion of [true, false]) {
            expect(
                accountStatusAfterCompletionCheck(UserStatus.Inactive, satisfiesCompletion)
            ).toBe(UserStatus.Inactive)
            expect(accountStatusAfterCompletionCheck(UserStatus.Deleted, satisfiesCompletion)).toBe(
                UserStatus.Deleted
            )
        }
    })
})

describe('account deletion', () => {
    it('reserves names that pose as a deleted player', () => {
        expect(isReservedUsername('Deleted player 3')).toBe(true)
        expect(isReservedUsername('deleted_PLAYER')).toBe(true)
        expect(isReservedUsername('Adele')).toBe(false)
    })

    it('keeps only the id, status and dates of a deleted account', () => {
        const now = new Date(5)
        expect(
            deletedAccountRecord(
                { id: 'a', sessionGeneration: 2, createdAt: new Date(1), activatedAt: new Date(2) },
                now
            )
        ).toEqual({
            id: 'a',
            status: UserStatus.Deleted,
            deleted: true,
            deletedAt: now,
            roles: [],
            externalIds: [],
            sessionGeneration: 3,
            updatedAt: now,
            createdAt: new Date(1),
            activatedAt: new Date(2)
        })
    })
})

describe('isAbandonedSignUp', () => {
    const now = new Date('2026-11-20T00:00:00Z')
    const created = (days: number) => new Date(now.getTime() - days * 86_400_000)

    it('is an Incomplete account never activated, 3 days after sign-up', () => {
        expect(
            isAbandonedSignUp({ status: UserStatus.Incomplete, createdAt: created(3) }, now)
        ).toBe(true)
        expect(
            isAbandonedSignUp({ status: UserStatus.Incomplete, createdAt: created(2) }, now)
        ).toBe(false)
        expect(
            isAbandonedSignUp(
                { status: UserStatus.Incomplete, createdAt: created(9), activatedAt: created(8) },
                now
            )
        ).toBe(false)
        expect(isAbandonedSignUp({ status: UserStatus.Active, createdAt: created(9) }, now)).toBe(
            false
        )
    })
})
