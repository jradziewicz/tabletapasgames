import {
    ActionKind,
    MachineState,
    type HydratedLocustGameState,
    type PendingAction
} from '@tabletop/locust'

export const ActionNames: Record<ActionKind, string> = {
    [ActionKind.JumpOrBreed]: 'Jump or Breed',
    [ActionKind.Swarm]: 'Swarm',
    [ActionKind.Cannibalize]: 'Cannibalize',
    [ActionKind.Hatch]: 'Hatch'
}

export const ActionBlurbs: Record<ActionKind, string> = {
    [ActionKind.JumpOrBreed]:
        'Jump grasshoppers along lines from habitats of this colour, or breed nymphs where you already live.',
    [ActionKind.Swarm]:
        'Pick a crowded habitat in the Swarming Zone: nymphs and locusts die, grasshoppers become locusts and fly off.',
    [ActionKind.Cannibalize]:
        'In habitats with your locusts, each locust eats one opposing insect.',
    [ActionKind.Hatch]: 'Bring dead discs back from the general pool to your supply.'
}

// Same palette the board prints its action numbers in.
export const ActionBadgeFill: Record<ActionKind, string> = {
    [ActionKind.JumpOrBreed]: '#58c3d4',
    [ActionKind.Swarm]: '#d98a10',
    [ActionKind.Cannibalize]: '#8d8d8d',
    [ActionKind.Hatch]: '#efe6c8'
}

export const HabitatHex: Record<string, string> = {
    blue: '#58c3d4',
    red: '#f0907a',
    yellow: '#f2cf6b',
    green: '#55c25a'
}

export function describePendingAction(pending: PendingAction): string {
    const color = pending.alternative ? 'any colour' : pending.color
    const base = `${ActionNames[pending.kind]} · level ${pending.level}`
    return color ? `${base} · ${color}` : base
}

export function phaseText(state: HydratedLocustGameState): string {
    switch (state.machineState) {
        case MachineState.ChooseSpace:
            return 'CHOOSE AN ACTION SPACE'
        case MachineState.PerformAction:
            return state.pendingAction
                ? ActionNames[state.pendingAction.kind].toUpperCase()
                : 'TAKE ACTION'
        case MachineState.RelocateLocusts:
            return 'RELOCATE LOCUSTS'
        case MachineState.Scoring:
            return 'SCORING'
        case MachineState.AssignDuelScoring:
            return 'CHOOSE VIGOR COLOUR'
        case MachineState.EndOfGame:
            return 'END OF GAME'
    }
}
