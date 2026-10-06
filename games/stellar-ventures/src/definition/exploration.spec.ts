import { describe, expect, it } from 'vitest'
import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    getPrng,
    type Game,
    type UninitializedGameState
} from '@tabletop/common'
import { StellarVenturesGameInitializer, ALIEN_SHIPYARD_TILE_CHEVRONS } from './initializer.js'
import { reshuffleHiddenTiles } from './exploration.js'
import { HexType } from '../model/board.js'
import type { StellarVenturesGameState } from '../model/gameState.js'

function startingState(): StellarVenturesGameState {
    const game: Game = {
        id: 'game-1',
        typeId: 'stellarventures',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Exploration Test',
        players: Array.from({ length: 4 }, (_, i) => ({
            id: `p${i + 1}`,
            isHuman: true,
            userId: `u${i + 1}`,
            name: `Player ${i + 1}`,
            status: PlayerStatus.Joined
        })),
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }
    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }
    const hydrated = new StellarVenturesGameInitializer().initializeGameState(game, state)
    return structuredClone(hydrated.dehydrate()) as StellarVenturesGameState
}

function hiddenAgreementChevrons(state: StellarVenturesGameState) {
    return Object.values(state.board.hexes)
        .filter((hex) => hex.type === HexType.AlienPlanet && hex.alienAgreementTileHidden)
        .map((hex) => hex.alienAgreementTileChevrons)
}

describe('exploration hidden tiles', () => {
    it('re-deals hidden Agreement and Shipyard tiles from the same unseen pool', () => {
        const original = startingState()
        const allAgreement = [...hiddenAgreementChevrons(original), ...original.unusedAlienAgreementTileChevrons]

        let differed = false
        for (let seed = 1; seed <= 20; seed++) {
            const explored = reshuffleHiddenTiles(original, getPrng(seed))
            const exploredAgreement = [
                ...hiddenAgreementChevrons(explored),
                ...explored.unusedAlienAgreementTileChevrons
            ]
            // Same physical tiles, possibly in different places.
            expect([...exploredAgreement].sort()).toEqual([...allAgreement].sort())
            expect(explored.unusedAlienAgreementTileChevrons).toHaveLength(
                original.unusedAlienAgreementTileChevrons.length
            )
            for (const section of explored.shipyard.sections) {
                if (section.alienTileChevrons !== undefined) {
                    expect(ALIEN_SHIPYARD_TILE_CHEVRONS).toContain(section.alienTileChevrons)
                }
            }
            if (
                JSON.stringify(hiddenAgreementChevrons(explored)) !==
                JSON.stringify(hiddenAgreementChevrons(original))
            ) {
                differed = true
            }
        }
        // Over 20 explorations the real layout is not simply copied every time.
        expect(differed).toBe(true)
        // The real game state itself is never touched.
        expect(hiddenAgreementChevrons(startingState())).toEqual(hiddenAgreementChevrons(original))
    })

    it('leaves tiles that are already face up alone', () => {
        const original = startingState()
        const hex = Object.values(original.board.hexes).find(
            (candidate) => candidate.type === HexType.AlienPlanet && candidate.alienAgreementTileHidden
        )!
        hex.alienAgreementTileHidden = false
        const revealedValue = hex.alienAgreementTileChevrons
        const section = original.shipyard.sections.find((s) => s.alienTileChevrons !== undefined)!
        section.alienTileRevealed = true
        const revealedShipyard = section.alienTileChevrons

        for (let seed = 1; seed <= 10; seed++) {
            const explored = reshuffleHiddenTiles(original, getPrng(seed))
            expect(explored.board.hexes[hex.id]!.alienAgreementTileChevrons).toBe(revealedValue)
            expect(
                explored.shipyard.sections.find((s) => s.level === section.level)!.alienTileChevrons
            ).toBe(revealedShipyard)
        }
    })
})
