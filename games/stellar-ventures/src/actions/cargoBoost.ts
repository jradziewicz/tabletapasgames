import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId } from '../model/corporation.js'
import { AlienTechActionId } from '../model/investorBoard.js'
import { canSelectAlienTechActionId } from '../operations/investorShenanigans.js'
import { maxCargoForCorporation } from '../operations/shipOrdering.js'

export type CargoBoost = Type.Static<typeof CargoBoost>
export const CargoBoost = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CargoBoost),
            playerId: Type.String(),
            corporationId: Type.Enum(CorporationId),
            amount: Type.Number()
        })
    ])
)

export const CargoBoostValidator = Compile(CargoBoost)

export function isCargoBoost(action?: GameAction): action is CargoBoost {
    return action?.type === ActionType.CargoBoost
}

/**
 * Investor Shenanigans' Cargo Boost Alien Tech Action (rulebook page 19): "If a Shareholder, add
 * 1 or 2 cubes to a Corporation's Charter to increase CARGO by 1 or 2 immediately. Limit 1
 * Corporation." Requires holding at least 1 Share in the target Corporation (not President).
 * Confirmed by the game's co-designer: a "wasted" boost is legal - a player may still spend 1 or
 * 2 cubes even if the Corporation is at (or would be pushed past) the CARGO Track's maximum
 * (operations/shipOrdering.ts's MAX_CARGO - a flat 13 for every Corporation, see
 * maxCargoForCorporation); the actual CARGO gain is simply clamped at that cap, with any excess
 * cube spent for nothing.
 *
 * Every cube spent here (including a "wasted" one) is tracked in
 * corporation.cargoBoostCubesOnCharter - reversible later via Alien Engineering
 * (actions/alienEngineering.ts), which reclaims some or all of them back to the President while
 * reducing CARGO by the same amount.
 */
export class HydratedCargoBoost extends HydratableAction<typeof CargoBoost> implements CargoBoost {
    declare type: ActionType.CargoBoost
    declare playerId: string
    declare corporationId: CorporationId
    declare amount: number

    constructor(data: CargoBoost) {
        super(data, CargoBoostValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonCargoBoostInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporation = state.getCorporation(this.corporationId)
        const player = state.getPlayerState(this.playerId)
        player.spendAlienTechCubes(this.amount)
        corporation.cargo = Math.min(maxCargoForCorporation(corporation), corporation.cargo + this.amount)
        corporation.cargoBoostCubesOnCharter = (corporation.cargoBoostCubesOnCharter ?? 0) + this.amount
        player.lastAlienTechActionId = AlienTechActionId.CargoBoost
    }

    isValidCargoBoost(state: HydratedStellarVenturesGameState): boolean {
        return HydratedCargoBoost.canCargoBoost(state, this.playerId, this.corporationId, this.amount)
    }

    reasonCargoBoostInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedCargoBoost.reasonCargoBoostInvalid(
            state,
            this.playerId,
            this.corporationId,
            this.amount
        )
    }

    static canCargoBoost(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        amount: number
    ): boolean {
        return (
            HydratedCargoBoost.reasonCargoBoostInvalid(state, playerId, corporationId, amount) ===
            undefined
        )
    }

    static reasonCargoBoostInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        corporationId: CorporationId,
        amount: number
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        if (!canSelectAlienTechActionId(state, playerId, AlienTechActionId.CargoBoost)) {
            return 'Cargo Boost is not available right now'
        }
        if (amount !== 1 && amount !== 2) {
            return 'Cargo Boost can only be done for 1 or 2 cubes'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.shareCountForPlayer(playerId) <= 0) {
            return 'You must hold a Share in that Corporation to Cargo Boost it'
        }
        if (state.getPlayerState(playerId).alienTechCubes < amount) {
            return 'Insufficient Alien Technology cubes'
        }
        return undefined
    }

    // Whether to even offer CargoBoost as an option (for any Corporation, at either amount) -
    // used by the state handler's validActionsForPlayer. A Corporation already at MAX_CARGO is
    // still offered - the boost is legal even if it would be entirely wasted.
    static canOfferCargoBoost(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return false
        }
        if (!canSelectAlienTechActionId(state, playerId, AlienTechActionId.CargoBoost)) {
            return false
        }
        if (state.getPlayerState(playerId).alienTechCubes < 1) {
            return false
        }
        return state.corporations.some((corporation) => corporation.shareCountForPlayer(playerId) > 0)
    }
}
