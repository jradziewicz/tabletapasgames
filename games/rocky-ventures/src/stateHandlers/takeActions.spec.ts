import { GameEngine, MachineContext, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { TakeActionsStateHandler } from './takeActions.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const config = normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? []))
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'mat-pass',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 1,
            config,
            players: [0, 1, 2].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

function validActions(state: HydratedRockyVenturesGameState, pawnIndex: number): string[] {
    const playerId = state.players[0]!.playerId
    state.activePlayerIds = [playerId]
    state.getPlayerState(playerId).pawnIndex = pawnIndex
    const context = new MachineContext({ gameConfig: {}, gameState: state })
    return new TakeActionsStateHandler().validActionsForPlayer(playerId, context as never)
}

describe('passing while taking actions', () => {
    it('is not offered on the mat while tax or invest is possible', () => {
        const valid = validActions(startedState(), 0)
        expect(valid).toContain(ActionType.Tax)
        expect(valid).not.toContain(ActionType.EndTurn)
    })

    it('stays available on other cards', () => {
        expect(validActions(startedState(), 1)).toContain(ActionType.EndTurn)
    })
})
