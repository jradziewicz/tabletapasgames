import { Color, Prng, type GameAction } from '@tabletop/common'
import {
    ActionKind,
    Habitats,
    RegionLabels,
    getSpace,
    habitatNeighbors,
    spacesInTurnOrder
} from '../data/board.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { InsectKind } from '../model/board.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import {
    breedableHabitatIds,
    cannibalizableHabitatIds,
    evenVictims,
    jumpError,
    jumpOrigins,
    legalCubeSpaceIds,
    requiredRelocations,
    swarmableHabitatIds,
    type Hop
} from '../operations/rules.js'
import type { LocustTable } from './table.js'

export function clearHabitats(state: HydratedLocustGameState) {
    for (const habitat of state.board.habitats) {
        habitat.occupants = []
    }
}

export function put(
    state: HydratedLocustGameState,
    habitatId: string,
    color: Color,
    kind: InsectKind,
    amount: number = 1
) {
    state.board.add(habitatId, color, kind, amount)
}

// Moves the Region I cubes to the same spaces of another region and makes it the Active Region.
export function makeActiveRegion(state: HydratedLocustGameState, region: number) {
    for (const space of spacesInTurnOrder(0)) {
        const color = state.board.cubes[space.id]
        if (color !== undefined) {
            delete state.board.cubes[space.id]
            state.board.cubes[space.id.replace(/^I-/, `${RegionLabels[region]}-`)] = color
        }
    }
    state.activeRegion = region
    for (const spaceId of Object.keys(state.board.bonusTokens)) {
        if (getSpace(spaceId).region <= region) {
            delete state.board.bonusTokens[spaceId]
        }
    }
}

export function emptyActionFor(kind: ActionKind): {
    type: ActionType
    fields: Record<string, unknown>
} {
    switch (kind) {
        case ActionKind.JumpOrBreed:
            return { type: ActionType.Jump, fields: { hops: [] } }
        case ActionKind.Hatch:
            return { type: ActionType.Hatch, fields: { count: 0 } }
        case ActionKind.Cannibalize:
            return { type: ActionType.Cannibalize, fields: { attacks: [] } }
        case ActionKind.Swarm:
            return { type: ActionType.Swarm, fields: { habitatIds: [] } }
    }
}

export function passTurn(table: LocustTable, spaceId?: string) {
    const target = spaceId ?? legalCubeSpaceIds(table.view)[0]!
    table.act(ActionType.PlaceCube, { spaceId: target, alternative: false })
    const { type, fields } = emptyActionFor(table.view.pendingAction!.kind)
    table.act(type, fields)
}

function pick<T>(items: T[], prng: Prng): T | undefined {
    return items.length === 0 ? undefined : items[prng.randInt(items.length)]
}

function randomHops(state: HydratedLocustGameState, color: Color, prng: Prng): Hop[] {
    const pending = state.pendingAction!
    const hops: Hop[] = []
    for (
        let attempt = 0;
        attempt < pending.level * 4 && hops.length < pending.level;
        attempt += 1
    ) {
        const from = pick(jumpOrigins(state, color, pending), prng)
        const to = from === undefined ? undefined : pick(habitatNeighbors(from), prng)
        if (from === undefined || to === undefined) {
            break
        }
        const candidate = [...hops, { from, to }]
        if (!jumpError(state, color, pending, candidate)) {
            hops.push({ from, to })
        }
    }
    return hops
}

export function randomMove(
    state: HydratedLocustGameState,
    prng: Prng
): { type: string; fields: Record<string, unknown> } {
    switch (state.machineState) {
        case MachineState.ChooseSpace: {
            const spaceId = pick(legalCubeSpaceIds(state), prng)!
            const alternative = state.isAlternativeActionAvailable() && prng.random() < 0.15
            return { type: ActionType.PlaceCube, fields: { spaceId, alternative } }
        }
        case MachineState.PerformAction: {
            const pending = state.pendingAction!
            const color = state.activeColony.color
            switch (pending.kind) {
                case ActionKind.JumpOrBreed: {
                    if (prng.random() < 0.5) {
                        return {
                            type: ActionType.Jump,
                            fields: { hops: randomHops(state, color, prng) }
                        }
                    }
                    const options = breedableHabitatIds(state, color, pending)
                    const count = Math.min(pending.level, state.colony(color).supply)
                    const habitatIds =
                        options.length === 0
                            ? []
                            : Array.from({ length: count }, () => pick(options, prng)!)
                    return { type: ActionType.Breed, fields: { habitatIds } }
                }
                case ActionKind.Hatch:
                    return {
                        type: ActionType.Hatch,
                        fields: { count: Math.min(pending.level, state.colony(color).dead) }
                    }
                case ActionKind.Cannibalize: {
                    const habitatIds = cannibalizableHabitatIds(state, color).slice(
                        0,
                        pending.level
                    )
                    const attacks = habitatIds.map((habitatId) => ({
                        habitatId,
                        victims: evenVictims(state, color, habitatId)
                    }))
                    return { type: ActionType.Cannibalize, fields: { attacks } }
                }
                case ActionKind.Swarm:
                    return {
                        type: ActionType.Swarm,
                        fields: { habitatIds: swarmableHabitatIds(state).slice(0, pending.level) }
                    }
            }
            break
        }
        case MachineState.RelocateLocusts: {
            const swarm = state.swarm!
            const color = swarm.relocators[0]!
            const destinations: string[] = []
            const room = new Map(
                Habitats.map((habitat) => [
                    habitat.id,
                    habitat.id === swarm.habitatId ? 0 : state.freeRoom(habitat.id)
                ])
            )
            const needed = requiredRelocations(state, color, swarm.habitatId)
            while (destinations.length < needed) {
                const open = [...room]
                    .filter(([, free]) => free > 0)
                    .map(([habitatId]) => habitatId)
                const destination = pick(open, prng)!
                room.set(destination, room.get(destination)! - 1)
                destinations.push(destination)
            }
            return { type: ActionType.RelocateLocusts, fields: { destinations } }
        }
        case MachineState.AssignDuelScoring: {
            const playerId = state.activePlayerIds[0]!
            return {
                type: ActionType.AssignDuelScoring,
                fields: { vigorColor: pick(state.coloniesOf(playerId), prng)!.color }
            }
        }
    }
    throw Error(`No random move in ${state.machineState}`)
}

export function playRandomGame(
    table: LocustTable,
    seed: number,
    maxActions: number = 500
): GameAction[] {
    const prng = new Prng({ seed, invocations: 0 })
    let count = 0
    while (!table.state.result) {
        if (count++ > maxActions) {
            throw Error(`Game did not finish within ${maxActions} actions`)
        }
        const { type, fields } = randomMove(table.view, prng)
        table.act(type, fields)
    }
    return table.processed
}
