import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { scoreHuntHitsAtFeast } from './hunt.js'
import { startPointBuy } from './turn.js'
import { FirstEraCardId, SecondEraCardId, ThirdEraCardId } from './market.js'
import { feastBuyerBonus } from './feastBonus.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'battle-axe',
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

describe('battle axe hit tracker', () => {
    it('is on for new games', () => {
        expect(startedState().huntHitsScoreAtFeasts).toBe(true)
    })

    it('scores every player their hit total at each Feast without resetting it', () => {
        const state = startedState()
        const [first, second] = state.players
        first!.huntHits = 3
        second!.huntHits = 0
        const before = first!.victoryPoints
        startPointBuy(state, FirstEraCardId)
        expect(first!.victoryPoints).toBe(before + 3)
        expect(second!.victoryPoints).toBe(0)
        expect(first!.huntHits).toBe(3)
        scoreHuntHitsAtFeast(state, 'era2')
        expect(first!.victoryPoints).toBe(before + 6)
    })

    it('scores the hits once more when the Golden Table ends the game', () => {
        const state = startedState()
        const player = state.players[0]!
        player.huntHits = 2
        const before = player.victoryPoints
        startPointBuy(state, ThirdEraCardId)
        expect(player.victoryPoints).toBe(before + 2)
        expect(state.eraThreeTriggered).toBe(true)
    })

    it('does nothing in older games', () => {
        const state = startedState()
        delete state.huntHitsScoreAtFeasts
        const player = state.players[0]!
        player.huntHits = 4
        const before = player.victoryPoints
        scoreHuntHitsAtFeast(state, FirstEraCardId)
        expect(player.victoryPoints).toBe(before)
    })
})

describe('Feast buyer bonus', () => {
    it('scores the buyer by rank: tool level for the Lantern Feast', () => {
        const state = startedState()
        const [a, b, c] = state.players
        a!.toolLevel = 3
        b!.toolLevel = 1
        c!.toolLevel = 1
        expect(feastBuyerBonus(state, a!.playerId, FirstEraCardId)).toBe(3)
        expect(feastBuyerBonus(state, b!.playerId, FirstEraCardId)).toBe(1)
    })

    it('shares a rank on a tie and gives nothing below third', () => {
        const state = startedState()
        state.players.forEach((player) => (player.toolLevel = 2))
        expect(feastBuyerBonus(state, state.players[1]!.playerId, FirstEraCardId)).toBe(3)
        const five = startedState()
        five.players.forEach((player, index) => (player.toolLevel = 5 - index))
        expect(feastBuyerBonus(five, five.players[2]!.playerId, FirstEraCardId)).toBe(1)
    })

    it('uses share multipliers and claimed mines for the later Feasts', () => {
        const state = startedState()
        expect(feastBuyerBonus(state, state.players[0]!.playerId, SecondEraCardId)).toBe(4)
        expect(feastBuyerBonus(state, state.players[0]!.playerId, ThirdEraCardId)).toBe(5)
    })

    it('does nothing in older games', () => {
        const state = startedState()
        delete state.feastBuyerBonus
        expect(feastBuyerBonus(state, state.players[0]!.playerId, FirstEraCardId)).toBe(0)
    })
})
