import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedLocustGameState, LocustGameState } from '../model/gameState.js'
import { HydratedPlaceCube, isPlaceCube } from '../actions/placeCube.js'
import { HydratedJump, isJump } from '../actions/jump.js'
import { HydratedBreed, isBreed } from '../actions/breed.js'
import { HydratedHatch, isHatch } from '../actions/hatch.js'
import { HydratedCannibalize, isCannibalize } from '../actions/cannibalize.js'
import { HydratedSwarm, isSwarm } from '../actions/swarm.js'
import { HydratedRelocateLocusts, isRelocateLocusts } from '../actions/relocateLocusts.js'
import { HydratedMatureNymphs, isMatureNymphs } from '../actions/matureNymphs.js'
import { HydratedScoreRegion, isScoreRegion } from '../actions/scoreRegion.js'
import { HydratedAssignDuelScoring, isAssignDuelScoring } from '../actions/assignDuelScoring.js'

export class LocustHydrator implements GameHydrator<LocustGameState, HydratedLocustGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceCube(data):
                return new HydratedPlaceCube(data)
            case isJump(data):
                return new HydratedJump(data)
            case isBreed(data):
                return new HydratedBreed(data)
            case isHatch(data):
                return new HydratedHatch(data)
            case isCannibalize(data):
                return new HydratedCannibalize(data)
            case isSwarm(data):
                return new HydratedSwarm(data)
            case isRelocateLocusts(data):
                return new HydratedRelocateLocusts(data)
            case isMatureNymphs(data):
                return new HydratedMatureNymphs(data)
            case isScoreRegion(data):
                return new HydratedScoreRegion(data)
            case isAssignDuelScoring(data):
                return new HydratedAssignDuelScoring(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: LocustGameState): HydratedLocustGameState {
        return new HydratedLocustGameState(state)
    }
}
