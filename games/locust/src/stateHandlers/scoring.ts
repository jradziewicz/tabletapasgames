import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ScoreRegion, isScoreRegion } from '../actions/scoreRegion.js'
import { ScoringCount } from '../data/rules.js'
import type { HydratedLocustGameState } from '../model/gameState.js'

export class ScoringStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedLocustGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLocustGameState>
    ): boolean {
        return isScoreRegion(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedLocustGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedLocustGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(ScoreRegion)
    }

    onAction(_action: HydratedAction, context: MachineContext<HydratedLocustGameState>): string {
        const state = context.gameState
        if (state.scoringsDone < ScoringCount) {
            return state.nextCubeSpaceId() === undefined
                ? MachineState.Scoring
                : MachineState.ChooseSpace
        }
        return state.isDuel ? MachineState.AssignDuelScoring : MachineState.EndOfGame
    }
}
