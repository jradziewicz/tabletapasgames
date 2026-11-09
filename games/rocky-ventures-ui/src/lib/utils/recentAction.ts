import { GameEngine, type GameAction } from '@tabletop/common'
import {
    Definition,
    type HydratedRockyVenturesGameState,
    type RockyVenturesGameState
} from '@tabletop/rocky-ventures'
import type { RockyVenturesGameSession } from '$lib/model/session.svelte.js'

const engine = new GameEngine(Definition.runtime)

function hydrate(state: RockyVenturesGameState) {
    return Definition.runtime.hydrator.hydrateState(structuredClone(state)) as HydratedRockyVenturesGameState
}

export type RecentAction<T> = {
    action: GameAction & T
    index: number
    playerId: string
    before: HydratedRockyVenturesGameState
    after: HydratedRockyVenturesGameState
}

// Another player's latest action of this type with the game as it stood either side of it.
// It counts through the rest of their turn and until the next player acts, so nobody misses
// it when the turn passes.
export function recentOtherPlayerAction<T>(session: RockyVenturesGameSession, type: string): RecentAction<T> | undefined {
    if (session.isViewingHistory) return undefined
    const actions = session.actions
    const index = actions.findLastIndex((action) => action.type === type)
    const action = actions[index]
    const playerId = action?.playerId
    if (!action || !playerId || playerId === session.myPlayer?.id) return undefined
    if (actions.slice(index + 1).some((later) => later.playerId && later.playerId !== playerId)) return undefined

    try {
        let state = session.gameState.dehydrate() as RockyVenturesGameState
        for (let later = actions.length - 1; later > index; later--) {
            state = engine.undoProcessedAction({ action: actions[later]!, state })
        }
        const after = hydrate(state)
        const before = hydrate(engine.undoProcessedAction({ action, state }))
        return { action: action as GameAction & T, index, playerId, before, after }
    } catch (error) {
        console.warn('Could not read the last move', error)
        return undefined
    }
}
