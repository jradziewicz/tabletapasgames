import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    canAffordNextShip,
    isForcedShipPurchase,
    loanHexesNeeded,
    loansNeededForShip,
    resolveFirstShipOrderedEffects,
    shipCost,
    LoanCreditPerLoan
} from '../operations/shipOrdering.js'

export type ForcedShipPurchase = Type.Static<typeof ForcedShipPurchase>
export const ForcedShipPurchase = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ForcedShipPurchase),
            playerId: Type.String(),
            // Which of this Corporation's own built Outposts (any hex, any type - rulebook page
            // 25) to send to the Loan Box, beyond whatever's still sitting in its unbuilt supply.
            // Exactly loanHexesNeeded's own count for this Corporation right now, no more or
            // fewer - see isValidForcedShipPurchase. Empty whenever the unbuilt supply alone
            // covers every Loan needed.
            hexIds: Type.Array(Type.String())
        })
    ])
)

export const ForcedShipPurchaseValidator = Compile(ForcedShipPurchase)

export function isForcedShipPurchaseAction(action?: GameAction): action is ForcedShipPurchase {
    return action?.type === ActionType.ForcedShipPurchase
}

/**
 * Forced Purchase + "No Credits?" Loans (rulebook pages 16-17 & 25). Order Ships is
 * "Conditionally Mandatory": a Corporation with zero Ships anywhere on its Charter must Order at
 * least 1 (Forced Purchase - operations/shipOrdering.ts's isForcedShipPurchase). If it can't
 * afford even the cheapest currently-available Ship, "it must take Loans until it has enough
 * funds for a single Ship" - each Loan sends 1 Outpost to the Loan Box (permanently - unlike
 * Dismantling Outposts' own Outpost removal, it never returns to the unbuilt supply) in exchange
 * for a flat ₮3 to the Treasury, and the number of Loans taken must be the exact minimum needed
 * (rulebook page 25's own "Loans" clarification - see loansNeededForShip).
 *
 * This single action resolves the whole "No Credits?" situation in one step - taking exactly
 * that many Loans and then immediately Ordering the 1 required Ship - rather than splitting it
 * into a separate "take Loans" action followed by a normal OrderShip, since a Corporation in this
 * state has no other legal move available anyway (a plain OrderShip fails for lack of funds, and
 * DeclineOrderShips is blocked by the still-unmet Forced Purchase minimum - see
 * HydratedDeclineOrderShips.canDeclineOrderShips) - there's nothing to decide in between.
 *
 * Outposts used for Loans come from this Corporation's own unbuilt supply first
 * (HydratedCorporationState.unbuiltOutposts - the common case: nothing changes on the board, no
 * President choice needed); only once that's exhausted does the President need to choose which
 * of this Corporation's actual built Outposts (hexIds) get sent to the Loan Box instead - see
 * loanHexesNeeded. Removing one there is modeled as the same board-side removal Dismantling
 * Outposts uses (model/board.ts's removeOutpost), just without crediting it back to
 * unbuiltOutposts afterward (a Loan's Outpost is gone for good, not returned to supply). Since
 * model/board.ts's miningCapacityForCorporation is computed live off the board rather than
 * stored, removing an Outpost this way automatically "reduces Mining Capacity accordingly" (the
 * rulebook's own phrasing) with no separate bookkeeping needed.
 */
export class HydratedForcedShipPurchase
    extends HydratableAction<typeof ForcedShipPurchase>
    implements ForcedShipPurchase
{
    declare type: ActionType.ForcedShipPurchase
    declare playerId: string
    declare hexIds: string[]

    constructor(data: ForcedShipPurchase) {
        super(data, ForcedShipPurchaseValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonForcedShipPurchaseInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.activeCorporationId
        assertExists(
            corporationId,
            'Active corporation id should be present while resolving a Forced Purchase'
        )
        const corporation = state.getCorporation(corporationId)
        const section = state.shipyard.lowestAvailableSection()
        assertExists(section, 'A Shipyard section should be available while resolving a Forced Purchase')

        const loans = loansNeededForShip(corporation, section.level)
        const outpostsFromSupply = Math.min(loans, corporation.unbuiltOutposts)
        corporation.unbuiltOutposts -= outpostsFromSupply
        for (const hexId of this.hexIds) {
            state.board.removeOutpost(hexId, corporationId)
        }
        corporation.loanCount += loans
        corporation.treasury += loans * LoanCreditPerLoan

        const orderedLevel = state.shipyard.takeLowestShip()
        corporation.orderedShipLevels.push(orderedLevel)
        corporation.treasury -= shipCost(orderedLevel)
        // Flags this action itself as beyond Undo whenever it happens to be the one that flips a
        // still-hidden Alien Shipyard tile face up - secret information a player must not be able
        // to peek at and then take back (see resolveFirstShipOrderedEffects).
        if (resolveFirstShipOrderedEffects(state, orderedLevel)) {
            this.revealsInfo = true
        }
    }

    isValidForcedShipPurchase(state: HydratedStellarVenturesGameState): boolean {
        return HydratedForcedShipPurchase.canForcedShipPurchase(state, this.playerId, this.hexIds)
    }

    reasonForcedShipPurchaseInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedForcedShipPurchase.reasonForcedShipPurchaseInvalid(
            state,
            this.playerId,
            this.hexIds
        )
    }

    // The full, exact-hexIds-count check used both to validate/apply the real submitted action
    // and to decide whether to even offer ForcedShipPurchase (with hexIds: [] - see
    // canOfferForcedShipPurchase, which only cares whether enough Outposts exist SOMEWHERE, not
    // which specific ones).
    static canForcedShipPurchase(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexIds: string[]
    ): boolean {
        return (
            HydratedForcedShipPurchase.reasonForcedShipPurchaseInvalid(
                state,
                playerId,
                hexIds
            ) === undefined
        )
    }

    static reasonForcedShipPurchaseInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexIds: string[]
    ): string | undefined {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return 'No Corporation is currently active'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President may resolve a Forced Ship Purchase'
        }
        if (!isForcedShipPurchase(corporation)) {
            return 'A Forced Ship Purchase is not currently required'
        }
        const section = state.shipyard.lowestAvailableSection()
        if (!section) {
            return 'No Shipyard section is available'
        }
        if (canAffordNextShip(state.shipyard, corporation)) {
            // Can already afford it outright - that's plain OrderShip's job, not a "No Credits?"
            // Loan situation.
            return 'This Corporation can already afford a Ship without taking Loans'
        }

        const loans = loansNeededForShip(corporation, section.level)
        const hexesNeeded = loanHexesNeeded(corporation, loans)
        if (hexIds.length !== hexesNeeded) {
            return `Exactly ${hexesNeeded} Outpost${hexesNeeded === 1 ? '' : 's'} must be selected for Loans`
        }
        if (new Set(hexIds).size !== hexIds.length) {
            return 'The same hex was selected more than once'
        }
        if (
            !hexIds.every((hexId) => {
                const hex = state.board.hexes[hexId]
                return !!hex && hex.outposts.includes(corporationId)
            })
        ) {
            return "One or more selected hexes don't have this Corporation's Outpost"
        }
        return undefined
    }

    // Whether to even offer ForcedShipPurchase as an option - used by the state handler's
    // validActionsForPlayer, without knowing which hexes the President might eventually pick.
    static canOfferForcedShipPurchase(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return false
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return false
        }
        if (!isForcedShipPurchase(corporation)) {
            return false
        }
        const section = state.shipyard.lowestAvailableSection()
        if (!section) {
            return false
        }
        if (canAffordNextShip(state.shipyard, corporation)) {
            return false
        }
        const loans = loansNeededForShip(corporation, section.level)
        const hexesNeeded = loanHexesNeeded(corporation, loans)
        if (hexesNeeded === 0) {
            return true
        }
        const ownedHexCount = Object.values(state.board.hexes).filter((hex) =>
            hex.outposts.includes(corporationId)
        ).length
        return ownedHexCount >= hexesNeeded
    }

    // Used by Board.svelte's own incremental hex-picking (mirrors HydratedDevelopPlanets' own
    // "already-selected hexes stay valid regardless, a not-yet-picked one is valid exactly when
    // there's still room and it's actually one of this Corporation's own Outposts" convention) -
    // deliberately separate from canForcedShipPurchase above, which requires the FINAL, complete
    // hexIds list to be exactly hexesNeeded long (a partial, in-progress selection would fail
    // that check even though every individual pick so far is perfectly legal).
    static canSelectForcedShipPurchaseHex(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string,
        selectedHexIds: string[]
    ): boolean {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return false
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return false
        }
        if (!isForcedShipPurchase(corporation)) {
            return false
        }
        const section = state.shipyard.lowestAvailableSection()
        if (!section) {
            return false
        }
        if (canAffordNextShip(state.shipyard, corporation)) {
            return false
        }
        const loans = loansNeededForShip(corporation, section.level)
        const hexesNeeded = loanHexesNeeded(corporation, loans)
        if (selectedHexIds.length >= hexesNeeded) {
            return false
        }
        const hex = state.board.hexes[hexId]
        return !!hex && hex.outposts.includes(corporationId)
    }
}
