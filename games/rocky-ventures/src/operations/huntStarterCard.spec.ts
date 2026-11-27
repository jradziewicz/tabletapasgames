import { ActionSource, GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { CardActionKind, HuntStarterCardId } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState, RockyVenturesGameState } from '../model/gameState.js'
import { CardListNov24GameIds, migrateRunningGame } from './runningGameMigrations.js'
import { currentPlayerId } from './turn.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'hunt-starter',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 4,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1, 2].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

// A game from before card V, with a card bought and a card discarded.
function olderState(): HydratedRockyVenturesGameState {
    const state = startedState()
    delete state.huntStarterCard
    delete state.trackAndHuntCards
    delete state.weaponFiveAppliesThree
    delete state.earlyFeastBaseCosts
    delete state.feastSlotMultiples
    for (const player of state.players) player.tableau = ['p1', 'p2', 'p4', 'p5', 'd01']
    state.players[0]!.pawnIndex = 3
    return state
}

describe('starter Hunt card V', () => {
    it('is the last starting card in new games and hunts once', () => {
        const state = startedState()
        for (const player of state.players) expect(player.tableau).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', HuntStarterCardId])
        state.borrowedCardId = HuntStarterCardId
        expect(state.actionCardActions(currentPlayerId(state))).toEqual([{ kind: CardActionKind.Hunt, hunts: 1 }])
    })

    it('is added once, after the other starting cards, in a listed running game', () => {
        const state = olderState()
        CardListNov24GameIds.push(state.gameId)
        try {
            migrateRunningGame(state)
            for (const player of state.players) expect(player.tableau).toEqual(['p1', 'p2', 'p4', 'p5', HuntStarterCardId, 'd01'])
            expect(state.players[0]!.pawnCardId).toBe('p5')
            expect(state.cardRevision).toBe(2)
            expect(state.weaponFiveAppliesThree).toBe(true)
            expect(state.earlyFeastBaseCosts).toBe(true)
            expect(state.feastSlotMultiples).toBe(true)
            // Discarded later: loading the game again doesn't hand it back.
            state.players[0]!.tableau = ['p1', 'p2', 'p4', 'p5', 'd01']
            migrateRunningGame(state)
            expect(state.players[0]!.tableau).not.toContain(HuntStarterCardId)
        } finally {
            CardListNov24GameIds.pop()
        }
    })

    it('moves from the end to after card IV, once, with pawns staying on their cards', () => {
        const state = startedState()
        delete state.huntStarterCardPlaced
        const [first, second] = state.players
        first!.tableau = ['p1', 'p2', 'p3', 'p4', 'p5', 'd03', HuntStarterCardId]
        first!.pawnIndex = 5
        second!.tableau = ['p1', 'p2', 'd07', 'd03', HuntStarterCardId, 'd01']
        second!.stackedCards = { d07: 'p4' }
        second!.pawnIndex = 4
        CardListNov24GameIds.push(state.gameId)
        try {
            migrateRunningGame(state)
            expect(first!.tableau).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', HuntStarterCardId, 'd03'])
            expect(first!.pawnCardId).toBe('d03')
            // Card III is under a stack; V follows it.
            expect(second!.tableau).toEqual(['p1', 'p2', 'd07', HuntStarterCardId, 'd03', 'd01'])
            expect(second!.pawnCardId).toBe(HuntStarterCardId)
            // Later buys and loads leave it alone.
            first!.tableau = [...first!.tableau, 'd01']
            migrateRunningGame(state)
            expect(first!.tableau).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', HuntStarterCardId, 'd03', 'd01'])
        } finally {
            CardListNov24GameIds.pop()
        }
    })

    it('can be undone step by step back past the move', () => {
        const state = startedState()
        delete state.huntStarterCardPlaced
        const player = state.getPlayerState(currentPlayerId(state))
        player.tableau = ['p1', 'p2', 'p3', 'p4', 'p5', 'd03', HuntStarterCardId]
        player.pawnIndex = 3
        const stored = structuredClone(state.dehydrate()) as RockyVenturesGameState
        const before = structuredClone(stored)
        CardListNov24GameIds.push(stored.gameId)
        try {
            const result = engine.executeAction({
                action: { id: 'm1', gameId: stored.gameId, type: ActionType.MovePawn, playerId: player.playerId, source: ActionSource.User, targetIndex: 4, discardIndexes: [] } as never,
                state: stored,
                game: { id: stored.gameId, config: {} } as never
            })
            const moved = result.updatedState.players.find((candidate) => candidate.playerId === player.playerId)!
            expect(moved.tableau).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', HuntStarterCardId, 'd03'])
            expect(moved.pawnIndex).toBe(4)
            const undone = engine.undoProcessedAction({ action: result.processedActions.at(-1)!, state: result.updatedState })
            expect(undone).toEqual(before)
        } finally {
            CardListNov24GameIds.pop()
        }
    })

    it('leaves other running games alone', () => {
        const state = olderState()
        migrateRunningGame(state)
        for (const player of state.players) expect(player.tableau).not.toContain(HuntStarterCardId)
        expect(state.cardRevision).toBe(1)
    })
})
