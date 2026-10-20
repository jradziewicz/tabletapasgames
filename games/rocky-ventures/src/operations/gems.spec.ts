import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { GemSupplySize, gainGems, gemSupplyLeft } from './gems.js'

const engine = new GameEngine(Definition.runtime)

function startedState(playerCount: number): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: `gems-${playerCount}`,
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 1,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: Array.from({ length: playerCount }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

describe('gem supply', () => {
    it('starts with 15 gems less the 2 each player holds', () => {
        expect(gemSupplyLeft(startedState(4))).toBe(GemSupplySize - 8)
    })

    it('counts spent gems as gone from the game', () => {
        const state = startedState(2)
        state.gemsSpent = 5
        expect(gemSupplyLeft(state)).toBe(GemSupplySize - 4 - 5)
    })

    it('gives no gem when the supply is empty, and never above 3', () => {
        const state = startedState(2)
        const playerId = state.players[0]!.playerId
        state.gemsSpent = GemSupplySize - 4
        expect(gemSupplyLeft(state)).toBe(0)
        expect(gainGems(state, playerId, 1)).toBe(0)
        expect(state.getPlayerState(playerId).gems).toBe(2)

        state.gemsSpent = 0
        expect(gainGems(state, playerId, 1)).toBe(1)
        expect(gainGems(state, playerId, 1)).toBe(0)
        expect(state.getPlayerState(playerId).gems).toBe(3)
    })
})
