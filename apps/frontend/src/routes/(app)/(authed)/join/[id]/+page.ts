import { goto } from '$app/navigation'
import { toast } from 'svelte-sonner'
import type { Game } from '@tabletop/common'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { onceMounted } from '$lib/components/RunOnceMounted.svelte'
import { joinLinkOutcome } from '$lib/utils/joinLink'
import type { PageLoad } from './$types.js'

// A shareable link to an open public game (GameCard's "Copy Join Link"). Anyone signed in who
// opens it gets the same "Join this game?" card as an email invitation (routes/invitation); a
// visitor who isn't signed in is sent to log in or sign up first and brought back here after.
// The backend already lets any user join a public game that is waiting for players, so this page
// only has to find the game and explain when it can't be joined (see joinLinkOutcome).
export const load: PageLoad = async ({ params, url }) => {
    const appContext = getAppContext()
    await appContext.authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })

    let game: Game
    try {
        game = (await appContext.api.getGame(params.id)).game
    } catch {
        onceMounted(() => {
            toast.error('That join link is no longer valid.')
        })
        await goto('/dashboard')
        return
    }

    const outcome = joinLinkOutcome(game, appContext.authorizationService.getSessionUser()?.id)
    if (outcome.kind === 'redirect') {
        onceMounted(() => {
            if (outcome.tone === 'info') {
                toast.info(outcome.message)
            } else {
                toast.error(outcome.message)
            }
        })
        await goto(outcome.to)
        return
    }

    return { game }
}
