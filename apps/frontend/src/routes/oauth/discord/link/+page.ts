import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ url }) => {
    const code = url.searchParams.get('code')
    if (!code) {
        return
    }

    try {
        const newUser = await getAppContext().api.linkDiscord(code)
        const channel = new BroadcastChannel('userUpdated')
        channel.postMessage({ user: newUser })
        return { linked: true }
    } catch (e) {
        console.log(e)
        return {
            linked: false,
            error:
                e instanceof Error && e.message
                    ? e.message
                    : 'Something went wrong linking your Discord account. Please close this window and try again.'
        }
    }
}
