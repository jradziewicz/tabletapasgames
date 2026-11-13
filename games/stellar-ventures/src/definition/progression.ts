import type { GameProgress, GameProgression } from '@tabletop/common'
import type { StellarVenturesGameState } from '../model/gameState.js'
import { MachineState } from './states.js'

const ERA_COUNT = 5
// Era 5 is only a Corporation Round before Liquidation (rulebook page 9), so it counts as half
// an Era towards the fraction.
const ERA_UNITS = ERA_COUNT - 0.5

// Game Progress counts whole Eras: the rounds inside an Era interleave too many offer and tax
// steps to place reliably, and an Era count never goes backwards.
export class StellarVenturesProgression implements GameProgression<StellarVenturesGameState> {
    progress(state: StellarVenturesGameState): GameProgress {
        if (
            state.machineState === MachineState.Liquidation ||
            state.machineState === MachineState.EndOfGame
        ) {
            return { fraction: 1, label: 'Liquidation', final: true }
        }
        if (state.machineState === MachineState.InitialAuction) {
            return { fraction: 0, label: 'Initial Auction' }
        }
        const era = Math.min(Math.max(state.era, 1), ERA_COUNT)
        const fraction = (era - 1) / ERA_UNITS
        if (era === ERA_COUNT) return { fraction, label: 'Final era', final: true }
        return { fraction, label: `Era ${era} of ${ERA_COUNT}` }
    }
}
