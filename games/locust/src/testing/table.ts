import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    defaultGameConfig,
    normalizeGameConfig,
    type Game,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition/gameDefinition.js'
import { HydratedLocustGameState, type LocustGameState } from '../model/gameState.js'

const engine = new GameEngine(Definition.runtime)

export function createLocustGame(playerCount: number, seed: number): Game {
    return Definition.runtime.initializer.initializeGame(
        {
            id: `locust-${playerCount}-${seed}`,
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed,
            config: normalizeGameConfig(
                defaultGameConfig(Definition.info.configurator?.options ?? [])
            ),
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

export class LocustTable {
    readonly game: Game
    state: LocustGameState
    processed: GameAction[] = []
    private actionCounter = 0

    constructor(playerCount: number, seed: number = 1) {
        const { startedGame, initialState } = engine.startGame(createLocustGame(playerCount, seed))
        this.game = startedGame
        this.state = initialState
    }

    get view(): HydratedLocustGameState {
        return new HydratedLocustGameState(this.state)
    }

    edit(change: (state: HydratedLocustGameState) => void) {
        const hydrated = this.view
        change(hydrated)
        this.state = hydrated.dehydrate()
    }

    validActionTypes(playerId: string): string[] {
        return engine.getValidActionTypesForPlayer(this.game, this.state, playerId)
    }

    act(type: string, fields: Record<string, unknown> = {}, playerId?: string): GameAction[] {
        const actorId = playerId ?? this.state.activePlayerIds[0]
        const action: GameAction = {
            ...fields,
            type,
            id: `a${this.actionCounter++}`,
            gameId: this.game.id,
            source: ActionSource.User,
            playerId: actorId
        }
        const result = engine.executeCanonicalAction({ game: this.game, state: this.state, action })
        this.state = result.updatedState
        this.processed.push(...result.processedActions)
        return result.processedActions
    }
}
