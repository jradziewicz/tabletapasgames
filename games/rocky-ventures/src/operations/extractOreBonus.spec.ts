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
            id: 'extract-ore-bonus',
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

// Card 21: +1 ore and +1 tool for the extract.
function extracted(ore: OreKind, level: number, toolLevel: number, cardId = 'd21'): number {
    const state = startedState()
    const playerId = currentPlayerId(state)
    const player = state.getPlayerState(playerId)
    player.toolLevel = toolLevel
    state.borrowedCardId = cardId
    const [nodeId, site] = Object.entries(state.board.mines)[0]!
    site!.token = { id: 'test', ore, level } as never
    site!.ownerPlayerId = playerId
    return oreExtracted(state, playerId, nodeId)
}

describe("a card's +1 ore and +1 tool", () => {
    it("raise the mine's level and the player's limit, and the lower is extracted", () => {
        // A level 3 gold mine becomes 4: a limit of 2 goes to 3, a limit of 3 goes to 4.
        expect(extracted(OreKind.Gold, 3, 2)).toBe(3)
        expect(extracted(OreKind.Gold, 3, 4)).toBe(4)
        // A level 2 gold mine gives 3 with a limit of 3.
        expect(extracted(OreKind.Gold, 2, 4)).toBe(3)
        // A level 3 Mana mine gives 3 with a limit of 2.
        expect(extracted(OreKind.Silver, 3, 4)).toBe(3)
        expect(extracted(OreKind.Silver, 3, 5)).toBe(4)
        // Both can go past 5 for that extract: a level 5 mine with the top tool gives 6.
        expect(extracted(OreKind.Gold, 5, 8)).toBe(6)
    })

    it('work the same for gold and Mana, and for +2 ore and +2 tool', () => {
        // Level 4 gold or Mana with a limit of 3: the mine goes to 5, the limit to 4.
        expect(extracted(OreKind.Gold, 4, 4)).toBe(4)
        expect(extracted(OreKind.Silver, 4, 5)).toBe(4)
        // +2 and +2 (card 26): level 4 goes to 6, a limit of 3 goes to 5.
        expect(extracted(OreKind.Gold, 4, 4, 'd26')).toBe(5)
        expect(extracted(OreKind.Silver, 4, 5, 'd26')).toBe(5)
        // Level 2 goes to 4, under a limit of 5.
        expect(extracted(OreKind.Gold, 2, 4, 'd26')).toBe(4)
    })
})
