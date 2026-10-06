import { getPrng, shuffle, type GameExploration, type RandomFunction } from '@tabletop/common'
import type { StellarVenturesGameState } from '../model/gameState.js'
import { HexType } from '../model/board.js'
import { ALIEN_AGREEMENT_TILE_CHEVRONS, ALIEN_SHIPYARD_TILE_CHEVRONS } from './initializer.js'

// Exploration mode starts from a copy of the real game, which carries every face-down tile's real
// chevron count. Without this, flipping a tile in an exploration showed exactly what the real
// game would reveal. So each exploration re-deals everything still hidden at random from the
// tiles nobody has seen yet:
//   - Alien Agreement Tiles: the face-down tiles on Alien Planets plus the ones still in the box
//     (unusedAlienAgreementTileChevrons, which Nebular Explorers draws from) are pooled,
//     shuffled and dealt back out in the same places.
//   - Alien Shipyard Tiles: the box tiles aren't recorded, so the unseen pool is the full set of
//     5 minus the ones already revealed; each still-hidden section gets a random tile from it.
// Revealed tiles and everything else in the state are left exactly as they are.
export class StellarVenturesGameExploration implements GameExploration<StellarVenturesGameState> {
    createFromCanonicalState(state: StellarVenturesGameState): StellarVenturesGameState {
        return reshuffleHiddenTiles(state, getPrng())
    }
}

export function reshuffleHiddenTiles(
    state: StellarVenturesGameState,
    random: RandomFunction
): StellarVenturesGameState {
    const result = structuredClone(state)

    // Alien Agreement Tiles.
    const hiddenHexes = Object.values(result.board.hexes).filter(
        (hex) =>
            hex.type === HexType.AlienPlanet &&
            hex.alienAgreementTileHidden === true &&
            !hex.alienAgreementTileRemoved &&
            hex.alienAgreementTileChevrons !== undefined
    )
    const agreementPool = [
        ...hiddenHexes.map((hex) => hex.alienAgreementTileChevrons!),
        ...result.unusedAlienAgreementTileChevrons
    ]
    // Sanity: the pool can never hold more tiles than physically exist.
    if (agreementPool.length <= ALIEN_AGREEMENT_TILE_CHEVRONS.length) {
        shuffle(agreementPool, random)
        for (const hex of hiddenHexes) {
            hex.alienAgreementTileChevrons = agreementPool.shift()!
        }
        result.unusedAlienAgreementTileChevrons = agreementPool
    }

    // Alien Shipyard Tiles.
    const sections = result.shipyard.sections.filter(
        (section) => section.alienTileChevrons !== undefined
    )
    const unseen = [...ALIEN_SHIPYARD_TILE_CHEVRONS]
    for (const section of sections) {
        if (section.alienTileRevealed) {
            const index = unseen.indexOf(section.alienTileChevrons!)
            if (index >= 0) unseen.splice(index, 1)
        }
    }
    shuffle(unseen, random)
    for (const section of sections) {
        if (!section.alienTileRevealed && unseen.length > 0) {
            section.alienTileChevrons = unseen.shift()!
        }
    }

    return result
}
