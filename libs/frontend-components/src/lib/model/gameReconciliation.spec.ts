import { describe, expect, it, vi } from 'vitest'
import {
    ActionSource,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import type { GameContext } from './gameContext.svelte.js'
import { GameReconciliation, ServerActionHandling } from './gameReconciliation.js'

type State = GameState & { card?: string; effect?: string; cubes?: (string | null | undefined)[] }
type Context = GameContext<State, HydratedGameState<State> & State>

function stateWith(fields: Partial<State>): State {
    return {
        systemVersion: 3,
        id: 'state',
        gameId: 'game',
        activePlayerIds: ['p1'],
        winningPlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        ...fields
    } as State
}

// The player placed a piece (action 0) and undid it; the server's broadcast of the placement can
// still arrive afterwards, carrying the game record as it stood before the undo.
function afterUndo() {
    const placedAt = new Date('2026-10-14T21:00:00.000Z')
    const undoneAt = new Date('2026-10-14T21:00:01.000Z')
    const game = { id: 'game', updatedAt: undoneAt } as Game
    const context = {
        state: stateWith({ actionCount: 0 }),
        game,
        historyStartIndex: 0,
        hasAction: () => false,
        applyActionResults: vi.fn(),
        updateGame: vi.fn(),
        restoreFrom: vi.fn(),
        nextActionIndex: 0,
        actions: [],
        engine: {
            applyProcessedAction: ({ state }: { state: State }) => ({
                ...state,
                actionCount: state.actionCount + 1
            })
        }
    }
    const clone = () => ({
        ...context,
        state: structuredClone(context.state),
        nextActionIndex: context.nextActionIndex,
        applyActionResults(results: { updatedState: State }) {
            this.state = results.updatedState
            this.nextActionIndex += 1
        },
        verifyFullChecksum: () => {},
        updateGame: () => {}
    })
    Object.assign(context, { clone })
    const remote = {
        isPaused: () => false,
        recover: vi.fn(),
        acceptsPerspective: () => true
    }
    const placement: GameAction = {
        id: 'place',
        gameId: 'game',
        type: 'PlaceCity',
        playerId: 'p1',
        source: ActionSource.User,
        index: 0
    }
    const broadcast = (updatedAt: Date) => ({
        kind: 'actions' as const,
        actions: [placement],
        handling: ServerActionHandling.ApplyProcessed,
        game: { ...game, updatedAt }
    })
    const reconciliation = new GameReconciliation(
        context as unknown as Context,
        remote as unknown as ConstructorParameters<
            typeof GameReconciliation<State, HydratedGameState<State> & State>
        >[1]
    )
    // An earlier Undo's push: the game as it stood with the placement still in it.
    const replacement = (updatedAt: Date) => ({
        kind: 'replacement' as const,
        replay: { startIndex: 0, actions: [placement] },
        checksum: 0,
        game: { ...game, updatedAt },
        perspective: { kind: 'player' as const, playerId: 'p1' }
    })
    return { context, reconciliation, broadcast, replacement, placedAt, undoneAt }
}

describe('GameReconciliation server updates', () => {
    it('ignores the broadcast of an action the player has since undone', async () => {
        const { context, reconciliation, broadcast, placedAt } = afterUndo()

        await reconciliation.enqueue(broadcast(placedAt))

        expect(context.applyActionResults).not.toHaveBeenCalled()
        expect(context.updateGame).not.toHaveBeenCalled()
    })

    it('ignores a replacement older than the game it has', async () => {
        const { context, reconciliation, replacement, placedAt } = afterUndo()

        await reconciliation.enqueue(replacement(placedAt))

        expect(context.restoreFrom).not.toHaveBeenCalled()
    })

    it('applies a broadcast newer than the game it has', async () => {
        const { context, reconciliation, broadcast, undoneAt } = afterUndo()

        await reconciliation.enqueue(broadcast(new Date(undoneAt.getTime() + 1000)))

        expect(context.applyActionResults).toHaveBeenCalledOnce()
    })
})
