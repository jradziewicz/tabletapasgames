import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import { CardKind, DevelopmentCards, cardActionsFor } from '../data/cards.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { currentPlayerId, remainingActionKinds } from './turn.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'in-order',
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

// A card with two different actions, each usable once.
const card = DevelopmentCards.filter((candidate) => cardActionsFor(candidate, true) === candidate.actions).find(
    (candidate) =>
        candidate.kind === CardKind.Development &&
        candidate.actions.length === 2 &&
        candidate.actions[0]!.kind !== candidate.actions[1]!.kind &&
        candidate.actions.every((action) => ['extractAndSell', 'acquire'].includes(action.kind) || (action.kind === 'hunt' && action.hunts === 1))
)!
const [top, bottom] = card.actions.map((action) => action.kind)

function onCard(state: HydratedRockyVenturesGameState) {
    state.borrowedCardId = card.id
    expect(state.actionCardId(currentPlayerId(state))).toBe(card.id)
    return state
}

describe('actions top to bottom', () => {
    it('is on for new games', () => {
        expect(startedState().actionsInOrder).toBe(true)
    })

    it('still has the lower action after the top one', () => {
        const state = onCard(startedState())
        state.turnActionsTaken = [top!]
        expect(remainingActionKinds(state)).toEqual([bottom])
    })

    it('gives up the top action once the lower one is taken', () => {
        const state = onCard(startedState())
        state.turnActionsTaken = [bottom!]
        expect(remainingActionKinds(state)).toEqual([])
    })

    it('keeps any order in older games', () => {
        const state = onCard(startedState())
        delete state.actionsInOrder
        state.turnActionsTaken = [bottom!]
        expect(remainingActionKinds(state)).toEqual([top])
    })
})
