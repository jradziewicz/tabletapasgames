import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { WeaponTokenKind } from '../data/weaponBag.js'
import { OreKind } from '../data/mineTokens.js'
import { freeBonusClaimMineIds, reasonResolveHuntInvalid, resolveHuntAt } from './hunt.js'
import { currentPlayerId } from './turn.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'bonus-cash',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 1,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

// Puts a revealed, unclaimed gold 2 on some mine and returns its id.
function levelTwoMine(state: HydratedRockyVenturesGameState): string {
    const [nodeId, site] = Object.entries(state.board.mines).find(([, candidate]) => candidate && !candidate.ownerPlayerId)!
    site!.empty = false
    site!.token = { id: 'test-gold-2', ore: OreKind.Gold, level: 2 } as never
    return nodeId
}

describe('bonus tokens taken as $3 (new games)', () => {
    it('pays $3 for any bonus token instead of its effect', () => {
        const state = startedState()
        expect(state.bonusTokenCash).toBe(true)
        const playerId = currentPlayerId(state)
        const player = state.getPlayerState(playerId)
        state.pendingHunt = { region: 'manorsGate', drawn: [WeaponTokenKind.BonusWeaponLevel], apply: 1 }
        const money = player.money
        const weapon = player.weaponLevel
        const request = { tokenIndexes: [0], hitTargets: [], cashIndexes: [0] }
        expect(reasonResolveHuntInvalid(state, playerId, request)).toBeUndefined()
        resolveHuntAt(state, playerId, request)
        expect(player.money).toBe(money + 3)
        expect(player.weaponLevel).toBe(weapon)
        expect(state.dragon.trackerTokens).toContain(WeaponTokenKind.BonusWeaponLevel)
    })

    it('uses the claim bonus to claim a level 2 gold mine for free', () => {
        const state = startedState()
        const playerId = currentPlayerId(state)
        const player = state.getPlayerState(playerId)
        const nodeId = levelTwoMine(state)
        state.pendingHunt = { region: 'manorsGate', drawn: [WeaponTokenKind.BonusGold], apply: 1 }
        expect(freeBonusClaimMineIds(state, playerId)).toContain(nodeId)
        expect(reasonResolveHuntInvalid(state, playerId, { tokenIndexes: [0], hitTargets: [] })).toMatch(/level 2/)
        const money = player.money
        const claims = player.claimTokens
        resolveHuntAt(state, playerId, { tokenIndexes: [0], hitTargets: [], claimNodeId: nodeId })
        expect(state.board.getMine(nodeId).ownerPlayerId).toBe(playerId)
        expect(player.claimTokens).toBe(claims - 1)
        expect(player.money).toBe(money)
        expect(state.pendingHunt).toBeUndefined()
    })
})
