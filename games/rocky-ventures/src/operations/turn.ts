import { AcquireMode, CardActionKind, CardKind, getCard } from '../data/cards.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { endGameTriggered } from './endGame.js'
import { dummyPointBuy, runDummyTurn } from './dummy.js'
import type { HydratedRockyVenturesPlayerState } from '../model/playerState.js'

export const ImplementedActionKinds: CardActionKind[] = [
    CardActionKind.Invest,
    CardActionKind.Tax,
    CardActionKind.ClaimMine,
    CardActionKind.LayTrack,
    CardActionKind.ExtractAndSell,
    CardActionKind.Hunt,
    CardActionKind.Acquire
]

export function currentPlayerId(state: HydratedRockyVenturesGameState): string {
    const turn = state.turnManager.currentTurn()
    if (!turn) {
        throw Error('There is no current turn')
    }
    return turn.playerId
}

export function currentPlayer(
    state: HydratedRockyVenturesGameState
): HydratedRockyVenturesPlayerState {
    return state.getPlayerState(currentPlayerId(state))
}

export function remainingActionKinds(state: HydratedRockyVenturesGameState): CardActionKind[] {
    const immediate = state.immediateCardId !== undefined
    if (state.turnOver && !immediate) {
        return []
    }
    const playerId = currentPlayerId(state)
    const actions = state.actionCardActions(playerId)
    const cardId = state.actionCardId(playerId)
    const card = cardId === undefined ? undefined : getCard(cardId)
    const taken = state.turnActionsSinceImmediate
    if (
        !immediate &&
        card?.kind === CardKind.Player &&
        card.exclusiveActions &&
        taken.length > 0
    ) {
        return []
    }
    const remaining: CardActionKind[] = []
    for (const action of actions) {
        const count =
            action.kind === CardActionKind.ClaimMine
                ? action.mines
                : action.kind === CardActionKind.LayTrack
                  ? action.maxTracks
                  : action.kind === CardActionKind.Hunt
                  ? action.hunts
                  : action.kind === CardActionKind.Acquire && action.mode === AcquireMode.OneToolAndOneWeapon
                    ? 2
                    : 1
        for (let copy = 0; copy < count; copy += 1) {
            remaining.push(action.kind)
        }
    }
    for (const takenKind of taken) {
        const index = remaining.findIndex((kind) => kind === takenKind)
        if (index >= 0) {
            remaining.splice(index, 1)
        }
    }
    return remaining
}

export function endCurrentTurn(state: HydratedRockyVenturesGameState) {
    const endingPlayerId = state.turnManager.currentTurn()?.playerId
    state.turnManager.endTurn(state.actionCount)
    state.turnActionsTaken = []
    state.turnTrackCompanies = []
    state.turnOver = false
    delete state.borrowedCardId
    delete state.turnCopied
    delete state.immediateCardId
    delete state.immediateStart
    const order = state.turnManager.turnOrder
    if (state.dummy && endingPlayerId !== undefined && endingPlayerId === order[order.length - 1]) {
        runDummyTurn(state)
    }
}

export function stateAfterTurnEnd(state: HydratedRockyVenturesGameState): MachineState {
    endCurrentTurn(state)
    if (state.pointBuy) {
        return MachineState.PointBuy
    }
    return endGameTriggered(state) ? MachineState.EndOfGame : MachineState.MovePawn
}

export function nextStateAfterResolution(state: HydratedRockyVenturesGameState): MachineState {
    if (state.pendingAgreementBuy) {
        return MachineState.AgreementPointBuy
    }
    if (state.pendingHunt) {
        return MachineState.Hunt
    }
    if (state.bonusInvest) {
        return MachineState.BonusInvest
    }
    if (state.pendingShare) {
        return MachineState.ChooseShare
    }
    if (state.pointBuy) {
        return MachineState.PointBuy
    }
    if (!state.turnManager.currentTurn()) {
        return endGameTriggered(state) ? MachineState.EndOfGame : MachineState.MovePawn
    }
    if (state.immediateCardId !== undefined) {
        if (remainingActionKinds(state).length > 0) {
            return MachineState.TakeActions
        }
        finishImmediateAction(state)
    }
    if (state.turnOver || remainingActionKinds(state).length === 0) {
        return stateAfterTurnEnd(state)
    }
    return MachineState.TakeActions
}

export function startPointBuy(
    state: HydratedRockyVenturesGameState,
    cardId: string,
    startPlayerId: string = currentPlayerId(state)
) {
    const order = state.turnManager.turnOrder
    const start = Math.max(0, order.indexOf(startPlayerId))
    const queue = order.map((_, offset) => order[(start + offset) % order.length]!)
    state.pointBuy = { cardId, queue }
    dummyPointBuy(state, cardId)
}

export function finishImmediateAction(state: HydratedRockyVenturesGameState) {
    delete state.immediateCardId
    delete state.immediateStart
}
