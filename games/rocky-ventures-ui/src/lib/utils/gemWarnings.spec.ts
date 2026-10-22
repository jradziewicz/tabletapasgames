import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition, GemSupplySize, WeaponTokenKind, type HydratedRockyVenturesGameState } from '@tabletop/rocky-ventures'
import { gemGainBlockedReason, huntBonusWarnings } from './gemWarnings.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'gem-warnings',
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

describe('gem warnings', () => {
    it('warns when the player already holds 3 gems or the supply is empty', () => {
        const state = startedState()
        const playerId = state.players[0]!.playerId
        expect(gemGainBlockedReason(state, playerId)).toBeUndefined()
        state.getPlayerState(playerId).gems = 3
        expect(gemGainBlockedReason(state, playerId)).toBe('you already hold 3 gems')
        state.getPlayerState(playerId).gems = 2
        state.gemsSpent = GemSupplySize
        expect(gemGainBlockedReason(state, playerId)).toBe('there are no gems left in the supply')
    })

    it('warns about bonus tokens the weapon level is too low for', () => {
        const state = startedState()
        const playerId = state.players[0]!.playerId
        state.getPlayerState(playerId).weaponLevel = 1
        expect(huntBonusWarnings(state, playerId, [WeaponTokenKind.BonusGem, WeaponTokenKind.BonusInvest])).toEqual([
            'Bonus Gem gives nothing: it needs weapon level 2',
            'Bonus Invest gives nothing: it needs weapon level 4'
        ])
        state.getPlayerState(playerId).weaponLevel = 4
        expect(huntBonusWarnings(state, playerId, [WeaponTokenKind.BonusGem, WeaponTokenKind.BonusInvest])).toEqual([])
    })

    it('warns when a wall blocks the Bonus Weapon Level', () => {
        const state = startedState()
        const playerId = state.players[0]!.playerId
        const player = state.getPlayerState(playerId)
        player.weaponLevel = 1
        player.toolLevel = 3
        expect(huntBonusWarnings(state, playerId, [WeaponTokenKind.BonusWeaponLevel])).toEqual([
            'Bonus Weapon Level gives nothing: a wall on the grid blocks moving up'
        ])
        player.toolLevel = 2
        expect(huntBonusWarnings(state, playerId, [WeaponTokenKind.BonusWeaponLevel])).toEqual([])
    })
})
