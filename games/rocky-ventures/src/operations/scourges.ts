import type { RandomFunction } from '@tabletop/common'
import { shuffle } from '@tabletop/common'
import { RegionId } from '../data/regions.js'
import { ScourgeDefinitionsById } from '../data/scourges.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import type { PlacedScourge } from '../model/board.js'

// Draws the next scourge from the deck (reshuffling the removed pile when empty, doing nothing when
// every scourge is already on the board) and places it in the region.
export function addScourgeToRegion(
    state: HydratedRockyVenturesGameState,
    region: RegionId,
    random: RandomFunction
): PlacedScourge | undefined {
    if (state.scourgeDeck.length === 0) {
        if (state.removedScourges.length === 0) {
            return undefined
        }
        const reshuffled = [...state.removedScourges]
        shuffle(reshuffled, random)
        state.scourgeDeck = reshuffled
        state.removedScourges = []
    }
    const scourgeId = state.scourgeDeck.shift()
    if (scourgeId === undefined) {
        return undefined
    }
    const definition = ScourgeDefinitionsById[scourgeId]
    if (!definition) {
        throw Error(`Unknown scourge ${scourgeId}`)
    }
    const placed: PlacedScourge = { scourgeId, level: definition.level, hits: 0 }
    const regionScourges = state.board.scourgesByRegion[region] ?? []
    state.board.scourgesByRegion[region] = [...regionScourges, placed]
    return placed
}
