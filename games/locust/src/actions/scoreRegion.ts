import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { RegionScoringResult, scoreActiveRegion } from '../operations/scoring.js'

export type ScoreRegion = Type.Static<typeof ScoreRegion>
export const ScoreRegion = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ScoreRegion),
            metadata: Type.Optional(
                Type.Intersect([RegionScoringResult, Type.Object({ scoredRegion: Type.Number() })])
            )
        })
    ])
)

export const ScoreRegionValidator = Compile(ScoreRegion)

export function isScoreRegion(action?: GameAction): action is ScoreRegion {
    return action?.type === ActionType.ScoreRegion
}

export class HydratedScoreRegion
    extends HydratableAction<typeof ScoreRegion>
    implements ScoreRegion
{
    declare type: ActionType.ScoreRegion
    declare metadata?: RegionScoringResult & { scoredRegion: number }

    constructor(data: ScoreRegion) {
        super(data, ScoreRegionValidator)
    }

    apply(state: HydratedLocustGameState, _context?: MachineContext) {
        const scoredRegion = state.activeRegion
        this.metadata = { ...scoreActiveRegion(state), scoredRegion }
    }
}
