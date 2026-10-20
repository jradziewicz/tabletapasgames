import { CardKind, getCard } from '../data/cards.js'
import { MachineState } from '../definition/states.js'
import { recordGems } from './stats.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'

// The game has 15 gems in all. Gems players hold come out of this supply; gems spent on gem
// actions leave the game (they also count toward the gems end trigger). A player gains a gem
// only while one is left, and never above 3.
export const GemSupplySize = 15

export function gemSupplyLeft(state: HydratedRockyVenturesGameState): number {
    const held = state.players.reduce((total, player) => total + player.gems, 0)
    return Math.max(0, GemSupplySize - state.gemsSpent - held)
}

// Gives up to `amount` gems from the supply and returns how many were actually gained.
export function gainGems(state: HydratedRockyVenturesGameState, playerId: string, amount: number): number {
    return state.getPlayerState(playerId).addGems(Math.min(amount, gemSupplyLeft(state)))
}

export type GemActionKind = 'repeat' | 'market' | 'swap' | 'movePawn'

export const GemActionKinds: GemActionKind[] = ['repeat', 'market', 'swap', 'movePawn']

export const GemActionCosts: Record<GemActionKind, number> = {
    repeat: 2,
    market: 2,
    swap: 1,
    movePawn: 1
}

export function reasonGemActionInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    kind: GemActionKind,
    index?: number
): string | undefined {
    if (!state.activePlayerIds.includes(playerId)) {
        return 'It is not your turn'
    }
    const atStart = state.machineState === MachineState.MovePawn
    const inTurn = atStart || state.machineState === MachineState.TakeActions
    if (!inTurn) {
        return 'Gems cannot be spent right now'
    }
    const player = state.getPlayerState(playerId)
    if (player.gems < GemActionCosts[kind]) {
        return 'Not enough gems'
    }
    switch (kind) {
        case 'repeat': {
            if (!atStart) {
                return 'This must be done in place of moving the pawn'
            }
            const cardId = player.pawnCardId
            if (cardId === undefined) {
                return 'The pawn is not on a card'
            }
            return undefined
        }
        case 'market': {
            if (!atStart) {
                return 'This must be done in place of moving the pawn'
            }
            const cardId = index === undefined ? undefined : state.market.slots[index]
            if (cardId === undefined || getCard(cardId).kind !== CardKind.Development) {
                return 'Choose a face up market card'
            }
            return undefined
        }
        case 'swap': {
            if (index === undefined || index < 0 || index + 1 >= state.market.slots.length) {
                return 'Choose two adjacent market cards'
            }
            return undefined
        }
        case 'movePawn': {
            if (state.turnActionsTaken.length > 0 || state.turnOver) {
                return 'The pawn cannot move after taking an action'
            }
            if (index === undefined || index < 0 || index >= player.tableau.length) {
                return 'Choose a card in your tableau'
            }
            if (index === player.pawnIndex) {
                return 'The pawn is already on that card'
            }
            return undefined
        }
    }
}

export function applyGemAction(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    kind: GemActionKind,
    index?: number
) {
    const player = state.getPlayerState(playerId)
    const cost = GemActionCosts[kind]
    player.spendGems(cost)
    state.gemsSpent += cost
    switch (kind) {
        case 'repeat':
            delete state.borrowedCardId
            state.turnCopied = true
            recordGems(state, playerId, cost, 'repeat', true, player.pawnCardId)
            break
        case 'market': {
            const cardId = index === undefined ? undefined : state.market.slots[index]
            if (cardId === undefined) {
                throw Error('Choose a face up market card')
            }
            state.borrowedCardId = cardId
            state.turnCopied = true
            recordGems(state, playerId, cost, 'market', true, cardId)
            break
        }
        case 'swap': {
            if (index === undefined) {
                throw Error('Choose two adjacent market cards')
            }
            const slots = state.market.slots
            const left = slots[index]
            const right = slots[index + 1]
            if (left === undefined || right === undefined) {
                throw Error('Choose two adjacent market cards')
            }
            slots[index] = right
            slots[index + 1] = left
            recordGems(state, playerId, cost, 'swap', true, left)
            break
        }
        case 'movePawn':
            if (index === undefined) {
                throw Error('Choose a card in your tableau')
            }
            player.pawnIndex = index
            delete state.borrowedCardId
            recordGems(state, playerId, cost, 'movePawn', true, player.tableau[index])
            break
    }
}
