import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './gameDefinition.js'
import { StartingMoney } from '../data/setup.js'

const engine = new GameEngine(Definition.runtime)

function startedState(playerCount: number, seed: number) {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: `start-${playerCount}-${seed}`,
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed,
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
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState)
}

describe.each([2, 3, 4, 5])('starting money with %i players', (playerCount) => {
    it('gives the first player to act $15 and each later seat $1 more', () => {
        for (const seed of [1, 2, 3]) {
            const state = startedState(playerCount, seed)
            const moneyInTurnOrder = state.turnManager.turnOrder.map(
                (playerId) => state.getPlayerState(playerId).money
            )
            expect(moneyInTurnOrder).toEqual(
                Array.from({ length: playerCount }, (_, seat) => StartingMoney + seat)
            )
            if (playerCount === 2) {
                expect(state.dummy?.money).toBe(StartingMoney)
            }
        }
    })
})
