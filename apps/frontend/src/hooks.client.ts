import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { ServerInit } from '@sveltejs/kit'

// After a deploy, an already-open tab can still try to lazy-load a route chunk from the
// previous build. If that chunk was ever removed (or the browser's HTTP cache has gone stale)
// the dynamic import fails and Vite/SvelteKit emit `vite:preloadError` on window instead of
// throwing where our own code could catch it. Recovering is just a reload: the fresh page load
// always points at whatever is currently live. Guard with sessionStorage so a genuine, unrelated
// failure (e.g. a real network outage) can't loop forever - we only auto-reload once per URL.
const RELOAD_GUARD_KEY = 'tabletop:preload-error-reload'

const registerPreloadErrorRecovery = () => {
    window.addEventListener('vite:preloadError', () => {
        let alreadyReloadedForThisUrl = false
        try {
            alreadyReloadedForThisUrl = sessionStorage.getItem(RELOAD_GUARD_KEY) === location.href
        } catch {
            // Ignore storage access issues (e.g. private browsing) and just try the reload once.
        }
        if (alreadyReloadedForThisUrl) {
            return
        }
        try {
            sessionStorage.setItem(RELOAD_GUARD_KEY, location.href)
        } catch {
            // Ignore storage access issues; worst case we reload more than once.
        }
        window.location.reload()
    })
}

export const init: ServerInit = async () => {
    registerPreloadErrorRecovery()
    await getAppContext().authorizationService.initialize()
}
