import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { getCard, CardActionKind, StartingPlayerCardId, cardActionsFor, type DevelopmentCard } from '../data/cards.js'
import { investInMarketCard, reasonStackInvalid, stackableCardIds, StackCardGemCost } from './invest.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'stacking',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 1,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1, 2].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    const state = Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
    const player = state.players[0]!
    state.activePlayerIds = [player.playerId]
    player.money = 100
    player.gems = 3
    player.pawnIndex = 0
    state.market.slots[0] = 'd03' // extract + hunt
    return state
}

describe('stacking a bought card', () => {
    it('never offers the mat, a stack, or a game set up before the rule', () => {
        const state = startedState()
        const player = state.players[0]!
        expect(stackableCardIds(state, player.playerId)).not.toContain(StartingPlayerCardId)
        expect(stackableCardIds(state, player.playerId)).toContain('p3')
        player.stackedCards = { p3: 'p2' }
        expect(stackableCardIds(state, player.playerId)).not.toContain('p3')
        delete state.cardStacking
        expect(stackableCardIds(state, player.playerId)).toEqual([])
    })

    it('needs 3 gems', () => {
        const state = startedState()
        const player = state.players[0]!
        player.gems = StackCardGemCost - 1
        expect(reasonStackInvalid(state, player.playerId, 0, 'p3')).toBe('Stacking a card costs 3 gems')
    })

    it('puts the card on top, spends the gems and keeps one spot in the row', () => {
        const state = startedState()
        const player = state.players[0]!
        const row = player.tableau.length
        const spent = state.gemsSpent
        investInMarketCard(state, player.playerId, 0, undefined, 'p3')
        expect(player.tableau).toHaveLength(row)
        expect(player.tableau).toContain('d03')
        expect(player.tableau).not.toContain('p3')
        expect(player.stackedCards).toEqual({ d03: 'p3' })
        expect(player.gems).toBe(0)
        expect(state.gemsSpent).toBe(spent + StackCardGemCost)
    })

    it('gives the top action of the card underneath plus all of the top card', () => {
        const state = startedState()
        const player = state.players[0]!
        investInMarketCard(state, player.playerId, 0, undefined, 'p3')
        player.pawnIndex = player.tableau.indexOf('d03')
        const kinds = state.actionCardActions(player.playerId).map((action) => action.kind)
        expect(kinds).toEqual([
            CardActionKind.LayTrack,
            ...cardActionsFor(getCard('d03') as DevelopmentCard, true).map((action) => action.kind)
        ])
    })
})
