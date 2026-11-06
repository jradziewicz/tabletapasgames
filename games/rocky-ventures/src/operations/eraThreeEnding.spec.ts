import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { GameOverCard } from '../data/cards.js'
import { drawIntoMarket, removeFromMarket, ThirdEraCardId } from './market.js'
import { endGameTriggered } from './endGame.js'
import { nextStateAfterResolution, startPointBuy } from './turn.js'
import { EraThreeEndingGameIds } from './runningGameMigrations.js'

const engine = new GameEngine(Definition.runtime)
const random = () => 0

function startedState(id = 'era-three'): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id,
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

describe('End of Era III ending', () => {
    it('shuffles End of Era III into the last decade of a new game', () => {
        const state = startedState()
        const pile = state.market.drawPile
        expect(state.eraThreeEndsGame).toBe(true)
        expect(pile.indexOf(ThirdEraCardId)).toBeGreaterThanOrEqual(pile.length - 8)
        expect(pile).not.toContain(GameOverCard.id)
    })

    it('ends the game at once when the card is taken, with no point buy step', () => {
        const state = startedState()
        startPointBuy(state, ThirdEraCardId)
        expect(state.pointBuy).toBeUndefined()
        expect(endGameTriggered(state)).toBe(true)
        expect(nextStateAfterResolution(state)).toBe(MachineState.EndOfGame)
    })

    it('ignores the old end triggers', () => {
        const state = startedState()
        state.market.drawPile = [GameOverCard.id]
        state.dragon.summoned = true
        state.dragon.killed = true
        state.gemsSpent = 15
        expect(endGameTriggered(state)).toBe(false)
    })

    it.each(['era1', 'era2'])('removes both cards and ends the game when %s meets End of Era III', (other) => {
        const state = startedState()
        state.market.slots = ['d01', 'd02', other]
        state.market.drawPile = [ThirdEraCardId, 'd03', GameOverCard.id]
        drawIntoMarket(state, random)
        expect(state.market.slots).toEqual(['d01', 'd02'])
        expect(endGameTriggered(state)).toBe(true)
    })

    it('in older games with a Game Over card, ends when End of Era III is the last card drawn', () => {
        const state = startedState()
        state.market.slots = ['d01', 'd02']
        state.market.drawPile = [ThirdEraCardId, GameOverCard.id]
        drawIntoMarket(state, random)
        expect(endGameTriggered(state)).toBe(true)
    })

    it('in older games with a Game Over card, ends when End of Era III is the only card left', () => {
        const state = startedState()
        state.market.slots = ['d01', ThirdEraCardId]
        state.market.drawPile = [GameOverCard.id]
        removeFromMarket(state, 0, random)
        expect(endGameTriggered(state)).toBe(true)
    })

    it('carries on when End of Era III is the last card drawn with no card beneath it', () => {
        const state = startedState()
        state.market.slots = ['d01', 'd02']
        state.market.drawPile = [ThirdEraCardId]
        drawIntoMarket(state, random)
        expect(state.market.slots).toContain(ThirdEraCardId)
        expect(endGameTriggered(state)).toBe(false)
    })

    it('carries on when End of Era III is the only card left with no card beneath it', () => {
        const state = startedState()
        state.market.slots = ['d01', ThirdEraCardId]
        state.market.drawPile = []
        removeFromMarket(state, 0, random)
        expect(state.market.slots).toEqual([ThirdEraCardId])
        expect(endGameTriggered(state)).toBe(false)
    })

    it('does not end when the deck runs out', () => {
        const state = startedState()
        state.market.slots = ['d01']
        state.market.drawPile = []
        expect(drawIntoMarket(state, random)).toBeUndefined()
        expect(endGameTriggered(state)).toBe(false)
    })

    it('keeps the old triggers in games set up before the change', () => {
        const state = startedState()
        delete state.eraThreeEndsGame
        state.market.drawPile = [GameOverCard.id]
        state.gemsSpent = 15
        expect(endGameTriggered(state)).toBe(true)
    })

    it('adds the card to a listed running game the same way on every load', () => {
        const stored = structuredClone(startedState('listed').dehydrate())
        delete stored.eraThreeEndsGame
        stored.market.drawPile = [...stored.market.drawPile.filter((cardId) => cardId !== ThirdEraCardId), GameOverCard.id]
        EraThreeEndingGameIds.push('listed')
        const first = Definition.runtime.hydrator.hydrateState(structuredClone(stored))
        const second = Definition.runtime.hydrator.hydrateState(structuredClone(stored))
        EraThreeEndingGameIds.pop()
        expect(first.eraThreeEndsGame).toBe(true)
        expect(first.market.drawPile).toEqual(second.market.drawPile)
        expect(first.market.drawPile.filter((cardId) => cardId === ThirdEraCardId)).toHaveLength(1)
        expect(first.market.drawPile.at(-1)).toBe(GameOverCard.id)
    })

    it('leaves the stored state untouched however often it loads', () => {
        const stored = structuredClone(startedState('listed').dehydrate())
        delete stored.eraThreeEndsGame
        stored.market.drawPile = stored.market.drawPile.filter((cardId) => cardId !== ThirdEraCardId)
        const before = structuredClone(stored)
        EraThreeEndingGameIds.push('listed')
        const loads = [1, 2, 3].map(() => Definition.runtime.hydrator.hydrateState(stored))
        EraThreeEndingGameIds.pop()
        expect(stored).toEqual(before)
        expect(loads[2]!.market.drawPile).toEqual(loads[0]!.market.drawPile)
    })

    it('removes extra copies a listed game picked up', () => {
        const stored = structuredClone(startedState('listed').dehydrate())
        stored.market.drawPile = [ThirdEraCardId, ...stored.market.drawPile, ThirdEraCardId]
        EraThreeEndingGameIds.push('listed')
        const state = Definition.runtime.hydrator.hydrateState(stored)
        EraThreeEndingGameIds.pop()
        expect(state.market.drawPile.filter((cardId) => cardId === ThirdEraCardId)).toHaveLength(1)
    })
})
