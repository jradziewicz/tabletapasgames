import { Prng } from '@tabletop/common'
import { CardKind, getCard } from '../data/cards.js'
import { TaxSlotIndex, taxIncomeFor } from '../data/setup.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { DummyPlayerId } from '../model/dummy.js'
import { StatKind } from '../model/stats.js'
import { stepOnGrid } from './grid.js'
import { removeFromMarket } from './market.js'
import { recordStat } from './stats.js'
import { startPointBuy } from './turn.js'

function dummyTax(state: HydratedRockyVenturesGameState) {
    const dummy = state.dummy
    if (!dummy || state.market.slots[TaxSlotIndex] === undefined) {
        return
    }
    const cardId = removeFromMarket(state, TaxSlotIndex, new Prng(state.prng).random)
    dummy.tuckedCardIds.push(cardId)
    const income = taxIncomeFor(dummy.tuckedCardIds.length)
    dummy.money += income
    dummy.lastAction = `Tax +$${income}`
    recordStat(state, { kind: StatKind.Action, playerId: DummyPlayerId, amount: 1, source: 'Tax', cardId: 'p1' })
    recordStat(state, { kind: StatKind.Cash, playerId: DummyPlayerId, amount: income, source: 'tax', cardId: 'p1' })
    if (getCard(cardId).kind === CardKind.EndOfEra) {
        startPointBuy(state, cardId, state.turnManager.turnOrder[0])
    }
}

function dummyAcquire(state: HydratedRockyVenturesGameState) {
    const dummy = state.dummy
    if (!dummy) {
        return
    }
    const direction = dummy.nextBump === 'weapon' ? 'up' : 'right'
    const step = stepOnGrid({ weapon: dummy.weaponLevel, tool: dummy.toolLevel }, direction)
    dummy.weaponLevel = step.cell.weapon
    dummy.toolLevel = step.cell.tool
    dummy.victoryPoints += step.victoryPoints
    dummy.lastAction = step.moved
        ? `${dummy.nextBump === 'weapon' ? 'Weapon' : 'Tool'} +1`
        : `${dummy.nextBump === 'weapon' ? 'Weapon' : 'Tool'} blocked`
    dummy.nextBump = dummy.nextBump === 'weapon' ? 'tool' : 'weapon'
    recordStat(state, { kind: StatKind.Action, playerId: DummyPlayerId, amount: 1, source: 'Acquire', cardId: 'p5' })
    if (step.victoryPoints > 0) {
        recordStat(state, {
            kind: StatKind.VictoryPoints,
            playerId: DummyPlayerId,
            amount: step.victoryPoints,
            source: 'grid',
            cardId: 'p5'
        })
    }
}

export function runDummyTurn(state: HydratedRockyVenturesGameState) {
    const dummy = state.dummy
    if (!dummy) {
        return
    }
    if (dummy.nextAction === 'tax') {
        dummyTax(state)
        dummy.nextAction = 'acquire'
    } else {
        dummyAcquire(state)
        dummy.nextAction = 'tax'
    }
}

export function dummyPointBuy(state: HydratedRockyVenturesGameState, cardId: string) {
    const dummy = state.dummy
    const card = getCard(cardId)
    if (!dummy || card.kind !== CardKind.EndOfEra) {
        return
    }
    const bundles = Math.floor(dummy.money / card.pointBuyCost)
    if (bundles === 0) {
        return
    }
    dummy.money -= bundles * card.pointBuyCost
    dummy.victoryPoints += bundles * card.pointBuyVictoryPoints
    recordStat(state, {
        kind: StatKind.VictoryPoints,
        playerId: DummyPlayerId,
        amount: bundles * card.pointBuyVictoryPoints,
        source: 'pointBuy',
        cardId
    })
    recordStat(state, {
        kind: StatKind.Cash,
        playerId: DummyPlayerId,
        amount: -bundles * card.pointBuyCost,
        source: 'pointBuy',
        cardId
    })
}
