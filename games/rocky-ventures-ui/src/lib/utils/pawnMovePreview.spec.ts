import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition, type HydratedRockyVenturesGameState } from '@tabletop/rocky-ventures'
import { pawnMoveEndsTurnReason } from './pawnMovePreview.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'preview',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 1,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

// Card II is the starting Claim Mine card.
describe('pawnMoveEndsTurnReason', () => {
    it('allows a Claim Mine move when a mine can be claimed', () => {
        const state = startedState()
        const playerId = state.activePlayerIds[0]!
        expect(pawnMoveEndsTurnReason(state, playerId, 1, [])).toBeUndefined()
    })

    it('explains when there are no claim tokens left', () => {
        const state = startedState()
        const playerId = state.activePlayerIds[0]!
        state.getPlayerState(playerId).claimTokens = 0
        expect(pawnMoveEndsTurnReason(state, playerId, 1, [])).toBe('you have no claim tokens left')
    })

    it('explains when no open mine is affordable', () => {
        const state = startedState()
        const playerId = state.activePlayerIds[0]!
        state.getPlayerState(playerId).money = 1
        expect(pawnMoveEndsTurnReason(state, playerId, 1, [])).toMatch(/cheapest open mine costs \$2/)
    })
})
