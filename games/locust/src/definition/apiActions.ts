import type * as Type from 'typebox'
import { ActionType } from './actions.js'
import { PlaceCube } from '../actions/placeCube.js'
import { Jump } from '../actions/jump.js'
import { Breed } from '../actions/breed.js'
import { Hatch } from '../actions/hatch.js'
import { Cannibalize } from '../actions/cannibalize.js'
import { Swarm } from '../actions/swarm.js'
import { RelocateLocusts } from '../actions/relocateLocusts.js'
import { MatureNymphs } from '../actions/matureNymphs.js'
import { ScoreRegion } from '../actions/scoreRegion.js'
import { AssignDuelScoring } from '../actions/assignDuelScoring.js'

export const LocustApiActions: Record<string, Type.TSchema> = {
    [ActionType.PlaceCube]: PlaceCube,
    [ActionType.Jump]: Jump,
    [ActionType.Breed]: Breed,
    [ActionType.Hatch]: Hatch,
    [ActionType.Cannibalize]: Cannibalize,
    [ActionType.Swarm]: Swarm,
    [ActionType.RelocateLocusts]: RelocateLocusts,
    [ActionType.MatureNymphs]: MatureNymphs,
    [ActionType.ScoreRegion]: ScoreRegion,
    [ActionType.AssignDuelScoring]: AssignDuelScoring
}
