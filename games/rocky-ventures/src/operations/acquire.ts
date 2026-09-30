import { AcquireMode, CardActionKind, type AcquireCardAction } from '../data/cards.js'
import type { GridCell } from '../data/toolWeaponGrid.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { moveOnGrid, stepOnGrid, type GridDirection } from './grid.js'
import { recordActionStat } from './stats.js'
import { remainingActionKinds } from './turn.js'

export type AcquireChoice = 'weapon' | 'tool'

const AcquireStepMarkers: Record<AcquireChoice, string> = { weapon: 'Acquire:weapon', tool: 'Acquire:tool' }

export interface AcquirePlan {
    choice: AcquireChoice
    destination: GridCell
    victoryPoints: number
}

export function currentAcquireAction(
    state: HydratedRockyVenturesGameState,
    playerId: string
): AcquireCardAction | undefined {
    return state.actionCardActions(playerId).find(
        (action): action is AcquireCardAction => action.kind === CardActionKind.Acquire
    )
}

export function acquireChoices(
    state: HydratedRockyVenturesGameState,
    playerId: string
): AcquireChoice[] {
    const action = currentAcquireAction(state, playerId)
    if (!action) {
        return []
    }
    if (action.mode !== AcquireMode.OneToolAndOneWeapon) {
        return ['weapon', 'tool']
    }
    const taken = state.turnActionsSinceImmediate
    const choices: AcquireChoice[] = ['weapon', 'tool']
    return choices.filter((choice) => !taken.includes(AcquireStepMarkers[choice]))
}

function directionsFor(action: AcquireCardAction, choice: AcquireChoice): GridDirection[] {
    const direction: GridDirection = choice === 'weapon' ? 'up' : 'right'
    const steps = action.mode === AcquireMode.OneToolAndOneWeapon ? 1 : action.levels
    return Array.from({ length: steps }, () => direction)
}

export function planAcquire(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    choice: AcquireChoice
): AcquirePlan | undefined {
    const action = currentAcquireAction(state, playerId)
    if (!action || !acquireChoices(state, playerId).includes(choice)) {
        return undefined
    }
    const player = state.getPlayerState(playerId)
    let cell: GridCell = { weapon: player.weaponLevel, tool: player.toolLevel }
    let victoryPoints = 0
    for (const direction of directionsFor(action, choice)) {
        const step = stepOnGrid(cell, direction)
        cell = step.cell
        victoryPoints += step.victoryPoints
    }
    return { choice, destination: cell, victoryPoints }
}

export function acquireHasEffect(
    state: HydratedRockyVenturesGameState,
    playerId: string
): boolean {
    if (!state.activePlayerIds.includes(playerId)) {
        return false
    }
    if (!remainingActionKinds(state).includes(CardActionKind.Acquire)) {
        return false
    }
    const player = state.getPlayerState(playerId)
    return acquireChoices(state, playerId).some((choice) => {
        const plan = planAcquire(state, playerId, choice)
        return (
            plan !== undefined &&
            (plan.victoryPoints > 0 ||
                plan.destination.weapon !== player.weaponLevel ||
                plan.destination.tool !== player.toolLevel)
        )
    })
}

export function reasonAcquireInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    choice: AcquireChoice
): string | undefined {
    if (!state.activePlayerIds.includes(playerId)) {
        return 'It is not your turn'
    }
    if (!remainingActionKinds(state).includes(CardActionKind.Acquire)) {
        return 'Acquire is not available on this card'
    }
    if (!acquireChoices(state, playerId).includes(choice)) {
        return 'That choice is not allowed on this card'
    }
    return undefined
}

export function acquireAt(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    choice: AcquireChoice
) {
    const action = currentAcquireAction(state, playerId)
    if (!action) {
        throw Error('Acquire is not available on this card')
    }
    for (const direction of directionsFor(action, choice)) {
        moveOnGrid(state, playerId, direction)
    }
    recordActionStat(state, playerId, 'Acquire')
    state.turnActionsTaken.push(CardActionKind.Acquire)
    if (action.mode === AcquireMode.OneToolAndOneWeapon) {
        state.turnActionsTaken.push(AcquireStepMarkers[choice])
    }
}
