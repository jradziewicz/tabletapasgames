import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporatePowerId } from '../model/corporation.js'
import { agreementTrackEntryForPlanetCount, alienPlanetOutpostCount } from '../operations/agreement.js'
import { finalizeExpansion } from '../operations/network.js'

export type SignTheAgreement = Type.Static<typeof SignTheAgreement>
export const SignTheAgreement = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SignTheAgreement),
            playerId: Type.String(),
            hexId: Type.String()
        })
    ])
)

export const SignTheAgreementValidator = Compile(SignTheAgreement)

export function isSignTheAgreement(action?: GameAction): action is SignTheAgreement {
    return action?.type === ActionType.SignTheAgreement
}

/**
 * Sign The Agreement (rulebook page 22). Offered only via OfferSignTheAgreementStateHandler,
 * immediately after a single Outpost is built on an Alien Planet with a still-hidden Alien
 * Agreement Tile - state.signTheAgreementCorporationId / signTheAgreementHexId name which
 * Corporation and which just-built hex qualifies (see operations/agreement.ts's
 * isEligibleToSignTheAgreement). hexId must match that hex - the President can only flip the tile
 * they were just offered.
 *
 * "End Expansion" (rulebook page 22): choosing to sign ends the in-progress build immediately, so
 * this is run as one atomic step that first finalizes whatever Expand Network or Private
 * Contractor build is in progress (operations/network.ts's finalizeExpansion - charging its full
 * accumulated cost as a lump sum, based on the total Outposts built this action - and clearing
 * the transient expanding* fields, a no-op if this Sign The Agreement wasn't reached via one of
 * those builds at all, e.g. Create Wormhole or Jerry-Rig), then resolves signing itself:
 *   1. Flip the Alien Agreement Tile: reveal its chevrons and increase the Alien Corporation's
 *      Mining Capacity by 3 per chevron (same "+3 per chevron" rule used by
 *      resolveFirstShipOrderedEffects for Alien Shipyard Tiles).
 *   2. Issue Share to Aliens: move 1 Share from the Charter to the Alien Shareholdings, for no
 *      funds (HydratedCorporationState.issueShareToAlien already does this and nothing else -
 *      Corporation Status recalculates automatically since it's a live getter).
 *   3. Place the Agreement Token: record the Corporation's current Alien Planet Outpost count
 *      (corporation.agreement.planetCountAtSigning) - this is also what marks the Corporation as
 *      having signed, and everything else about the Agreement Token's position (the Bonus
 *      Dividend now, and the Agreement Bonus at Liquidation) is looked up from this count via
 *      operations/agreement.ts's AgreementTrackByPlanetCount, rather than being duplicated here.
 *   4. Bonus Dividend: pay every Shareholder's Frozen Funds the per-Share amount for that
 *      section of the track.
 *   5. Flip Power / Draft Power: discard "Alien Explorers" - the Corporation can no longer build
 *      Outposts on Alien Planets. Drafting a replacement Power from the row of available powers
 *      happens separately, once this action resolves - see stateHandlers/offerSignTheAgreement.ts,
 *      which detours into MachineState.DraftPower (actions/draftPower.ts) before resuming, as
 *      long as the pool isn't empty.
 * Declining, by contrast, does NOT end the build - the President may keep placing Outposts one at
 * a time (potentially reaching further Alien Planets and being offered again each time), which
 * rewards delaying signing to accumulate a higher Alien Planet Outpost count before finally
 * signing. See stateHandlers/offerSignTheAgreement.ts.
 */
export class HydratedSignTheAgreement
    extends HydratableAction<typeof SignTheAgreement>
    implements SignTheAgreement
{
    declare type: ActionType.SignTheAgreement
    declare playerId: string
    declare hexId: string

    constructor(data: SignTheAgreement) {
        super(data, SignTheAgreementValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonSignTheAgreementInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.signTheAgreementCorporationId
        assertExists(corporationId, 'A Corporation should be pending Sign The Agreement')
        const corporation = state.getCorporation(corporationId)
        const hex = state.board.requireHex(this.hexId)

        // End Expansion: choosing to sign ends any in-progress build immediately, charging its
        // full accumulated cost as a lump sum before signing resolves.
        finalizeExpansion(state)

        // 1. Flip the Alien Agreement Tile - then take it off the hex entirely and return it
        //    to the box (alienAgreementTileRemoved), rather than leaving it sitting face up on
        //    the board indefinitely. alienAgreementTileChevrons is left set so it can still be
        //    looked up afterward (AgreementPanel's per-Corporation box shows what was revealed).
        const chevrons = hex.alienAgreementTileChevrons ?? 0
        hex.alienAgreementTileHidden = false
        hex.alienAgreementTileRemoved = true
        state.alienCorporation.miningCapacity += chevrons * 3
        // Signing always flips a still-hidden tile (isEligibleToSignTheAgreement/
        // hasHiddenAlienAgreementTile guarantee that's the only way this action is ever offered),
        // so Undo must not be able to step back past it - see GameSession.undoableAction, which
        // refuses to cross any action flagged revealsInfo.
        this.revealsInfo = true

        // 2. Issue Share to Aliens.
        corporation.issueShareToAlien(state.actionCount)

        // 3. Place the Agreement Token.
        const planetCount = alienPlanetOutpostCount(state.board, corporationId)
        corporation.agreement = { planetCountAtSigning: planetCount }

        // 4. Bonus Dividend.
        const { bonusDividendPerShare } = agreementTrackEntryForPlanetCount(planetCount)
        for (const share of corporation.shares) {
            if (share.owner?.type === 'player') {
                state.getPlayerState(share.owner.playerId).addFrozenFunds(bonusDividendPerShare)
                corporation.addDividendReceived(share.owner.playerId, bonusDividendPerShare)
            }
        }

        // Commit Tax Fraud (Borders & Taxes only) - recorded onto the Agreement Token itself
        // (not just applied to Treasury) so TaxFraudRevealOverlay.svelte can dramatize the exact
        // amount later, from permanent state, for every player who wasn't watching live.
        if (state.usesTaxes) {
            const taxFraud = Math.ceil((state.taxBox ?? 0) / 2)
            state.taxBox = (state.taxBox ?? 0) - taxFraud
            corporation.treasury += taxFraud
            corporation.agreement.taxFraudAmount = taxFraud
        }

        // 5. Flip Power: discard "Alien Explorers" (Draft Power itself happens separately, once
        //    this action resolves - see class docs above).
        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.AlienExplorers
        )
    }

    isValidSignTheAgreement(state: HydratedStellarVenturesGameState): boolean {
        return HydratedSignTheAgreement.canSignTheAgreement(state, this.playerId, this.hexId)
    }

    reasonSignTheAgreementInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedSignTheAgreement.reasonSignTheAgreementInvalid(
            state,
            this.playerId,
            this.hexId
        )
    }

    static canSignTheAgreement(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string
    ): boolean {
        return (
            HydratedSignTheAgreement.reasonSignTheAgreementInvalid(state, playerId, hexId) ===
            undefined
        )
    }

    static reasonSignTheAgreementInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string
    ): string | undefined {
        const corporationId = state.signTheAgreementCorporationId
        if (!corporationId) {
            return 'No Sign The Agreement decision is currently pending'
        }
        if (state.signTheAgreementHexId !== hexId) {
            return 'That is not the hex currently offered for Sign The Agreement'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may Sign The Agreement'
        }
        return undefined
    }
}
