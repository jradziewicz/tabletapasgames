import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { AlienTechActionId } from '../model/investorBoard.js'
import { canSelectAlienTechActionId } from '../operations/investorShenanigans.js'

export type Launder = Type.Static<typeof Launder>
export const Launder = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Launder),
            playerId: Type.String(),
            amount: Type.Number()
        })
    ])
)

export const LaunderValidator = Compile(Launder)

export function isLaunder(action?: GameAction): action is Launder {
    return action?.type === ActionType.Launder
}

// Rulebook page 19: "Discard 1 or 2 cubes for 2 or 5 directly into Liquid Funds."
export const LaunderPayoutByAmount: Record<number, number> = {
    1: 2,
    2: 5
}

/**
 * Investor Shenanigans' Launder Alien Tech Action (rulebook page 19): discard 1 or 2 Alien
 * Technology cubes for 2 or 5 Credits respectively, straight into the player's own Liquid Funds
 * (not the Corporate Treasury). Available to any player regardless of Shareholder status,
 * unlike Cargo Boost and Research Wormhole (not yet implemented - see the game's task list).
 */
export class HydratedLaunder extends HydratableAction<typeof Launder> implements Launder {
    declare type: ActionType.Launder
    declare playerId: string
    declare amount: number

    constructor(data: Launder) {
        super(data, LaunderValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonLaunderInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const player = state.getPlayerState(this.playerId)
        const payout = LaunderPayoutByAmount[this.amount]!
        player.spendAlienTechCubes(this.amount)
        player.addLiquidFunds(payout)
        player.lastAlienTechActionId = AlienTechActionId.Launder
    }

    isValidLaunder(state: HydratedStellarVenturesGameState): boolean {
        return HydratedLaunder.canLaunder(state, this.playerId, this.amount)
    }

    reasonLaunderInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedLaunder.reasonLaunderInvalid(state, this.playerId, this.amount)
    }

    static canLaunder(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        amount: number
    ): boolean {
        return HydratedLaunder.reasonLaunderInvalid(state, playerId, amount) === undefined
    }

    static reasonLaunderInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        amount: number
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        if (!canSelectAlienTechActionId(state, playerId, AlienTechActionId.Launder)) {
            return 'Launder is not available right now'
        }
        if (LaunderPayoutByAmount[amount] === undefined) {
            return 'Launder can only be done for 1 or 2 cubes'
        }
        if (state.getPlayerState(playerId).alienTechCubes < amount) {
            return 'Insufficient Alien Technology cubes'
        }
        return undefined
    }

    // Whether to even offer Launder as an option (at either amount) - used by the state
    // handler's validActionsForPlayer.
    static canOfferLaunder(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return false
        }
        if (!canSelectAlienTechActionId(state, playerId, AlienTechActionId.Launder)) {
            return false
        }
        return state.getPlayerState(playerId).alienTechCubes >= 1
    }
}
