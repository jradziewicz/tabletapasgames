import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { CardActionKind, HuntStarterCardId } from '../data/cards.js'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
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

    it('is added once to the end of each tableau in a listed running game', () => {
        const state = olderState()
        CardListNov24GameIds.push(state.gameId)
        try {
            migrateRunningGame(state)
            for (const player of state.players) expect(player.tableau).toEqual(['p1', 'p2', 'p4', 'p5', 'd01', HuntStarterCardId])
            expect(state.players[0]!.pawnCardId).toBe('p5')
            expect(state.cardRevision).toBe(2)
            // Discarded later: loading the game again doesn't hand it back.
            state.players[0]!.tableau = ['p1', 'p2', 'p4', 'p5', 'd01']
            migrateRunningGame(state)
            expect(state.players[0]!.tableau).not.toContain(HuntStarterCardId)
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
