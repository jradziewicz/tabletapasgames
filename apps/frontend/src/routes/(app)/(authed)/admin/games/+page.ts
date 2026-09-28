import { error } from '@sveltejs/kit'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ url }) => {
    const appContext = getAppContext()
    await appContext.authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })

    // There's no dedicated AuthorizationCategory for this (see authorizationService.ts) - it's
    // the one Admin-only page in the site, so a direct role check here is simpler than adding
    // a whole category for a single route.
    if (!appContext.authorizationService.isAdmin) {
        error(404, 'Not found')
    }

    await appContext.libraryService.whenReady()
}
