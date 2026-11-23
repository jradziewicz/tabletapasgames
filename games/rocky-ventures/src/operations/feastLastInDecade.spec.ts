import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { FeastLastInDecadeGameIds, migrateRunningGame } from './runningGameMigrations.js'
import { FirstEraCardId, SecondEraCardId, ThirdEraCardId } from './market.js'
import { CardKind, getCard } from '../data/cards.js'

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

describe('each Feast is the last card of its decade (listed games only)', () => {
    it('moves every Feast to the end of its decade and keeps every other card', () => {
        const state = startedState()
        const before = [...state.market.drawPile]
        FeastLastInDecadeGameIds.push(state.gameId)
        try {
            migrateRunningGame(state)
            const pile = state.market.drawPile
            expect([...pile].sort()).toEqual([...before].sort())
            const decadeOf = (cardId: string) => {
                const card = getCard(cardId)
                return card.kind === CardKind.Development ? card.decade : undefined
            }
            for (const [feastId, decade] of [[FirstEraCardId, 2], [SecondEraCardId, 3], [ThirdEraCardId, 4]] as const) {
                const at = pile.indexOf(feastId)
                expect(at).toBeGreaterThanOrEqual(0)
                expect(pile.slice(at + 1).some((cardId) => decadeOf(cardId) === decade)).toBe(false)
                expect(decadeOf(pile[at - 1]!)).toBe(decade)
            }
            expect(pile.at(-1)).toBe(ThirdEraCardId)
            const once = [...pile]
            migrateRunningGame(state)
            expect(state.market.drawPile).toEqual(once)
        } finally {
            FeastLastInDecadeGameIds.pop()
        }
    })
})
