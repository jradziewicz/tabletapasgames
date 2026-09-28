import { error, isHttpError } from '@sveltejs/kit'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { BridgedContext } from '@tabletop/frontend-components'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ params, url }) => {
    const appContext = getAppContext()
    await appContext.authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })

    const { id } = params

    // ?admin=1 is how the Admin "all games" list opens a game it isn't the viewer's own -
    // it asks for the same host/all-info view an Admin already gets on a game they own
    // (see canAccessHostView on the backend), so score data an Admin is there to record is
    // never hidden behind the normal spectator projection. Never turned on any other way -
    // an Admin's OWN in-progress games still load exactly as any other player's would.
    const wantsAdminView = url.searchParams.get('admin') === '1'
    const hostView = wantsAdminView && appContext.authorizationService.isAdmin

    try {
        const { game, actions } = await appContext.gameService.loadGame(id, { hostView })
        if (!game) {
            error(404, 'The specified game was not found')
        }

        if (!game.state) {
            error(409, 'The specified game has not been started')
        }

        await appContext.libraryService.whenReady()
        const definition = appContext.libraryService.getTitle(game.typeId)
        if (!definition) {
            error(404, 'The specified game is not supported')
        }

        const runtime = await definition.runtime()
        const sessionClass = runtime.sessionClass

        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: game.id
        })
        return {
            gameSession: new sessionClass({
                gameService: appContext.gameService,
                bridgedContext: bridgedContext,
                notificationService: appContext.notificationService,
                chatService: appContext.chatService,
                api: appContext.api,
                runtime: runtime,
                game,
                state: game.state,
                actions
            })
        }
    } catch (e) {
        if (isHttpError(e)) {
            throw e
        }
        console.error(e)
        error(500, 'Unable to load the game')
    }
}
