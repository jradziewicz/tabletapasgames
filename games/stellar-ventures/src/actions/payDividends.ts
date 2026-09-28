import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { dividendPayoutPerShare } from '../operations/dividends.js'
import { effectiveMiningCapacityForCorporation } from '../operations/corporatePowers.js'

// Unlike every other action in this game, PayDividends has no playerId - it's a System action
// (see ActionSource.System / MachineContext.addSystemAction), queued automatically by
// PayDividendsStateHandler.enter() rather than submitted by a player. Pay Dividend is
// "Mandatory" per the rulebook: no player ever decides anything here.
export type PayDividends = Type.Static<typeof PayDividends>
export const PayDividends = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.PayDividends),
            payoutPerShare: Type.Optional(Type.Number())
        })
    ])
)

export const PayDividendsValidator = Compile(PayDividends)

export function isPayDividends(action?: GameAction): action is PayDividends {
    return action?.type === ActionType.PayDividends
}

/**
 * Pays every player holding a Share in the active Corporation the per-Share Dividend amount to
 * their Frozen Funds (released to Liquid Funds later, during the Investor Round's Release
 * Dividends step - see HydratedStellarVenturesPlayerState.releaseDividends). Shares still on the
 * Charter (unissued) or held by the Aliens pay out to nobody, per the rulebook.
 *
 * The payout row is whichever is lower between a CARGO value and a Mining Capacity value; the
 * payout column is the Corporation's own Status (Private/Minor/Major) regardless of either
 * source. Normally both values are this Corporation's own (CARGO directly, Mining Capacity via
 * operations/corporatePowers.ts's effectiveMiningCapacityForCorporation, which folds in Ore
 * Refinement's +3 if active) - but Deep Space Smuggling / Deep Space Pirates
 * (state.payDividendsCopyCargoFromCorporationId / payDividendsCopyMiningCapacityFromCorporationId
 * - see actions/deepSpaceSmuggling.ts, actions/deepSpacePirates.ts,
 * stateHandlers/payDividends.ts) let the President substitute in another Corporation's value for
 * one or both before this runs. Both fields are read and cleared here - they only ever apply to
 * this one Pay Dividends instance. See operations/dividends.ts for the full payout table,
 * transcribed from the game board.
 *
 * Also finally resolves a Ship parked on the Spare Parts tile, if this is that Corporation's turn
 * to Pay Dividends (state.sparePartsParkedCorporationId / sparePartsParkedShipLevel - see
 * actions/spareParts.ts): "delaying its Scrap (and the CARGO reduction) by one Dividend payment"
 * means the parked Ship survives exactly until this moment, then is Scrapped for real - its CARGO
 * reduction applied before this payout is even calculated, so this (delayed) payment already
 * reflects the loss.
 */
export class HydratedPayDividends
    extends HydratableAction<typeof PayDividends>
    implements PayDividends
{
    declare type: ActionType.PayDividends
    declare payoutPerShare?: number

    constructor(data: PayDividends) {
        super(data, PayDividendsValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const corporationId = state.activeCorporationId
        assertExists(corporationId, 'Active corporation id should be present while paying dividends')

        const corporation = state.getCorporation(corporationId)

        if (state.sparePartsParkedCorporationId === corporationId) {
            corporation.cargo = Math.max(0, corporation.cargo - 1)
            state.sparePartsParkedCorporationId = undefined
            state.sparePartsParkedShipLevel = undefined
        }

        const cargoSourceId = state.payDividendsCopyCargoFromCorporationId
        const cargo = cargoSourceId ? state.getCorporation(cargoSourceId).cargo : corporation.cargo

        const miningCapacitySourceId = state.payDividendsCopyMiningCapacityFromCorporationId
        const miningCapacity = effectiveMiningCapacityForCorporation(
            state,
            miningCapacitySourceId ?? corporationId
        )

        const payoutPerShare = dividendPayoutPerShare(cargo, miningCapacity, corporation.status)

        for (const share of corporation.shares) {
            if (share.owner?.type === 'player') {
                state.getPlayerState(share.owner.playerId).addFrozenFunds(payoutPerShare)
                corporation.addDividendReceived(share.owner.playerId, payoutPerShare)
            }
        }

        state.payDividendsCopyCargoFromCorporationId = undefined
        state.payDividendsCopyMiningCapacityFromCorporationId = undefined
        this.payoutPerShare = payoutPerShare
    }
}
