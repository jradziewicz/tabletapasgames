import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { startShareAuction } from '../operations/shareAuction.js'

export type IssueShare = Type.Static<typeof IssueShare>
export const IssueShare = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.IssueShare),
            playerId: Type.String()
        })
    ])
)

export const IssueShareValidator = Compile(IssueShare)

export function isIssueShare(action?: GameAction): action is IssueShare {
    return action?.type === ActionType.IssueShare
}

/**
 * The Corporation's President chooses to issue its next available share, opening an auction
 * (see PlaceShareBid / PassShareBid) that all players may bid in. Bidding proceeds in turn
 * order, starting with (and going clockwise from) the President - who, as the opening bidder,
 * must place an opening bid (see PassShareBid - $0 is allowed) before anyone can pass.
 */
export class HydratedIssueShare
    extends HydratableAction<typeof IssueShare>
    implements IssueShare
{
    declare type: ActionType.IssueShare
    declare playerId: string

    constructor(data: IssueShare) {
        super(data, IssueShareValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonIssueShareInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.activeCorporationId
        assertExists(corporationId, 'Active corporation id should be present while issuing a share')

        startShareAuction(state, `share-auction-${corporationId}`, this.playerId)
    }

    isValidIssueShare(state: HydratedStellarVenturesGameState): boolean {
        return HydratedIssueShare.canIssueShare(state, this.playerId)
    }

    reasonIssueShareInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedIssueShare.reasonIssueShareInvalid(state, this.playerId)
    }

    static canIssueShare(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedIssueShare.reasonIssueShareInvalid(state, playerId) === undefined
    }

    static reasonIssueShareInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.activeShareAuction) {
            return 'A Share Auction is already in progress'
        }
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return 'No Corporation is currently active'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.availableShareCount <= 0) {
            return 'No Shares remain to issue'
        }
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President may Issue a Share'
        }
        return undefined
    }
}
