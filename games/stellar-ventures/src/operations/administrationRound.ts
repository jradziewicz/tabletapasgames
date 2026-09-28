import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { CorporationId } from '../model/corporation.js'
import { effectiveMiningCapacityForCorporation } from './corporatePowers.js'
import { MachineState } from '../definition/states.js'

// Administration Round step 3 (rulebook page 20): "Reorder Corporations by Mining Capacity
// highest (1st) to lowest (last). Ties maintain order." Array.prototype.sort is a stable sort
// (guaranteed since ES2019), so a tie between two Corporations naturally keeps their existing
// relative position in corporationTurnOrder rather than needing an explicit tiebreaker. Uses
// effectiveMiningCapacityForCorporation rather than the raw board value so Ore Refinement's +3
// is reflected in turn order too.
export function corporationTurnOrderByMiningCapacity(
    state: HydratedStellarVenturesGameState
): CorporationId[] {
    return [...state.corporationTurnOrder].sort(
        (a, b) =>
            effectiveMiningCapacityForCorporation(state, b) -
            effectiveMiningCapacityForCorporation(state, a)
    )
}

// Administration Round step 4 (rulebook page 20): "Pass clockwise to next player." Reuses the
// same turnManager.turnOrder every other "next player clockwise" rule in this game reads from
// (see operations/auction.ts's turnOrderStartingWith, which this wraps).
export function nextDirectorPlayerId(state: HydratedStellarVenturesGameState): string {
    const turnOrder = state.turnManager.turnOrder
    const currentIndex = turnOrder.indexOf(state.directorPlayerId)
    if (currentIndex < 0) {
        return state.directorPlayerId
    }
    return turnOrder[(currentIndex + 1) % turnOrder.length] ?? state.directorPlayerId
}

const AMETHYST_AGENCY_FORMATION_ERA = 3

export function nextStateAfterAdministration(state: HydratedStellarVenturesGameState): MachineState {
    if (state.era === AMETHYST_AGENCY_FORMATION_ERA) {
        return MachineState.FormAmethystAgency
    }
    state.activeCorporationIndex = 0
    return MachineState.IssueShare
}
