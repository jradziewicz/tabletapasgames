import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { FeastCategories, FeastCategoriesById, feastBuyerBonus, pickFeastCategories } from './feastBonus.js'
import { FirstEraCardId, SecondEraCardId, ThirdEraCardId } from './market.js'

const engine = new GameEngine(Definition.runtime)

function startedState(seed: number): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: `feasts-${seed}`,
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1, 2].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

describe('three possible Feasts per Feast card (new games)', () => {
    it('draws one of the matching three for each card at setup', () => {
        const seen = new Set<string>()
        for (let seed = 1; seed <= 60; seed++) {
            const state = startedState(seed)
            for (const cardId of [FirstEraCardId, SecondEraCardId, ThirdEraCardId]) {
                const id = state.feastCategories?.[cardId]
                expect(FeastCategoriesById[id!]?.cardId).toBe(cardId)
                seen.add(id!)
            }
        }
        expect(seen.size).toBe(FeastCategories.length)
    })

    it('ranks by the drawn Feast with the slot points', () => {
        const state = startedState(1)
        state.feastCategories = { ...pickFeastCategories(() => 0), [FirstEraCardId]: 'weapon' }
        const [a, b, c] = state.players
        a!.weaponLevel = 4
        b!.weaponLevel = 2
        c!.weaponLevel = 1
        a!.toolLevel = 0
        expect(feastBuyerBonus(state, a!.playerId, FirstEraCardId)).toBe(3)
        expect(feastBuyerBonus(state, b!.playerId, FirstEraCardId)).toBe(2)
        expect(feastBuyerBonus(state, c!.playerId, FirstEraCardId)).toBe(1)
    })

    it('counts empty mines from Mana kept, and dev cards in the tableau', () => {
        const state = startedState(2)
        state.feastCategories = { [FirstEraCardId]: 'tool', [SecondEraCardId]: 'gems', [ThirdEraCardId]: 'emptyMines' }
        const [a, b] = state.players
        a!.emptyMines = 2
        b!.emptyMines = 0
        expect(feastBuyerBonus(state, a!.playerId, ThirdEraCardId)).toBe(5)
        state.feastCategories[ThirdEraCardId] = 'devCards'
        expect(FeastCategoriesById['devCards']!.measure(state, a!)).toBe(0)
    })
})
