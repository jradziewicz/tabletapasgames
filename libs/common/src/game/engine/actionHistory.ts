import { ActionSource, type GameAction } from './gameAction.js'
import { CALL_GAME_ACTION_TYPE } from './callGame.js'

export function getActionCascadeEndIndex(
    actions: readonly GameAction[],
    actionIndex: number
): number {
    if (actionIndex < 0) return actionIndex
    let end = actionIndex
    while (end + 1 < actions.length && isCascadedSystemAction(actions[end + 1])) end += 1
    return end
}

export function isCascadedSystemAction(action: Pick<GameAction, 'source' | 'type'>): boolean {
    return action.source === ActionSource.System && action.type !== CALL_GAME_ACTION_TYPE
}
