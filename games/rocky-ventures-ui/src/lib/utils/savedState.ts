import type { RockyVenturesGameState } from '@tabletop/rocky-ventures'
import type { RockyVenturesGameSession } from '$lib/model/session.svelte.js'

// The state undo steps were recorded against. The state on screen can already include one-time
// changes to a running game (a card moved within a tableau) that aren't saved until the next move,
// and undo steps refer to cards by position.
export function savedState(session: RockyVenturesGameSession): RockyVenturesGameState {
    const shown = session.gameState
    const saved = (session as unknown as { currentVisibleContext?: { state?: RockyVenturesGameState } }).currentVisibleContext?.state
    return saved && saved.actionCount === shown.actionCount ? saved : (shown.dehydrate() as RockyVenturesGameState)
}
