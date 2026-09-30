import { GameResult } from '@tabletop/common'
import { GameOverCard } from '../data/cards.js'
import { gemTriggerThreshold } from '../data/setup.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { isDrawPileAtGameOver } from './market.js'
import { DummyPlayerId } from '../model/dummy.js'

export const EndTriggersRequired = 2

export interface EndTriggers {
    deckExhausted: boolean
    dragonKilled: boolean
    gemsSpent: boolean
}

export function endTriggers(state: HydratedRockyVenturesGameState): EndTriggers {
    return {
        deckExhausted: isDrawPileAtGameOver(state),
        dragonKilled: state.dragon.summoned && state.dragon.killed,
        gemsSpent: state.gemsSpent >= gemTriggerThreshold(state.players.length)
    }
}

export function endTriggerCount(state: HydratedRockyVenturesGameState): number {
    return Object.values(endTriggers(state)).filter(Boolean).length
}

export function endGameTriggered(state: HydratedRockyVenturesGameState): boolean {
    return endTriggerCount(state) >= EndTriggersRequired
}

export interface FinalScore {
    playerId: string
    victoryPoints: number
    money: number
    shareValue: number
    conversionVictoryPoints: number
    total: number
}

export function finalScores(state: HydratedRockyVenturesGameState): FinalScore[] {
    const scores = playerScores(state)
    const dummy = state.dummy
    if (dummy) {
        const conversionVictoryPoints = Math.floor(dummy.money / GameOverCard.cashPerVictoryPoint)
        scores.push({
            playerId: DummyPlayerId,
            victoryPoints: dummy.victoryPoints,
            money: dummy.money,
            shareValue: 0,
            conversionVictoryPoints,
            total: dummy.victoryPoints + conversionVictoryPoints
        })
    }
    return scores
}

function playerScores(state: HydratedRockyVenturesGameState): FinalScore[] {
    return state.players.map((player) => {
        const shareValue = player.shares.reduce((sum, share) => {
            const company = state.getCompany(share.companyId)
            return sum + company.multiplierForShare(share.shareIndex) * company.value
        }, 0)
        const conversionVictoryPoints = Math.floor(
            (player.money + shareValue) / GameOverCard.cashPerVictoryPoint
        )
        return {
            playerId: player.playerId,
            victoryPoints: player.victoryPoints,
            money: player.money,
            shareValue,
            conversionVictoryPoints,
            total: player.victoryPoints + conversionVictoryPoints
        }
    })
}

// Who actually came out on top at the table, including the dummy: highest total, then most cash
export function tableWinners(state: HydratedRockyVenturesGameState): string[] {
    const scores = finalScores(state)
    const bestTotal = Math.max(...scores.map((score) => score.total))
    const leaders = scores.filter((score) => score.total === bestTotal)
    const bestMoney = Math.max(...leaders.map((score) => score.money))
    return leaders.filter((score) => score.money === bestMoney).map((score) => score.playerId)
}

export function determineWinners(state: HydratedRockyVenturesGameState): {
    result: GameResult
    winningPlayerIds: string[]
    dummyWins: boolean
} {
    const tied = tableWinners(state)
    const humans = tied.filter((playerId) => playerId !== DummyPlayerId)
    if (humans.length === 0) {
        // The dummy won outright. The site needs real winners, so it's recorded as a draw
        // between all the real players (Justin, 2026-09-30); the game still shows the dummy won.
        return {
            result: GameResult.Draw,
            winningPlayerIds: state.players.map((player) => player.playerId),
            dummyWins: true
        }
    }
    return {
        result: tied.length === 1 ? GameResult.Win : GameResult.Draw,
        winningPlayerIds: humans,
        dummyWins: humans.length < tied.length
    }
}
