import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { WeaponTokenKind } from '../data/weaponBag.js'
import { reasonResolveHuntInvalid, resolveHuntAt } from './hunt.js'
import { currentPlayerId } from './turn.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'hunt-none',
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

describe('applying none of the drawn hunt tokens', () => {
    it('is allowed and returns every drawn token to the bag', () => {
        const state = startedState()
        const playerId = currentPlayerId(state)
        const before = state.weaponBag[WeaponTokenKind.BonusWeaponLevel] ?? 0
        state.pendingHunt = { region: 'manorsGate', drawn: [WeaponTokenKind.BonusWeaponLevel], apply: 1 }
        const weaponBefore = state.getPlayerState(playerId).weaponLevel

        expect(reasonResolveHuntInvalid(state, playerId, { tokenIndexes: [], hitTargets: [] })).toBeUndefined()
        resolveHuntAt(state, playerId, { tokenIndexes: [], hitTargets: [] })

        expect(state.pendingHunt).toBeUndefined()
        expect(state.weaponBag[WeaponTokenKind.BonusWeaponLevel]).toBe(before + 1)
        expect(state.getPlayerState(playerId).weaponLevel).toBe(weaponBefore)
    })
})
