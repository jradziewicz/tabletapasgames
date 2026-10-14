import { createGameSessionContext } from '@tabletop/frontend-components'
import { LocustGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<LocustGameSession>()

export function setGameSession(session: LocustGameSession) {
    setContext(session)
}

export function getGameSession(): LocustGameSession {
    return getContext()
}
