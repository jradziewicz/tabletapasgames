import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { awardSecretAgentsMiningCapacityBonus } from '../operations/agreement.js'

export type IncreaseAmethystMiningCapacity = Type.Static<typeof IncreaseAmethystMiningCapacity>
export const IncreaseAmethystMiningCapacity = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.IncreaseAmethystMiningCapacity),
            playerId: Type.String()
        })
    ])
)

export const IncreaseAmethystMiningCapacityValidator = Compile(IncreaseAmethystMiningCapacity)

export function isIncreaseAmethystMiningCapacity(
    action?: GameAction
): action is IncreaseAmethystMiningCapacity {
    return action?.type === ActionType.IncreaseAmethystMiningCapacity
}

/**
 * "Increase Amethyst" - the other of Secret Agents' two options (see
 * actions/increaseAlienMiningCapacity.ts's docs for the full context). Permanently increases the
 * Corporation's own Mining Capacity by 3 (operations/agreement.ts's
 * awardSecretAgentsMiningCapacityBonus / SECRET_AGENTS_MINING_CAPACITY_BONUS) and discards the
 * Alien Planet's tile - whether it was still hidden or already used up, this is always a legal
 * choice (it's the ONLY legal choice once the tile's already used up, which is why the state
 * handler auto-resolves that case without even offering IncreaseAlienMiningCapacity - see
 * stateHandlers/offerSecretAgentsChoice.ts).
 */
export class HydratedIncreaseAmethystMiningCapacity
    extends HydratableAction<typeof IncreaseAmethystMiningCapacity>
    implements IncreaseAmethystMiningCapacity
{
    declare type: ActionType.IncreaseAmethystMiningCapacity
    declare playerId: string

    constructor(data: IncreaseAmethystMiningCapacity) {
        super(data, IncreaseAmethystMiningCapacityValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonIncreaseAmethystMiningCapacityInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.secretAgentsCorporationId
        const hexId = state.secretAgentsHexId
        assertExists(corporationId, 'A Corporation should be pending the Secret Agents choice')
        assertExists(hexId, 'A hex should be pending the Secret Agents choice')

        awardSecretAgentsMiningCapacityBonus(state, corporationId, hexId)
    }

    isValidIncreaseAmethystMiningCapacity(state: HydratedStellarVenturesGameState): boolean {
        return HydratedIncreaseAmethystMiningCapacity.canIncreaseAmethystMiningCapacity(
            state,
            this.playerId
        )
    }

    reasonIncreaseAmethystMiningCapacityInvalid(
        state: HydratedStellarVenturesGameState
    ): string | undefined {
        return HydratedIncreaseAmethystMiningCapacity.reasonIncreaseAmethystMiningCapacityInvalid(
            state,
            this.playerId
        )
    }

    static canIncreaseAmethystMiningCapacity(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return (
            HydratedIncreaseAmethystMiningCapacity.reasonIncreaseAmethystMiningCapacityInvalid(
                state,
                playerId
            ) === undefined
        )
    }

    static reasonIncreaseAmethystMiningCapacityInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const corporationId = state.secretAgentsCorporationId
        if (!corporationId) {
            return 'No Secret Agents choice is currently pending'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may make this choice'
        }
        return undefined
    }
}
