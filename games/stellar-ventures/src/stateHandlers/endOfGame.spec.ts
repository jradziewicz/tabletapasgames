import {
    GameCategory,
    GameResult,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { EndOfGameStateHandler } from './endOfGame.js'
import { CorporationId } from '../model/corporation.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

function createTestState(playerCount = 4) {
    const players: Player[] = Array.from({ length: playerCount }, (_, index) => ({
        id: `p${index + 1}`,
        isHuman: true,
        userId: `u${index + 1}`,
        name: `Player ${index + 1}`,
        status: PlayerStatus.Joined
    }))

    const game: Game = {
        id: 'game-1',
        typeId: 'stellar-ventures',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Stellar Ventures Test',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: ['p1', 'p2', 'p3', 'p4'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }

    const initialState = new StellarVenturesGameInitializer().initializeGameState(game, state)
    initialState.machineState = MachineState.EndOfGame
    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

describe('EndOfGameStateHandler', () => {
    it('declares the player with the most Credits the winner and clears active players', () => {
        const state = createTestState()
        state.getPlayerState('p1').addLiquidFunds(50)
        state.getPlayerState('p2').addLiquidFunds(10)
        const handler = new EndOfGameStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual(['p1'])
        expect(state.activePlayerIds).toEqual([])
    })

    it('declares a Draw between tied players with no tiebreaking President', () => {
        const state = createTestState()
        state.getPlayerState('p1').addLiquidFunds(50)
        state.getPlayerState('p2').addLiquidFunds(50)
        const handler = new EndOfGameStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.result).toBe(GameResult.Draw)
        expect(state.winningPlayerIds?.sort()).toEqual(['p1', 'p2'])
        expect(state.activePlayerIds).toEqual([])
    })

    it('breaks a Credits tie via the President of the highest-Mining-Capacity Corporation', () => {
        const state = createTestState()
        state.getPlayerState('p1').addLiquidFunds(50)
        state.getPlayerState('p2').addLiquidFunds(50)
        state.getCorporation(CorporationId.PinkInc).issueShareToPlayer('p1', 0)
        // A Neutral Planet (baseValue 3) gives PinkInc a higher Mining Capacity than any other
        // Corporation's Setup-only Outpost.
        state.board.buildOutpost('5,0', CorporationId.PinkInc)
        const handler = new EndOfGameStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual(['p1'])
    })

    it('rejects every action as an invalid, terminal state', () => {
        const state = createTestState()
        const handler = new EndOfGameStateHandler()
        const context = createMachineContext(state)

        expect(handler.isValidAction({ type: 'AnyAction' } as never, context)).toBe(false)
        expect(handler.validActionsForPlayer('p1', context)).toEqual([])
        expect(() => handler.onAction({} as never, context)).toThrow()
    })
})
