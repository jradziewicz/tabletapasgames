import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import { CardActionKind } from '../data/cards.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { claimCost } from './claim.js'
import { currentPlayerId, remainingActionKinds } from './turn.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'revised',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 1,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1, 2].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

function kinds(state: HydratedRockyVenturesGameState, cardId: string) {
    state.borrowedCardId = cardId
    return state.actionCardActions(currentPlayerId(state)).map((action) => action.kind)
}

describe('revised card actions', () => {
    it('plays the new actions in new games', () => {
        const state = startedState()
        expect(state.revisedCards).toBe(true)
        expect(kinds(state, 'd03')).toEqual([CardActionKind.ExtractAndSell])
        expect(kinds(state, 'd08')).toEqual([CardActionKind.Hunt, CardActionKind.Acquire])
        expect(kinds(state, 'd22')).toEqual([CardActionKind.Acquire, CardActionKind.ClaimMine])
        expect(kinds(state, 'd26')).toEqual([CardActionKind.ClaimMine, CardActionKind.ExtractAndSell])
    })

    it('keeps the old actions in older games', () => {
        const state = startedState()
        delete state.revisedCards
        expect(kinds(state, 'd03')).toEqual([CardActionKind.ExtractAndSell, CardActionKind.Hunt])
        expect(kinds(state, 'd08')).toEqual([CardActionKind.Acquire, CardActionKind.Hunt])
    })

    it('performs all of a card 25 to 30 action list when bought, top to bottom', () => {
        const state = startedState()
        state.immediateCardId = 'd27'
        state.immediateStart = state.turnActionsTaken.length
        expect(remainingActionKinds(state).at(-1)).toBe(CardActionKind.Hunt)
        expect(remainingActionKinds(state)[0]).toBe(CardActionKind.LayTrack)
    })

    it('keeps the single immediate action in older games', () => {
        const state = startedState()
        delete state.revisedCards
        state.immediateCardId = 'd27'
        state.immediateStart = state.turnActionsTaken.length
        expect(remainingActionKinds(state)).toEqual([CardActionKind.Acquire])
    })

    it.each([
        [2, 0],
        [3, 0],
        [4, 4]
    ])('on Enzie a level %i mine costs %i', (level, cost) => {
        const state = startedState()
        state.borrowedCardId = 'd13'
        const nodeId = Object.keys(state.board.mines).find((id) => state.board.getMine(id).token)!
        state.board.getMine(nodeId).token!.level = level
        expect(claimCost(state, currentPlayerId(state), nodeId)).toBe(cost)
    })
})
