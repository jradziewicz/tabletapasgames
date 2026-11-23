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
    if (state.eraThreeEndsGame) {
        return state.eraThreeTriggered === true
    }
    return endTriggerCount(state) >= EndTriggersRequired
}

export interface FinalScore {
    playerId: string
    victoryPoints: number
    money: number
    shareValue: number
    conversionVictoryPoints: number
    total: number
    // Mana tokens kept (empty mines): the first tie-break in games with the drawn Feasts.
    emptyMines: number
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
            total: dummy.victoryPoints + conversionVictoryPoints,
            emptyMines: 0
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
            total: player.victoryPoints + conversionVictoryPoints,
            emptyMines: player.emptyMines ?? 0
        }
    })
}

// Who actually came out on top at the table, including the dummy: highest total, then (in games
// with the drawn Feasts) most empty mines, then most cash.
export function tableWinners(state: HydratedRockyVenturesGameState): string[] {
    const scores = finalScores(state)
    const bestTotal = Math.max(...scores.map((score) => score.total))
    let leaders = scores.filter((score) => score.total === bestTotal)
    if (emptyMinesBreakTies(state)) {
        const bestEmpty = Math.max(...leaders.map((score) => score.emptyMines))
        leaders = leaders.filter((score) => score.emptyMines === bestEmpty)
    }
    const bestMoney = Math.max(...leaders.map((score) => score.money))
    return leaders.filter((score) => score.money === bestMoney).map((score) => score.playerId)
}

// Ties at the end are broken by most empty mines (Mana tokens kept) first, in games that track
// them (Justin, 2026-11-23).
export function emptyMinesBreakTies(state: HydratedRockyVenturesGameState): boolean {
    return state.feastCategories !== undefined
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
