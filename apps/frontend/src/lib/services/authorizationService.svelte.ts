import { Role, UserStatus, type User } from '@tabletop/common'
import { goto } from '$app/navigation'
import { redirect } from '@sveltejs/kit'
import type { TabletopApi } from '@tabletop/frontend-components'
import { browserTimeZone } from '$lib/utils/timeZones'

/**
 *
 * @class AuthorizationService
 *
 * @description
 * This service is responsible for loading and storing the current user for the session session and provides
 * an authorization method for checking if the current user is authorized to access a given route and will
 * redirect as needed if not authorized.
 *
 * Note that because svelte-kit does not allow async method calls in component script tags, the `getSessionUser`
 * method is synchronous and will return null until the session user has been loaded. This means the `initialize`
 * method must be called in a page or layout load method to ensure that the session user has been loaded
 * before calling `getSessionUser`.  Normally this is done indirectly by calling the `authorizeRoute` method,
 * but can also be called directly if desired.
 **/

export enum AuthorizationCategory {
    ActiveUser = 'activeUser',
    NoUser = 'noUser',
    Onboarding = 'onboarding'
}

export class AuthorizationService {
    private sessionUser?: User | undefined = $state(undefined)
    private initialized: boolean = false
    private initializationPromise: Promise<void> | null = null

    private continueUrl: string | undefined

    isAdmin: boolean = $derived(Boolean(this.sessionUser?.roles.includes(Role.Admin)))
    isDeveloper: boolean = $derived(Boolean(this.sessionUser?.roles.includes(Role.Developer)))
    canUseDeveloperTools: boolean = $derived(this.isAdmin || this.isDeveloper)
    debugViewEnabled: boolean = $state(false)
    adminCapabilitiesEnabled: boolean = $state(false)

    showDebug: boolean = $derived(this.canUseDeveloperTools && this.debugViewEnabled)
    actAsAdmin: boolean = $derived(this.isAdmin && this.adminCapabilitiesEnabled)

    constructor(
        private api: TabletopApi,
        private readonly onSessionUserSet: () => void
    ) {}

    public async initialize(): Promise<void> {
        if (this.initialized) {
            return
        }

        if (!this.initializationPromise) {
            this.initializationPromise = this.loadSessionUser().then(() => {
                this.initialized = true
                this.initializationPromise = null
            })
        }
        return this.initializationPromise
    }

    public async authorizeRoute({
        category,
        intendedUrl
    }: {
        category: AuthorizationCategory
        intendedUrl: URL
    }): Promise<boolean> {
        await this.initialize()
        const user = this.getSessionUser()

        let shouldRedirect = false
        switch (category) {
            case AuthorizationCategory.ActiveUser:
                if (user?.status !== UserStatus.Active) {
                    shouldRedirect = true
                }
                break
            case AuthorizationCategory.NoUser:
                if (user) {
                    shouldRedirect = true
                }
                break
            case AuthorizationCategory.Onboarding:
                if (user?.status !== UserStatus.Incomplete) {
                    shouldRedirect = true
                }
                break
        }

        if (shouldRedirect) {
            this.redirect({ user, url: intendedUrl })
            return false
        }
        return true
    }

    public getSessionUser(): User | undefined {
        return this.sessionUser
    }

    public setSessionUser(user: User) {
        this.sessionUser = user
        this.onSessionUserSet()
    }

    public clearSessionUser() {
        this.sessionUser = undefined
    }

    public async onLogin(user: User) {
        this.adoptSessionUser(user)

        if (this.continueUrl) {
            await goto(this.continueUrl)
            this.continueUrl = undefined
        } else {
            await goto('/library')
        }
    }

    public async onLogout() {
        this.clearSessionUser()
        await goto('/')
    }

    private async loadSessionUser() {
        try {
            const sessionUser = await this.api.getSelf()
            if (
                sessionUser &&
                sessionUser.status !== UserStatus.Deleted &&
                sessionUser.status !== UserStatus.Inactive
            ) {
                this.adoptSessionUser(sessionUser)
            }
        } catch {
            // do nothing
        }
    }

    private adoptSessionUser(user: User) {
        this.setSessionUser(user)
        void this.fillMissingTimeZone(user)
    }

    // Turn reminders honour Reminder Hours in the account's time zone, which only a browser
    // knows. Fill it once from this browser; onlyIfUnset keeps a zone chosen meanwhile (e.g.
    // in another tab). After that it only changes when the player picks one.
    private async fillMissingTimeZone(user: User) {
        if (user.timeZone) {
            return
        }
        try {
            const updatedUser = await this.api.updateUserTimeZone(browserTimeZone(), {
                onlyIfUnset: true
            })
            if (this.sessionUser?.id === updatedUser.id) {
                this.setSessionUser(updatedUser)
            }
        } catch (error) {
            console.error('Could not save the browser time zone', error)
        }
    }

    private redirect({ user, url }: { user?: User | null; url: URL }) {
        switch (user?.status) {
            case UserStatus.Incomplete:
                redirect(302, '/onboarding')
                break
            case UserStatus.Active:
                redirect(302, '/activeGamesCheck')
                break
            default:
                // If we are trying to go somewhere but get sent to login due to the user
                // not being in the session at all, we store the url for post login
                if (!user) {
                    this.continueUrl = `${url.pathname}${url.search}`
                }
                redirect(302, '/login')
                break
        }
    }
}
