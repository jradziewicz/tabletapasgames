import { createGameSessionContext } from '@tabletop/frontend-components'
import { StellarVenturesGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<StellarVenturesGameSession>()

export function setGameSession(session: StellarVenturesGameSession) {
    setContext(session)
}

export function getGameSession(): StellarVenturesGameSession {
    return getContext()
}
