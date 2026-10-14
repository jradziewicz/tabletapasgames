import { Color, assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { InsectKind } from '../model/board.js'
import type { HydratedLocustGameState, SwarmState } from '../model/gameState.js'
import { requiredRelocations } from './rules.js'
import { finishCubeTurn } from './turn.js'

export function startSwarm(state: HydratedLocustGameState, habitatIds: string[]) {
    const [first, ...queue] = habitatIds
    if (first === undefined) {
        return
    }
    state.swarm = { habitatId: first, queue, relocators: [] }
    transformSwarmingHabitat(state)
    advanceSwarm(state)
}

// Nymphs and locusts die, grasshoppers turn into locusts; the active colony relocates first,
// then the others in quadrant priority order.
function transformSwarmingHabitat(state: HydratedLocustGameState) {
    const swarm = currentSwarm(state)
    for (const { color, died } of state.board.swarmHabitat(swarm.habitatId)) {
        state.colony(color).die(died)
    }
    const colors = state.board.habitat(swarm.habitatId).occupants.map((occupant) => occupant.color)
    const activeColor = state.activeColony.color
    swarm.relocators = [
        ...colors.filter((color) => color === activeColor),
        ...colors.filter((color) => color !== activeColor)
    ]
}

function currentSwarm(state: HydratedLocustGameState): SwarmState {
    assertExists(state.swarm, 'No swarm is being resolved')
    return state.swarm
}

function killStranded(state: HydratedLocustGameState, color: Color, habitatId: string) {
    const stranded = state.board.count(habitatId, color, InsectKind.Locust)
    state.board.remove(habitatId, color, InsectKind.Locust, stranded)
    state.colony(color).die(stranded)
}

// Resolves every relocation that needs no decision; stops at the first colony with a choice to make.
export function advanceSwarm(state: HydratedLocustGameState) {
    while (state.swarm) {
        const swarm = state.swarm
        const relocator = swarm.relocators[0]
        if (relocator !== undefined) {
            if (requiredRelocations(state, relocator, swarm.habitatId) > 0) {
                state.activePlayerIds = [state.colony(relocator).playerId]
                return
            }
            killStranded(state, relocator, swarm.habitatId)
            swarm.relocators.shift()
            continue
        }
        const next = swarm.queue.shift()
        if (next === undefined) {
            delete state.swarm
            break
        }
        if (state.isCrowded(next)) {
            swarm.habitatId = next
            transformSwarmingHabitat(state)
        }
    }
    state.activePlayerIds = [state.activeColony.playerId]
}

export function relocate(state: HydratedLocustGameState, destinations: string[]) {
    const swarm = currentSwarm(state)
    const color = swarm.relocators[0]
    assertExists(color, 'No colony is relocating')
    for (const destination of destinations) {
        state.board.remove(swarm.habitatId, color, InsectKind.Locust)
        state.board.add(destination, color, InsectKind.Locust)
    }
    killStranded(state, color, swarm.habitatId)
    swarm.relocators.shift()
    advanceSwarm(state)
}

export function stateAfterSwarmProgress(state: HydratedLocustGameState): MachineState {
    return state.swarm ? MachineState.RelocateLocusts : finishCubeTurn(state)
}
