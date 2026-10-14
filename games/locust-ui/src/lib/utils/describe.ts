import { ActionKind, type PendingAction } from '@tabletop/locust'

const KindNames: Record<ActionKind, string> = {
    [ActionKind.JumpOrBreed]: 'JUMP or BREED',
    [ActionKind.Swarm]: 'SWARM',
    [ActionKind.Cannibalize]: 'CANNIBALIZE',
    [ActionKind.Hatch]: 'HATCH'
}

export function describePendingAction(pending: PendingAction): string {
    const color = pending.alternative ? 'any colour' : pending.color
    const base = `${KindNames[pending.kind]} level ${pending.level}`
    return color ? `${base} (${color})` : base
}
