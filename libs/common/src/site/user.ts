import * as Type from 'typebox'
import { DateType } from '../util/typebox.js'
import { Color } from '../game/model/colors.js'

export enum Role {
    User = 'user',
    Developer = 'developer',
    Admin = 'admin',
    BetaTester = 'betatester',
    // Assignable from the /admin page (brought over from upstream). Upstream gates alpha-only
    // titles on it; here it does nothing until that title-visibility work is synced.
    AlphaTester = 'alphatester'
}

export enum UserStatus {
    Active = 'active',
    Inactive = 'inactive',
    Deleted = 'deleted',
    Incomplete = 'incomplete'
}

export enum ExternalAuthService {
    Google = 'google',
    Apple = 'apple',
    Discord = 'discord'
}

export type UserPreferences = Type.Static<typeof UserPreferences>
export const UserPreferences = Type.Object({
    preventWebNotificationPrompt: Type.Boolean(),
    preferredColorsEnabled: Type.Boolean(),
    preferredColors: Type.Array(Type.Enum(Color)),
    colorBlindPalette: Type.Optional(Type.Boolean()),
    // Opts out of the "it's your turn" turn-alert emails (both the 5-minute nudge and the
    // 24-hour-and-later reminders - see EmailTransport/DefaultNotificationService). Undefined
    // behaves as true (on) so existing users keep getting emails until they explicitly turn
    // it off; only an explicit false suppresses them.
    emailNotificationsEnabled: Type.Optional(Type.Boolean()),
    // One-time in-app announcement flags. Each is set true the moment the announcement is
    // shown (not waiting on the user to dismiss it), so it never shows more than once per
    // user - see the "showOnceAnnouncement" effect in the site layout.
    seenDiscordWebhookAnnouncement: Type.Optional(Type.Boolean()),
    seenDiscordBotAnnouncement: Type.Optional(Type.Boolean())
})

export type User = Type.Static<typeof User>
export const User = Type.Object({
    id: Type.String(),
    status: Type.Enum(UserStatus),
    deleted: Type.Optional(Type.Boolean()),
    deletedAt: Type.Optional(DateType()),
    username: Type.Optional(Type.String()),
    hasPassword: Type.Optional(Type.Boolean()),
    email: Type.Optional(Type.String()),
    emailVerified: Type.Optional(Type.Boolean()),
    sms: Type.Optional(Type.String()),
    roles: Type.Array(Type.Enum(Role)),
    externalIds: Type.Array(Type.String()),
    preferences: Type.Optional(UserPreferences),
    createdAt: Type.Optional(DateType()),
    updatedAt: Type.Optional(DateType())
})

export const ADMIN_ASSIGNABLE_ROLES = [Role.AlphaTester, Role.BetaTester, Role.Developer] as const
export type AdminAssignableRole = (typeof ADMIN_ASSIGNABLE_ROLES)[number]

export function isAdminAssignableRole(role: Role): role is AdminAssignableRole {
    return ADMIN_ASSIGNABLE_ROLES.some((assignable) => assignable === role)
}

export function withAssignedRoles(
    existingRoles: readonly Role[],
    assignedRoles: readonly AdminAssignableRole[]
): Role[] {
    const retained = existingRoles.filter((role) => !isAdminAssignableRole(role))
    const assigned = ADMIN_ASSIGNABLE_ROLES.filter((role) => assignedRoles.includes(role))
    return [...retained, ...assigned]
}
