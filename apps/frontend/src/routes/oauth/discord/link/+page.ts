import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { completeDiscordAuthorization } from '$lib/utils/discordAuthorization'
import type { PageLoad } from './$types.js'

// On success the popup closes (every tab's layout applies the linked user); on failure it stays
// open so the person can read why, and the tab that began the link also reports it.
export const load: PageLoad = async ({ url }) => {
    const result = await completeDiscordAuthorization({ url, api: getAppContext().api })
    if (!result) {
        return
    }
    return result.outcome === 'success'
        ? { linked: true }
        : { linked: false, error: result.error.message }
}
