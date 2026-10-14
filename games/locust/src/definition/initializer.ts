import {
    type GameInitializer,
    assertExists,
    Color,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState,
    Game,
    HydratedTurnManager,
    shuffle
} from '@tabletop/common'
import { ActionSpaces, StartHabitatIds, spacesInTurnOrder } from '../data/board.js'
import {
    ColonyColors,
    CubesPerColonyByColonyCount,
    DiscsPerColony,
    DuelPlayerCount,
    StartingSupply
} from '../data/rules.js'
import { HydratedBoardState, InsectKind, emptyBoard } from '../model/board.js'
import type { ColonyState } from '../model/colony.js'
import { HydratedLocustGameState, LocustGameState } from '../model/gameState.js'
import { LocustPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'

const DuelColonyCount = 4

export class LocustGameInitializer
    extends BaseGameInitializer<LocustGameState, HydratedLocustGameState>
    implements GameInitializer<LocustGameState, HydratedLocustGameState>
{
    initializeGameState(game: Game, state: UninitializedGameState): HydratedLocustGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.Green })),
            prng.random
        )
        const colors = [...ColonyColors]
        shuffle(colors, prng.random)

        const colonies = this.initializeColonies(turnManager.turnOrder, colors)
        const players: LocustPlayerState[] = turnManager.turnOrder.map((playerId) => {
            const firstColony = colonies.find((colony) => colony.playerId === playerId)
            assertExists(firstColony, `Player ${playerId} has no colony`)
            return { playerId, color: firstColony.color }
        })

        const locustState: LocustGameState = Object.assign(state, {
            players,
            machineState: MachineState.ChooseSpace,
            turnManager,
            colonies,
            board: this.initializeBoard(colonies),
            activeRegion: 0,
            scoringsDone: 0
        })
        return new HydratedLocustGameState(locustState)
    }

    // Duel: one player runs colours 1 and 3, the other 2 and 4.
    private initializeColonies(turnOrder: string[], colors: typeof ColonyColors): ColonyState[] {
        const colonyCount =
            turnOrder.length === DuelPlayerCount ? DuelColonyCount : turnOrder.length
        return colors.slice(0, colonyCount).map((color, index) => {
            const playerId = turnOrder[index % turnOrder.length]
            assertExists(playerId, 'Every colony needs an owner')
            return {
                color,
                playerId,
                supply: StartingSupply - StartHabitatIds.length,
                dead: DiscsPerColony - StartingSupply,
                vigor: 0,
                tokens: []
            }
        })
    }

    private initializeBoard(colonies: ColonyState[]) {
        const board = new HydratedBoardState(emptyBoard())
        for (const habitatId of StartHabitatIds) {
            for (const colony of colonies) {
                board.add(habitatId, colony.color, InsectKind.Grasshopper)
            }
        }
        const cubesPerColony = CubesPerColonyByColonyCount[colonies.length]
        assertExists(cubesPerColony, `No cube count for ${colonies.length} colonies`)
        const cubeColors = Array.from({ length: cubesPerColony }, () =>
            colonies.map((colony) => colony.color)
        ).flat()
        spacesInTurnOrder(0).forEach((space, index) => {
            const color = cubeColors[index]
            if (color !== undefined) {
                board.placeCube(space.id, color)
            }
        })
        for (const space of ActionSpaces) {
            if (space.bonus) {
                board.bonusTokens[space.id] = space.bonus
            }
        }
        return board
    }
}
