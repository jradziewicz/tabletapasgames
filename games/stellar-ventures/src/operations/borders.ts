import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { effectiveMiningCapacityForCorporation } from './corporatePowers.js'

// Borders & Taxes (page 2): a Border closes the moment any player-controlled Corporation reaches
// its Activation Value on the Mining Capacity track, and never reopens.
export function closeBordersReachedByCorporations(state: HydratedStellarVenturesGameState): void {
    const borders = state.boardMapDefinition.borders
    if (borders.length === 0) {
        return
    }
    const highestMiningCapacity = Math.max(
        0,
        ...state.corporations
            .filter((corporation) => corporation.active)
            .map((corporation) => effectiveMiningCapacityForCorporation(state, corporation.id))
    )
    for (const border of borders) {
        if (highestMiningCapacity >= border.activationMiningCapacity) {
            state.board.closeBorder(border.level)
        }
    }
}
