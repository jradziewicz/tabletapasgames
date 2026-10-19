import type { Color } from '@tabletop/common'
import {
    InsectKinds,
    isOpponent,
    occupantDiscs,
    requiredVictims,
    type HydratedLocustGameState,
    type InsectKind,
    type Victim
} from '@tabletop/locust'

export type VictimOption = { color: Color; kind: InsectKind; remaining: number }

function takenFrom(victims: Victim[], color: Color, kind?: InsectKind): number {
    return victims
        .filter((victim) => victim.color === color && (kind === undefined || victim.kind === kind))
        .reduce((sum, victim) => sum + victim.count, 0)
}

function opponentsIn(state: HydratedLocustGameState, attacker: Color, habitatId: string) {
    return state.board
        .habitat(habitatId)
        .occupants.filter((occupant) => isOpponent(state, attacker, occupant.color))
}

// Picking one insect at a time from an opponent with the fewest losses so far always ends
// "as evenly as possible"; exhausted opponents drop out of the comparison.
export function victimOptions(
    state: HydratedLocustGameState,
    attacker: Color,
    habitatId: string,
    picked: Victim[]
): VictimOption[] {
    const total = picked.reduce((sum, victim) => sum + victim.count, 0)
    if (total >= requiredVictims(state, attacker, habitatId)) {
        return []
    }
    const open = opponentsIn(state, attacker, habitatId).filter(
        (occupant) => takenFrom(picked, occupant.color) < occupantDiscs(occupant)
    )
    const fewest = Math.min(...open.map((occupant) => takenFrom(picked, occupant.color)))
    return open
        .filter((occupant) => takenFrom(picked, occupant.color) === fewest)
        .flatMap((occupant) =>
            InsectKinds.map((kind) => ({
                color: occupant.color,
                kind,
                remaining: occupant[kind] - takenFrom(picked, occupant.color, kind)
            })).filter((option) => option.remaining > 0)
        )
}

// True when the attacker could end up removing a different set of insects than the default split.
export function hasVictimChoice(
    state: HydratedLocustGameState,
    attacker: Color,
    habitatId: string
): boolean {
    const opposing = opponentsIn(state, attacker, habitatId).reduce(
        (sum, occupant) => sum + occupantDiscs(occupant),
        0
    )
    if (requiredVictims(state, attacker, habitatId) >= opposing) {
        return false
    }
    let picked: Victim[] = []
    while (true) {
        const [first, ...others] = victimOptions(state, attacker, habitatId, picked)
        if (!first) return false
        if (others.length > 0) return true
        picked = addVictim(picked, first.color, first.kind)
    }
}

export function addVictim(picked: Victim[], color: Color, kind: InsectKind): Victim[] {
    const existing = picked.find((victim) => victim.color === color && victim.kind === kind)
    return existing
        ? picked.map((victim) =>
              victim === existing ? { ...victim, count: victim.count + 1 } : victim
          )
        : [...picked, { color, kind, count: 1 }]
}
