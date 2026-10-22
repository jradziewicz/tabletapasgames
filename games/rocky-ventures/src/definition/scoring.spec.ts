import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { finalScores } from '../operations/endGame.js'
import { RockyVenturesScoring } from './scoring.js'

const engine = new GameEngine(Definition.runtime)

function startedState(playerCount: number): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: `scoring-${playerCount}`,
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

describe('final scores', () => {
    it("records each seat's total Victory Points and leaves the dummy out", () => {
        const state = startedState(2)
        state.players[0].victoryPoints = 12
        state.players[1].victoryPoints = 7

        const scores = new RockyVenturesScoring().finalScores(structuredClone(state.dehydrate()))

        const expected = Object.fromEntries(
            finalScores(state)
                .filter((score) => score.playerId !== 'dummy')
                .map((score) => [score.playerId, score.total])
        )
        expect(scores).toEqual(expected)
        expect(Object.keys(scores).sort()).toEqual(['p0', 'p1'])
        expect(scores[state.players[0].playerId]).toBeGreaterThanOrEqual(12)
    })
})
