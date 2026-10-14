import { Color } from '@tabletop/common'
import * as Type from 'typebox'
import {
    ActionKind,
    ActionSpaces,
    HabitatColor,
    Habitats,
    areLinked,
    getHabitat,
    getSpace
} from '../data/board.js'
import { AlternativeActionLevel, LevelBoost, OpenRuleDefaults } from '../data/rules.js'
import { InsectKind, occupantDiscs } from '../model/board.js'
import type { HydratedLocustGameState, PendingAction } from '../model/gameState.js'
import { breedingZone, levelBoostRegion, swarmingZone } from './zones.js'

export type Hop = Type.Static<typeof Hop>
export const Hop = Type.Object({ from: Type.String(), to: Type.String() })

export type Victim = Type.Static<typeof Victim>
export const Victim = Type.Object({
    color: Type.Enum(Color),
    kind: Type.Enum(InsectKind),
    count: Type.Number()
})

export type Attack = Type.Static<typeof Attack>
export const Attack = Type.Object({
    habitatId: Type.String(),
    victims: Type.Array(Victim)
})

export function legalCubeSpaceIds(state: HydratedLocustGameState): string[] {
    return ActionSpaces.filter(
        (space) => space.region > state.activeRegion && state.board.isSpaceFree(space.id)
    ).map((space) => space.id)
}

export function pendingActionFor(
    state: HydratedLocustGameState,
    spaceId: string,
    alternative: boolean
): PendingAction {
    const space = getSpace(spaceId)
    if (!space.kind) {
        throw Error(`Action space ${spaceId} has no action`)
    }
    const boost = space.region === levelBoostRegion(state.activeRegion) ? LevelBoost : 0
    if (alternative) {
        const alternativeBoost = OpenRuleDefaults.alternativeActionBoosted ? boost : 0
        return {
            spaceId,
            kind: ActionKind.JumpOrBreed,
            level: AlternativeActionLevel + alternativeBoost,
            alternative
        }
    }
    return {
        spaceId,
        kind: space.kind,
        level: space.level + boost,
        color: space.color,
        alternative
    }
}

function matchesActionColor(pending: PendingAction, habitatColor: HabitatColor): boolean {
    return pending.color === undefined || pending.color === habitatColor
}

function checkCount(count: number, level: number): string | undefined {
    if (count > level) {
        return `At most ${level} allowed`
    }
    if (count === 0 && !OpenRuleDefaults.allowEmptyAction) {
        return 'The action must do something'
    }
    return undefined
}

export function jumpError(
    state: HydratedLocustGameState,
    color: Color,
    pending: PendingAction,
    hops: Hop[]
): string | undefined {
    const countError = checkCount(hops.length, pending.level)
    if (countError) {
        return countError
    }
    const moved = new Map<string, number>()
    const delta = (habitatId: string) => moved.get(habitatId) ?? 0
    for (const hop of hops) {
        const from = getHabitat(hop.from)
        if (!matchesActionColor(pending, from.color)) {
            return `Jumps must start in a ${pending.color} habitat`
        }
        if (state.board.count(hop.from, color, InsectKind.Grasshopper) + delta(hop.from) <= 0) {
            return `No grasshopper to jump from ${hop.from}`
        }
        if (!areLinked(hop.from, hop.to)) {
            return `${hop.from} is not linked to ${hop.to}`
        }
        const discsAfter = state.board.discsIn(hop.to) + delta(hop.to) + 1
        if (discsAfter > state.habitatCapacity(hop.to)) {
            return `${hop.to} would become crowded`
        }
        moved.set(hop.from, delta(hop.from) - 1)
        moved.set(hop.to, delta(hop.to) + 1)
    }
    return undefined
}

export function jumpOrigins(
    state: HydratedLocustGameState,
    color: Color,
    pending: PendingAction
): string[] {
    return Habitats.filter(
        (habitat) =>
            matchesActionColor(pending, habitat.color) &&
            state.board.count(habitat.id, color, InsectKind.Grasshopper) > 0
    ).map((habitat) => habitat.id)
}

export function breedableHabitatIds(
    state: HydratedLocustGameState,
    color: Color,
    pending: PendingAction
): string[] {
    const zone = breedingZone(state.activeRegion)
    return Habitats.filter(
        (habitat) =>
            !habitat.island &&
            matchesActionColor(pending, habitat.color) &&
            zone.includes(habitat.region) &&
            state.board.count(habitat.id, color, InsectKind.Grasshopper) +
                state.board.count(habitat.id, color, InsectKind.Locust) >
                0
    ).map((habitat) => habitat.id)
}

export function breedError(
    state: HydratedLocustGameState,
    color: Color,
    pending: PendingAction,
    habitatIds: string[]
): string | undefined {
    const countError = checkCount(habitatIds.length, pending.level)
    if (countError) {
        return countError
    }
    if (habitatIds.length > state.colony(color).supply) {
        return 'Not enough discs in supply'
    }
    const allowed = breedableHabitatIds(state, color, pending)
    const invalid = habitatIds.find((habitatId) => !allowed.includes(habitatId))
    return invalid ? `Cannot breed in ${invalid}` : undefined
}

export function hatchError(
    state: HydratedLocustGameState,
    color: Color,
    pending: PendingAction,
    count: number
): string | undefined {
    if (!Number.isInteger(count) || count < 0) {
        return 'Invalid hatch count'
    }
    const countError = checkCount(count, pending.level)
    if (countError) {
        return countError
    }
    return count > state.colony(color).dead ? 'Not enough dead discs' : undefined
}

export function isOpponent(state: HydratedLocustGameState, attacker: Color, other: Color): boolean {
    if (attacker === other) {
        return false
    }
    if (state.isDuel && !OpenRuleDefaults.duelCannibalizeOwnSecondColor) {
        return state.colony(attacker).playerId !== state.colony(other).playerId
    }
    return true
}

export function cannibalizableHabitatIds(state: HydratedLocustGameState, color: Color): string[] {
    return Habitats.filter(
        (habitat) => state.board.count(habitat.id, color, InsectKind.Locust) > 0
    ).map((habitat) => habitat.id)
}

export function requiredVictims(
    state: HydratedLocustGameState,
    color: Color,
    habitatId: string
): number {
    const opposing = state.board
        .habitat(habitatId)
        .occupants.filter((occupant) => isOpponent(state, color, occupant.color))
        .reduce((sum, occupant) => sum + occupantDiscs(occupant), 0)
    return Math.min(state.board.count(habitatId, color, InsectKind.Locust), opposing)
}

// "As evenly as possible": an opponent may lose two or more fewer insects than another only when it has none left.
function attackError(
    state: HydratedLocustGameState,
    color: Color,
    attack: Attack
): string | undefined {
    if (state.board.count(attack.habitatId, color, InsectKind.Locust) === 0) {
        return `You have no locust in ${attack.habitatId}`
    }
    const takenByColor = new Map<Color, number>()
    for (const victim of attack.victims) {
        if (!Number.isInteger(victim.count) || victim.count <= 0) {
            return 'Invalid victim count'
        }
        if (!isOpponent(state, color, victim.color)) {
            return `Cannot cannibalize ${victim.color}`
        }
        const sameKind = attack.victims
            .filter((other) => other.color === victim.color && other.kind === victim.kind)
            .reduce((sum, other) => sum + other.count, 0)
        if (sameKind > state.board.count(attack.habitatId, victim.color, victim.kind)) {
            return `Not enough ${victim.color} ${victim.kind}s in ${attack.habitatId}`
        }
        takenByColor.set(victim.color, (takenByColor.get(victim.color) ?? 0) + victim.count)
    }
    const total = [...takenByColor.values()].reduce((sum, taken) => sum + taken, 0)
    if (total !== requiredVictims(state, color, attack.habitatId)) {
        return `You must remove exactly ${requiredVictims(state, color, attack.habitatId)} insects in ${attack.habitatId}`
    }
    const opponents = state.board
        .habitat(attack.habitatId)
        .occupants.filter((occupant) => isOpponent(state, color, occupant.color))
    for (const short of opponents) {
        const shortTaken = takenByColor.get(short.color) ?? 0
        if (shortTaken === occupantDiscs(short)) {
            continue
        }
        const uneven = opponents.some(
            (other) => (takenByColor.get(other.color) ?? 0) >= shortTaken + 2
        )
        if (uneven) {
            return 'Cannibalizing must be spread as evenly as possible between opponents'
        }
    }
    return undefined
}

export function cannibalizeError(
    state: HydratedLocustGameState,
    color: Color,
    pending: PendingAction,
    attacks: Attack[]
): string | undefined {
    const countError = checkCount(attacks.length, pending.level)
    if (countError) {
        return countError
    }
    if (new Set(attacks.map((attack) => attack.habitatId)).size !== attacks.length) {
        return 'Each habitat can only be chosen once'
    }
    for (const attack of attacks) {
        const error = attackError(state, color, attack)
        if (error) {
            return error
        }
    }
    return undefined
}

export function swarmableHabitatIds(state: HydratedLocustGameState): string[] {
    const zone = swarmingZone(state.activeRegion)
    return Habitats.filter(
        (habitat) => zone.includes(habitat.region) && state.isCrowded(habitat.id)
    ).map((habitat) => habitat.id)
}

export function swarmError(
    state: HydratedLocustGameState,
    pending: PendingAction,
    habitatIds: string[]
): string | undefined {
    const countError = checkCount(habitatIds.length, pending.level)
    if (countError) {
        return countError
    }
    if (new Set(habitatIds).size !== habitatIds.length) {
        return 'Each habitat can only be chosen once'
    }
    const allowed = swarmableHabitatIds(state)
    const invalid = habitatIds.find((habitatId) => !allowed.includes(habitatId))
    return invalid ? `${invalid} is not a crowded habitat in the Swarming Zone` : undefined
}

export function relocationRoom(state: HydratedLocustGameState, sourceId: string): number {
    return Habitats.filter((habitat) => habitat.id !== sourceId).reduce(
        (sum, habitat) => sum + state.freeRoom(habitat.id),
        0
    )
}

export function requiredRelocations(
    state: HydratedLocustGameState,
    color: Color,
    sourceId: string
): number {
    return Math.min(
        state.board.count(sourceId, color, InsectKind.Locust),
        relocationRoom(state, sourceId)
    )
}

export function relocationError(
    state: HydratedLocustGameState,
    color: Color,
    sourceId: string,
    destinations: string[]
): string | undefined {
    const required = requiredRelocations(state, color, sourceId)
    if (destinations.length !== required) {
        return `You must move exactly ${required} locusts`
    }
    const added = new Map<string, number>()
    for (const destination of destinations) {
        if (destination === sourceId) {
            return 'Locusts must leave the swarming habitat'
        }
        const discsAfter = state.board.discsIn(destination) + (added.get(destination) ?? 0) + 1
        if (discsAfter > state.habitatCapacity(destination)) {
            return `${destination} would become crowded`
        }
        added.set(destination, (added.get(destination) ?? 0) + 1)
    }
    return undefined
}

// Picks victims round-robin across opponents (grasshoppers, then locusts, then nymphs), which is always as even as possible.
export function evenVictims(
    state: HydratedLocustGameState,
    color: Color,
    habitatId: string
): Victim[] {
    const remaining = state.board
        .habitat(habitatId)
        .occupants.filter((occupant) => isOpponent(state, color, occupant.color))
        .map((occupant) => ({ ...occupant }))
    const victims: Victim[] = []
    let toTake = requiredVictims(state, color, habitatId)
    while (toTake > 0) {
        for (const occupant of remaining) {
            if (toTake === 0) {
                break
            }
            const kind = [InsectKind.Grasshopper, InsectKind.Locust, InsectKind.Nymph].find(
                (candidate) => occupant[candidate] > 0
            )
            if (kind === undefined) {
                continue
            }
            occupant[kind] -= 1
            toTake -= 1
            const existing = victims.find(
                (victim) => victim.color === occupant.color && victim.kind === kind
            )
            if (existing) {
                existing.count += 1
            } else {
                victims.push({ color: occupant.color, kind, count: 1 })
            }
        }
    }
    return victims
}
