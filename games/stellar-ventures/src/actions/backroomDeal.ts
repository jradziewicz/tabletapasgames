import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporatePowerId, HydratedCorporationState } from '../model/corporation.js'
import { MachineState } from '../definition/states.js'

// Since Backroom Deal is a single unique physical tile, at most 1 Corporation can ever hold it -
// no corporationId parameter is needed on the action itself; this simply finds whichever one
// (if any) currently has it active. Shared with actions/declineBackroomDeal.ts and
// stateHandlers/liquidation.ts.
export function backroomDealCorporation(
    state: HydratedStellarVenturesGameState
): HydratedCorporationState | undefined {
    return state.corporations.find((corporation) =>
        corporation.hasActivePower(CorporatePowerId.BackroomDeal)
    )
}

export enum BackroomDealDirection {
    Up = 'up',
    Down = 'down'
}

// Glossary (page 29): "Liquidation, One-Time (before Hostile Takeover). Move the Alien Mining
// Capacity up or down by one row." Confirmed by the game's co-designer: 1 row = ±3 (matching the
// existing chevrons * 3 convention - see actions/signTheAgreement.ts, operations/shipOrdering.ts).
export const BACKROOM_DEAL_MINING_CAPACITY_DELTA = 3

export type BackroomDeal = Type.Static<typeof BackroomDeal>
export const BackroomDeal = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BackroomDeal),
            playerId: Type.String(),
            direction: Type.Enum(BackroomDealDirection)
        })
    ])
)

export const BackroomDealValidator = Compile(BackroomDeal)

export function isBackroomDeal(action?: GameAction): action is BackroomDeal {
    return action?.type === ActionType.BackroomDeal
}

/**
 * Backroom Deal (Corporate Power Glossary, page 29): "Liquidation, One-Time (before Hostile
 * Takeover). Move the Alien Mining Capacity up or down by one row." Offered once, right at the
 * start of Liquidation, to the President of whichever Corporation holds it (see
 * backroomDealCorporation above) - before the automatic Hostile Takeover / Share Liquidation
 * System action runs - see stateHandlers/liquidation.ts. state.backroomDealResolved gates this so
 * it's only ever offered once, whether used (here) or declined
 * (actions/declineBackroomDeal.ts).
 */
export class HydratedBackroomDeal
    extends HydratableAction<typeof BackroomDeal>
    implements BackroomDeal
{
    declare type: ActionType.BackroomDeal
    declare playerId: string
    declare direction: BackroomDealDirection

    constructor(data: BackroomDeal) {
        super(data, BackroomDealValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonBackroomDealInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporation = backroomDealCorporation(state)!

        const delta =
            this.direction === BackroomDealDirection.Up
                ? BACKROOM_DEAL_MINING_CAPACITY_DELTA
                : -BACKROOM_DEAL_MINING_CAPACITY_DELTA
        state.alienCorporation.miningCapacity = Math.max(
            0,
            state.alienCorporation.miningCapacity + delta
        )

        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.BackroomDeal
        )
        state.backroomDealResolved = true
    }

    isValidBackroomDeal(state: HydratedStellarVenturesGameState): boolean {
        return HydratedBackroomDeal.canBackroomDeal(state, this.playerId)
    }

    reasonBackroomDealInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedBackroomDeal.reasonBackroomDealInvalid(state, this.playerId)
    }

    static canBackroomDeal(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedBackroomDeal.reasonBackroomDealInvalid(state, playerId) === undefined
    }

    static reasonBackroomDealInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.machineState !== MachineState.Liquidation) {
            return 'Backroom Deal can only be used during Liquidation'
        }
        if (state.backroomDealResolved) {
            return 'Backroom Deal has already been resolved this game'
        }
        const corporation = backroomDealCorporation(state)
        if (corporation?.getPresidentPlayerId() !== playerId) {
            return 'Only the President of the Corporation holding Backroom Deal may use it'
        }
        return undefined
    }
}
