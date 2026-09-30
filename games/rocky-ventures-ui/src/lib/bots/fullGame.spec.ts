import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    defaultGameConfig,
    normalizeGameConfig,
    validateGameResult,
    type GameAction
} from '@tabletop/common'
import { Definition, type RockyVenturesGameState } from '@tabletop/rocky-ventures'
import { describe, expect, it } from 'vitest'
import { BotProfile, chooseBotMoves } from './rockyBots.js'

// Plays whole games headlessly with the table's bots through the real engine, to catch games
// that stall, crash, or finish with a result the server would refuse to save.
const engine = new GameEngine(Definition.runtime)
// Real games take roughly 120-200 actions; bot games that run far past that are cut off
const MaxActions = 400

function createGame(playerCount: number, seed: number) {
    return Definition.runtime.initializer.initializeGame(
        {
            id: `rocky-sim-${playerCount}-${seed}`,
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: Array.from({ length: playerCount }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function playOut(playerCount: number, seed: number) {
    const unstarted = createGame(playerCount, seed)
    const { startedGame: game, initialState } = engine.startGame(unstarted)
    let state: RockyVenturesGameState = initialState
    const profiles = new Map(
        game.players.map((player, index) => [player.id, index % 2 === 0 ? BotProfile.Hunter : BotProfile.Tax])
    )
    let actions = 0
    while (!state.result) {
        if (actions >= MaxActions) {
            // Bots can run a game into a deck-out dead end that real players don't (Justin,
            // 2026-09-30), so a long game isn't a failure - only crashes, stuck turns and bad results are
            return { state, actions, finished: false }
        }
        const playerId = state.activePlayerIds[0]
        if (!playerId) {
            throw new Error(`no active player in machine state ${state.machineState}`)
        }
        const profile = profiles.get(playerId)
        if (!profile) {
            throw new Error(`active player ${playerId} is not a seated player`)
        }
        const validTypes = engine.getValidActionTypesForPlayer(game, state, playerId)
        const hydrated = Definition.runtime.hydrator.hydrateState(state)
        const moves = chooseBotMoves(hydrated, playerId, profile, validTypes)
        let applied = false
        const errors: string[] = []
        for (const move of moves) {
            const action = {
                ...move,
                id: `a${actions}`,
                gameId: game.id,
                source: ActionSource.User,
                playerId
            } as GameAction
            try {
                        state = engine.executeCanonicalAction({ game, state, action }).updatedState
                applied = true
                break
            } catch (error) {
                errors.push(`${move.type}: ${error instanceof Error ? error.message : String(error)}`)
            }
        }
        if (!applied) {
            throw new Error(
                `${playerId} stuck in ${state.machineState} (valid: ${validTypes.join(', ') || 'none'}; ` +
                    `${moves.length} bot moves, errors: ${errors.slice(0, 3).join(' | ') || 'none'})`
            )
        }
        actions += 1
    }
    validateGameResult(state)
    return { state, actions, finished: true }
}

const Seeds = [11, 22, 33, 44, 55, 66, 77, 88]

describe.each([2, 3, 4, 5])('Rocky Ventures full games with %i players', (playerCount) => {
    it('seeded bot games play without errors and finish with a result the server accepts', () => {
        const failures: string[] = []
        let finished = 0
        for (const seed of Seeds) {
            try {
                if (playOut(playerCount, seed).finished) finished += 1
            } catch (error) {
                failures.push(`seed ${seed}: ${error instanceof Error ? error.message : String(error)}`)
            }
        }
        expect(failures).toEqual([])
        // Most games should still reach a proper end, so a rules change that stalls every game is caught
        expect(finished).toBeGreaterThanOrEqual(3)
    }, 300_000)
})
