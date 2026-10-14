import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { ChooseSpaceStateHandler } from '../stateHandlers/chooseSpace.js'
import { PerformActionStateHandler } from '../stateHandlers/performAction.js'
import { RelocateLocustsStateHandler } from '../stateHandlers/relocateLocusts.js'
import { ScoringStateHandler } from '../stateHandlers/scoring.js'
import { AssignDuelScoringStateHandler } from '../stateHandlers/assignDuelScoring.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import type { HydratedLocustGameState } from '../model/gameState.js'

export const LocustStateHandlers: Record<
    string,
    MachineStateHandler<HydratedAction, HydratedLocustGameState>
> = {
    [MachineState.ChooseSpace]: new ChooseSpaceStateHandler(),
    [MachineState.PerformAction]: new PerformActionStateHandler(),
    [MachineState.RelocateLocusts]: new RelocateLocustsStateHandler(),
    [MachineState.Scoring]: new ScoringStateHandler(),
    [MachineState.AssignDuelScoring]: new AssignDuelScoringStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
