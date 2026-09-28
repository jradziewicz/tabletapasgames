import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type IncreaseAlienMiningCapacity = Type.Static<typeof IncreaseAlienMiningCapacity>
export const IncreaseAlienMiningCapacity = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.IncreaseAlienMiningCapacity),
            playerId: Type.String()
        })
    ])
)

export const IncreaseAlienMiningCapacityValidator = Compile(IncreaseAlienMiningCapacity)

export function isIncreaseAlienMiningCapacity(
    action?: GameAction
): action is IncreaseAlienMiningCapacity {
    return action?.type === ActionType.IncreaseAlienMiningCapacity
}

/**
 * "Increase Alien" - one of the two options Secret Agents (Amethyst Agency's own Formation
 * Power, Glossary page 29) offers the President after building an Outpost on an Alien Planet
 * with a still-hidden Alien Agreement Tile. Only offered when a hidden tile actually exists -
 * see stateHandlers/offerSecretAgentsChoice.ts / operations/agreement.ts's
 * isEligibleForSecretAgentsChoice - since a hex with no tile left has nothing to flip.
 *
 * Identical tile-flip effect to Sign The Agreement's own step 1 (actions/signTheAgreement.ts):
 * reveal the tile's chevrons and increase the Alien Corporation's Mining Capacity by 3 per
 * chevron, then discard the tile. Unlike Sign The Agreement, this doesn't end any in-progress
 * build, issue a Share, pay a Bonus Dividend, or flip/discard any Power - Amethyst simply keeps
 * Secret Agents and (if applicable) keeps building.
 */
export class HydratedIncreaseAlienMiningCapacity
    extends HydratableAction<typeof IncreaseAlienMiningCapacity>
    implements IncreaseAlienMiningCapacity
{
    declare type: ActionType.IncreaseAlienMiningCapacity
    declare playerId: string

    constructor(data: IncreaseAlienMiningCapacity) {
        super(data, IncreaseAlienMiningCapacityValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonIncreaseAlienMiningCapacityInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const hexId = state.secretAgentsHexId
        assertExists(hexId, 'A hex should be pending the Secret Agents choice')
        const hex = state.board.requireHex(hexId)

        const chevrons = hex.alienAgreementTileChevrons ?? 0
        hex.alienAgreementTileHidden = false
        hex.alienAgreementTileRemoved = true
        state.alienCorporation.miningCapacity += chevrons * 3
        // "Increase Alien" always flips a still-hidden tile (canIncreaseAlienMiningCapacity
        // guarantees that's the only way this action is ever legal), so Undo must not be able to
        // step back past it - see GameSession.undoableAction, which refuses to cross any action
        // flagged revealsInfo. "Increase Amethyst" is the other of Secret Agents' two choices and
        // deliberately does NOT do this - it discards the tile without ever revealing it.
        this.revealsInfo = true
    }

    isValidIncreaseAlienMiningCapacity(state: HydratedStellarVenturesGameState): boolean {
        return HydratedIncreaseAlienMiningCapacity.canIncreaseAlienMiningCapacity(
            state,
            this.playerId
        )
    }

    reasonIncreaseAlienMiningCapacityInvalid(
        state: HydratedStellarVenturesGameState
    ): string | undefined {
        return HydratedIncreaseAlienMiningCapacity.reasonIncreaseAlienMiningCapacityInvalid(
            state,
            this.playerId
        )
    }

    static canIncreaseAlienMiningCapacity(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return (
            HydratedIncreaseAlienMiningCapacity.reasonIncreaseAlienMiningCapacityInvalid(
                state,
                playerId
            ) === undefined
        )
    }

    static reasonIncreaseAlienMiningCapacityInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const corporationId = state.secretAgentsCorporationId
        const hexId = state.secretAgentsHexId
        if (!corporationId || !hexId) {
            return 'No Secret Agents choice is currently pending'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may make this choice'
        }
        // Only a legal choice while the tile is actually still hidden - once it's used up,
        // Increase Amethyst is the sole option and this hex is auto-resolved instead (see
        // stateHandlers/offerSecretAgentsChoice.ts).
        const hex = state.board.getHex(hexId)
        if (hex?.alienAgreementTileHidden !== true) {
            return 'There is no hidden Alien Agreement Tile there'
        }
        return undefined
    }
}
