import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { OreKind } from '../data/mineTokens.js'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { oreExtracted } from './extract.js'
import { currentPlayerId } from './turn.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'extract-cap',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 3,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

// Card 21: +1 ore and +1 tool for the extract. Tool level 4 takes 3 gold or 2 Mana.
function extracted(ore: OreKind, level: number): number {
    const state = startedState()
    const playerId = currentPlayerId(state)
    const player = state.getPlayerState(playerId)
    player.toolLevel = 4
    state.borrowedCardId = 'd21'
    const [nodeId, site] = Object.entries(state.board.mines)[0]!
    site!.token = { id: 'test', ore, level } as never
    site!.ownerPlayerId = playerId
    return oreExtracted(state, playerId, nodeId)
}

describe('ore extracted with a card bonus', () => {
    it("never goes over the mine's level", () => {
        expect(extracted(OreKind.Silver, 3)).toBe(3)
        expect(extracted(OreKind.Gold, 2)).toBe(2)
    })

    it('still adds to what the tool can take from a bigger mine', () => {
        expect(extracted(OreKind.Silver, 4)).toBe(4)
        expect(extracted(OreKind.Gold, 5)).toBe(5)
    })
})
