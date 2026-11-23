import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { FinalFeastBottomThreeGameIds, migrateRunningGame } from './runningGameMigrations.js'
import { ThirdEraCardId } from './market.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'final-feast-bottom',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 3,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1, 2].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

describe('final Feast in the bottom 3 cards (listed games only)', () => {
    it('moves the final Feast into the bottom 3 and keeps every other card', () => {
        const state = startedState()
        const before = [...state.market.drawPile]
        FinalFeastBottomThreeGameIds.push(state.gameId)
        try {
            migrateRunningGame(state)
            const pile = state.market.drawPile
            expect(pile.indexOf(ThirdEraCardId)).toBeGreaterThanOrEqual(pile.length - 3)
            expect([...pile].sort()).toEqual([...before].sort())
            // Loading again leaves it where it is.
            const once = [...pile]
            migrateRunningGame(state)
            expect(state.market.drawPile).toEqual(once)
        } finally {
            FinalFeastBottomThreeGameIds.pop()
        }
    })
})
