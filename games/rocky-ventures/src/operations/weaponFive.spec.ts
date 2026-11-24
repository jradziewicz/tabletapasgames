import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { huntRule } from './hunt.js'
import { currentPlayerId } from './turn.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'weapon-five',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 2,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

function applyRow(state: HydratedRockyVenturesGameState): number[] {
    const playerId = currentPlayerId(state)
    return [1, 2, 3, 4, 5].map((level) => {
        state.getPlayerState(playerId).weaponLevel = level
        return huntRule(state, playerId).apply
    })
}

describe('tokens applied by weapon level', () => {
    it('is 1/1/2/2/3 in new games', () => {
        expect(applyRow(startedState())).toEqual([1, 1, 2, 2, 3])
    })

    it('stays 1/1/2/2/2 in older games', () => {
        const state = startedState()
        delete state.weaponFiveAppliesThree
        expect(applyRow(state)).toEqual([1, 1, 2, 2, 2])
    })
})
