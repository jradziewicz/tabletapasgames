import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { HydratedInvest } from '../actions/invest.js'
import { OreKind } from '../data/mineTokens.js'
import { WeaponTokenKind } from '../data/weaponBag.js'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { freeBonusClaimMineIds, reasonResolveHuntInvalid, resolveHuntAt } from './hunt.js'
import { investCost, investInMarketCard } from './invest.js'
import { currentPlayerId } from './turn.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'hunt-bonus',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 5,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1, 2].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

// Unclaimed, revealed gold mines of levels 2 to 5, one each.
function mines(state: HydratedRockyVenturesGameState): Record<number, string> {
    const ids = Object.keys(state.board.mines)
    for (const id of ids) state.board.mines[id]!.empty = true
    return Object.fromEntries(
        [2, 3, 4, 5].map((level, index) => {
            const site = state.board.mines[ids[index]!]!
            site.empty = false
            delete site.ownerPlayerId
            site.token = { id: `gold-${level}`, ore: OreKind.Gold, level } as never
            return [level, ids[index]!]
        })
    )
}

describe('Bonus Invest', () => {
    it('pays only the slot price, and a normal Invest still pays the base cost too', () => {
        const state = startedState()
        expect([0, 1, 2, 3, 4].map((slot) => investCost(state, slot))).toEqual([7, 8, 9, 11, 14])
        state.bonusInvest = true
        expect([0, 1, 2, 3, 4].map((slot) => investCost(state, slot))).toEqual([1, 2, 3, 5, 8])
        const player = state.getPlayerState(currentPlayerId(state))
        player.money = 3
        expect(HydratedInvest.reasonInvestInvalid(state, player.playerId, 2)).toBeUndefined()
        expect(HydratedInvest.reasonInvestInvalid(state, player.playerId, 3)).toBe('Not enough money to buy that card')
        investInMarketCard(state, player.playerId, 2)
        expect(player.money).toBe(0)
    })

    it('keeps the full cost in older games', () => {
        const state = startedState()
        delete state.bonusInvestSlotCost
        state.bonusInvest = true
        expect(investCost(state, 2)).toBe(9)
    })
})

describe('Gain Mine', () => {
    it('gains any level the player has unlocked, for free', () => {
        const state = startedState()
        const at = mines(state)
        const player = state.getPlayerState(currentPlayerId(state))
        expect(freeBonusClaimMineIds(state, player.playerId).sort()).toEqual([at[2], at[3]].sort())
        player.redMinesUnlocked = true
        expect(freeBonusClaimMineIds(state, player.playerId)).toContain(at[4])
        expect(freeBonusClaimMineIds(state, player.playerId)).not.toContain(at[5])
        player.blueMinesUnlocked = true
        expect(freeBonusClaimMineIds(state, player.playerId)).toContain(at[5])

        state.pendingHunt = { region: 'manorsGate', drawn: [WeaponTokenKind.BonusGold], apply: 1 }
        const money = player.money
        const request = { tokenIndexes: [0], hitTargets: [], claimNodeId: at[5]! }
        expect(reasonResolveHuntInvalid(state, player.playerId, request)).toBeUndefined()
        resolveHuntAt(state, player.playerId, request)
        expect(state.board.getMine(at[5]!).ownerPlayerId).toBe(player.playerId)
        expect(player.money).toBe(money)
    })
})

describe('final Feast base cost', () => {
    it('adds $10 to the final Feast only', () => {
        const state = startedState()
        state.market.slots = ['era1', 'era2', 'era3']
        expect([0, 1, 2].map((slot) => investCost(state, slot))).toEqual([1, 2, 13])
        delete state.finalFeastBaseCost
        expect(investCost(state, 2)).toBe(3)
    })
})
