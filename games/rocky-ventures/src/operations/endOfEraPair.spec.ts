import { GameEngine, Prng, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { MarketSize } from '../data/setup.js'
import { FirstEraCardId, SecondEraCardId, removeFromMarket } from './market.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'era-pair',
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

describe('both End of Era cards in the market', () => {
    it('removes both, discards era 1 and triggers the era 2 point buy', () => {
        const state = startedState()
        const pile = state.market.drawPile.filter((id) => id !== FirstEraCardId && id !== SecondEraCardId)
        state.market.drawPile = [SecondEraCardId, ...pile]
        state.market.slots[2] = FirstEraCardId
        delete state.pointBuy

        removeFromMarket(state, 0, new Prng(state.prng).random)

        expect(state.market.slots).not.toContain(FirstEraCardId)
        expect(state.market.slots).not.toContain(SecondEraCardId)
        expect(state.market.slots.length).toBe(MarketSize)
        expect((state as { pointBuy?: { cardId: string } }).pointBuy?.cardId).toBe(SecondEraCardId)
    })

    it('leaves the market alone when only one is there', () => {
        const state = startedState()
        state.market.slots[2] = FirstEraCardId
        state.market.drawPile = state.market.drawPile.filter((id) => id !== FirstEraCardId && id !== SecondEraCardId)
        delete state.pointBuy
        removeFromMarket(state, 0, new Prng(state.prng).random)
        expect(state.market.slots).toContain(FirstEraCardId)
        expect(state.pointBuy).toBeUndefined()
    })
})
