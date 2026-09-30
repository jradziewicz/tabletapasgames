import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { StatKind, type StatEvent } from '../model/stats.js'

export interface StatInput {
    kind: StatKind
    playerId: string
    amount: number
    source?: string
    cardId?: string
    agreement?: string
    nodeId?: string
    detail?: string
}

export function recordStat(state: HydratedRockyVenturesGameState, input: StatInput) {
    const event: StatEvent = {
        ...input,
        era: state.era,
        action: state.actionCount
    }
    if (state.turnCopied) {
        event.copy = true
    }
    state.statEvents.push(event)
}

export function recordActionStat(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    source: string,
    amount = 1
) {
    recordStat(state, {
        kind: StatKind.Action,
        playerId,
        amount,
        source,
        cardId: state.actionCardId(playerId)
    })
}

export function recordCash(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    amount: number,
    source: string,
    extra: { cardId?: string; agreement?: string; nodeId?: string } = {}
) {
    if (amount === 0) {
        return
    }
    recordStat(state, {
        kind: StatKind.Cash,
        playerId,
        amount,
        source,
        cardId: 'cardId' in extra ? extra.cardId : state.actionCardId(playerId),
        agreement: extra.agreement,
        nodeId: extra.nodeId
    })
}

export function recordVictoryPoints(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    amount: number,
    source: string,
    extra: { cardId?: string; agreement?: string } = {}
) {
    if (amount === 0) {
        return
    }
    recordStat(state, {
        kind: StatKind.VictoryPoints,
        playerId,
        amount,
        source,
        cardId: 'cardId' in extra ? extra.cardId : state.actionCardId(playerId),
        agreement: extra.agreement
    })
}

export function recordGems(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    amount: number,
    source: string,
    spent = false,
    cardId?: string
) {
    if (amount === 0) {
        return
    }
    recordStat(state, {
        kind: spent ? StatKind.GemSpend : StatKind.GemGain,
        playerId,
        amount,
        source,
        cardId: cardId ?? state.actionCardId(playerId)
    })
}
