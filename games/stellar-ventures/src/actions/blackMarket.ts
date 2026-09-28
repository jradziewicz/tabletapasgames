import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { InvestorActionId } from '../model/investorBoard.js'
import { canSelectInvestorActionId } from '../operations/investorShenanigans.js'

export type BlackMarket = Type.Static<typeof BlackMarket>
export const BlackMarket = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BlackMarket),
            playerId: Type.String()
        })
    ])
)

export const BlackMarketValidator = Compile(BlackMarket)

export function isBlackMarket(action?: GameAction): action is BlackMarket {
    return action?.type === ActionType.BlackMarket
}

const BOARDROOM_VOTES_COST = 1
const ALIEN_TECH_CUBES_GAINED = 1

/**
 * Investor Shenanigans' Black Market Investor Action (rulebook page 19): "Discard 1 Voting
 * Disc to gain 1 Alien Technology cube. Limit 1 exchange." The "Voting Disc" is the same
 * physical token as a Boardroom Vote (confirmed against the game's token reference art) - see
 * playerState.boardroomVotes. Available to any player regardless of Shareholder/President
 * status, unlike Private Contractor, Jerry-Rig and Insurance Fraud (not yet implemented - see
 * the game's task list).
 */
export class HydratedBlackMarket
    extends HydratableAction<typeof BlackMarket>
    implements BlackMarket
{
    declare type: ActionType.BlackMarket
    declare playerId: string

    constructor(data: BlackMarket) {
        super(data, BlackMarketValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonBlackMarketInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const player = state.getPlayerState(this.playerId)
        player.spendBoardroomVotes(BOARDROOM_VOTES_COST)
        player.addAlienTechCubes(ALIEN_TECH_CUBES_GAINED)
        player.lastInvestorActionId = InvestorActionId.BlackMarket
    }

    isValidBlackMarket(state: HydratedStellarVenturesGameState): boolean {
        return HydratedBlackMarket.canBlackMarket(state, this.playerId)
    }

    reasonBlackMarketInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedBlackMarket.reasonBlackMarketInvalid(state, this.playerId)
    }

    static canBlackMarket(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedBlackMarket.reasonBlackMarketInvalid(state, playerId) === undefined
    }

    static reasonBlackMarketInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return "It is not your Investor Shenanigans turn"
        }
        if (!canSelectInvestorActionId(state, playerId, InvestorActionId.BlackMarket)) {
            return 'Black Market is not available right now'
        }
        if (state.getPlayerState(playerId).boardroomVotes < BOARDROOM_VOTES_COST) {
            return 'Insufficient Voting Discs'
        }
        return undefined
    }

    // Whether to even offer BlackMarket as an option - used by the state handler's
    // validActionsForPlayer. Identical to canBlackMarket since Black Market has no further
    // choices to make (no amount, no target) - kept separate for consistency with every other
    // action's canOffer* convention.
    static canOfferBlackMarket(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedBlackMarket.canBlackMarket(state, playerId)
    }
}
