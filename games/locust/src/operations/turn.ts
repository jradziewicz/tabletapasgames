import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import type { HydratedLocustGameState, PendingAction } from '../model/gameState.js'
import { ActionKind } from '../data/board.js'

export function beginCubeTurn(state: HydratedLocustGameState) {
    const spaceId = state.nextCubeSpaceId()
    if (spaceId === undefined) {
        throw Error('No cube left in the Active Region')
    }
    const color = state.board.cubeOn(spaceId)
    assertExists(color, `No cube on ${spaceId}`)
    const playerId = state.colony(color).playerId
    state.activeColor = color
    state.activePlayerIds = [playerId]
    state.turnManager.startTurn(playerId, state.actionCount)
}

export function finishCubeTurn(state: HydratedLocustGameState): MachineState {
    delete state.activeColor
    delete state.pendingAction
    delete state.swarm
    state.turnManager.endTurn(state.actionCount)
    return state.nextCubeSpaceId() === undefined ? MachineState.Scoring : MachineState.ChooseSpace
}

export function actingColony(state: HydratedLocustGameState, playerId: string) {
    const colony = state.activeColony
    if (colony.playerId !== playerId) {
        throw Error('It is not your turn')
    }
    return colony
}

export function pendingActionOf(state: HydratedLocustGameState, kind: ActionKind): PendingAction {
    const pending = state.pendingAction
    assertExists(pending, 'No action has been chosen')
    if (pending.kind !== kind) {
        throw Error(`The chosen action is ${pending.kind}, not ${kind}`)
    }
    return pending
}
