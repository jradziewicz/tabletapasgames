import { createGameSessionContext } from '@tabletop/frontend-components'
import { RockyVenturesGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<RockyVenturesGameSession>()

export function setGameSession(session: RockyVenturesGameSession) {
    setContext(session)
}

export function getGameSession(): RockyVenturesGameSession {
    return getContext()
}
