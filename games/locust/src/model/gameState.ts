import {
    Color,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionKind,
    FinalRegion,
    HabitatColor,
    getHabitat,
    getSpace,
    spacesInTurnOrder
} from '../data/board.js'
import { OpenRuleDefaults, WhiteCubeColonyCount, WhiteCubeRegion } from '../data/rules.js'
import { MachineState } from '../definition/states.js'
import { BoardState, HydratedBoardState } from './board.js'
import { ColonyState, HydratedColonyState } from './colony.js'
import { HydratedLocustPlayerState, LocustPlayerState } from './playerState.js'

export type PendingAction = Type.Static<typeof PendingAction>
export const PendingAction = Type.Object({
    spaceId: Type.String(),
    kind: Type.Enum(ActionKind),
    level: Type.Number(),
    color: Type.Optional(Type.Enum(HabitatColor)),
    alternative: Type.Boolean()
})

export type SwarmState = Type.Static<typeof SwarmState>
export const SwarmState = Type.Object({
    habitatId: Type.String(),
    queue: Type.Array(Type.String()),
    relocators: Type.Array(Type.Enum(Color))
})

export type LocustGameState = Type.Static<typeof LocustGameState>
export const LocustGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(LocustPlayerState),
            machineState: Type.Enum(MachineState),
            colonies: Type.Array(ColonyState),
            board: BoardState,
            activeRegion: Type.Number(),
            scoringsDone: Type.Number(),
            activeColor: Type.Optional(Type.Enum(Color)),
            pendingAction: Type.Optional(PendingAction),
            swarm: Type.Optional(SwarmState)
        })
    ])
)

export const LocustGameStateValidator = Compile(LocustGameState)

export class HydratedLocustGameState
    extends HydratableGameState<typeof LocustGameState, HydratedLocustPlayerState>
    implements LocustGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedLocustPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare colonies: HydratedColonyState[]
    declare board: HydratedBoardState
    declare activeRegion: number
    declare scoringsDone: number
    declare activeColor?: Color
    declare pendingAction?: PendingAction
    declare swarm?: SwarmState

    constructor(data: LocustGameState) {
        super(data, LocustGameStateValidator)
        this.players = data.players.map((player) => new HydratedLocustPlayerState(player))
        this.colonies = data.colonies.map((colony) => new HydratedColonyState(colony))
        this.board = new HydratedBoardState(data.board)
    }

    get isDuel(): boolean {
        return this.colonies.length > this.players.length
    }

    colony(color: Color): HydratedColonyState {
        const colony = this.colonies.find((candidate) => candidate.color === color)
        if (!colony) {
            throw Error(`No colony with color ${color}`)
        }
        return colony
    }

    coloniesOf(playerId: string): HydratedColonyState[] {
        return this.colonies.filter((colony) => colony.playerId === playerId)
    }

    get activeColony(): HydratedColonyState {
        if (this.activeColor === undefined) {
            throw Error('No colony is active')
        }
        return this.colony(this.activeColor)
    }

    cubesInRegion(region: number): number {
        const placed = Object.keys(this.board.cubes).filter(
            (spaceId) => getSpace(spaceId).region === region
        )
        const unlimited = Object.entries(this.board.unlimitedCubes)
            .filter(([spaceId]) => getSpace(spaceId).region === region)
            .reduce((sum, [, cubes]) => sum + cubes.length, 0)
        return (
            placed.length +
            (OpenRuleDefaults.unlimitedSpacesCountAsRain ? unlimited : 0) +
            (this.hasWhiteCubeIn(region) ? 1 : 0)
        )
    }

    hasWhiteCubeIn(region: number): boolean {
        return (
            OpenRuleDefaults.whiteCubeIsRain &&
            region === WhiteCubeRegion &&
            this.colonies.length === WhiteCubeColonyCount
        )
    }

    habitatCapacity(habitatId: string): number {
        return this.cubesInRegion(getHabitat(habitatId).region)
    }

    isCrowded(habitatId: string): boolean {
        return this.board.discsIn(habitatId) > this.habitatCapacity(habitatId)
    }

    freeRoom(habitatId: string): number {
        return Math.max(0, this.habitatCapacity(habitatId) - this.board.discsIn(habitatId))
    }

    nextCubeSpaceId(): string | undefined {
        return spacesInTurnOrder(this.activeRegion).find(
            (space) => this.board.cubeOn(space.id) !== undefined
        )?.id
    }

    get isFinalRound(): boolean {
        return this.activeRegion === FinalRegion - 1
    }

    isAlternativeActionAvailable(): boolean {
        return this.colonies.length === 4 || this.isFinalRound
    }
}
