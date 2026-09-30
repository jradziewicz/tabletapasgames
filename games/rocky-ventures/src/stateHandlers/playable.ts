import { MachineState } from '../definition/states.js'
import { HydratedTax } from '../actions/tax.js'
import { HydratedInvest } from '../actions/invest.js'
import { HydratedClaimMine } from '../actions/claimMine.js'
import { HydratedLayTrack } from '../actions/layTrack.js'
import { HydratedHunt } from '../actions/hunt.js'
import { HydratedAcquire } from '../actions/acquire.js'
import { HydratedExtractAndSell } from '../actions/extractAndSell.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import {
    currentPlayerId,
    finishImmediateAction,
    nextStateAfterResolution,
    stateAfterTurnEnd
} from '../operations/turn.js'

function hasPlayableAction(state: HydratedRockyVenturesGameState): boolean {
    const playerId = currentPlayerId(state)
    state.activePlayerIds = [playerId]
    return (
        HydratedTax.canTax(state, playerId) ||
        HydratedInvest.canInvest(state, playerId) ||
        HydratedClaimMine.canClaimMine(state, playerId) ||
        HydratedLayTrack.canLayTrack(state, playerId) ||
        HydratedExtractAndSell.canExtractAndSell(state, playerId) ||
        HydratedHunt.canHunt(state, playerId) ||
        HydratedAcquire.canAcquire(state, playerId)
    )
}

export function nextStateSkippingDeadTurns(state: HydratedRockyVenturesGameState): MachineState {
    let next = nextStateAfterResolution(state)
    if (next === MachineState.TakeActions && state.immediateCardId !== undefined && !hasPlayableAction(state)) {
        finishImmediateAction(state)
        next = nextStateAfterResolution(state)
    }
    if (next === MachineState.TakeActions && !hasPlayableAction(state)) {
        return stateAfterTurnEnd(state)
    }
    return next
}

export function stateAfterPawnMove(state: HydratedRockyVenturesGameState): MachineState {
    if (!hasPlayableAction(state)) {
        return stateAfterTurnEnd(state)
    }
    return MachineState.TakeActions
}
