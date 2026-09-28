import { CorporatePowerId, HydratedCorporationState } from '../model/corporation.js'
import { HydratedShipyardState, type ShipyardSection } from '../model/shipyard.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

// Every Corporation Charter has exactly 3 Ship columns (rulebook page 16: "Max 3 Ships: 1 Ship
// per column (Ordered or Delivered)"). A column is "empty" only once a Ship that was in it has
// left both rows entirely (i.e. via a Scrapping Event - see operations/dividends.ts's sibling
// concept for Dividends, and applyScrappingEvent below).
export const TOTAL_SHIP_COLUMNS = 3

export function totalShipCount(corporation: HydratedCorporationState): number {
    return corporation.orderedShipLevels.length + corporation.deliveredShipLevels.length
}

export function emptyShipColumnCount(corporation: HydratedCorporationState): number {
    return TOTAL_SHIP_COLUMNS - totalShipCount(corporation)
}

// Order Ships is "Conditionally Mandatory" (rulebook page 16): a Corporation with zero Ships
// anywhere on its Charter (every column empty) MUST Order at least 1 Ship (Forced Purchase).
// Otherwise, ordering is a fully optional Standard Purchase.
export function isForcedShipPurchase(corporation: HydratedCorporationState): boolean {
    return totalShipCount(corporation) === 0
}

// Cost of each Ship is equal to its level (rulebook page 16).
export function shipCost(level: number): number {
    return level
}

// "CARGO may never exceed the highest amount on the CARGO Track (e.g., 13)" (rulebook page 8) -
// confirmed as the Alpha map's printed CARGO Track maximum. Used by Investor Shenanigans' Cargo
// Boost Alien Tech Action (operations/investorShenanigans.ts is where that Action Disc lives;
// this constant sits here alongside corporation.cargo's other mutators).
export const MAX_CARGO = 13

// Every Corporation's CARGO is capped at the same flat MAX_CARGO (13) - confirmed by the game's
// co-designer: the CARGO Track's printed maximum is universal, it is never raised per-Corporation.
// Hyperdrive does NOT touch this ceiling - it grants an immediate one-time +1 to corporation.cargo
// itself at the moment it's drafted (see actions/draftPower.ts's HydratedDraftPower.apply()),
// the same as any other CARGO-granting event, clamped at this same cap like all the others.
export function maxCargoForCorporation(_corporation: HydratedCorporationState): number {
    return MAX_CARGO
}

export function canAffordNextShip(
    shipyard: HydratedShipyardState,
    corporation: HydratedCorporationState
): boolean {
    const section = shipyard.lowestAvailableSection()
    if (!section) {
        return false
    }
    return corporation.treasury >= shipCost(section.level)
}

// Whether the President could Order another Ship right now - used both to validate an OrderShip
// action and to decide whether to even offer it as an option.
export function canOrderAnotherShip(
    shipyard: HydratedShipyardState,
    corporation: HydratedCorporationState
): boolean {
    if (emptyShipColumnCount(corporation) <= 0) {
        return false
    }
    return canAffordNextShip(shipyard, corporation)
}

// "No Credits?" (rulebook page 17): "If Corporation is forced to purchase a Ship, but does not
// have sufficient Credits, it must take Loans until it has enough funds for a single Ship." Each
// Loan credits a flat ₮3 to the Treasury (rulebook page 25's own "Loans" rules) - see
// actions/forcedShipPurchase.ts for the rest of that mechanic (which Outpost(s) pay for each
// Loan). Deliberately its own constant, not reused from operations/liquidation.ts's
// LoanPenaltyPerShare, even though both happen to also be 3 - one is money gained now, the other
// is Share value lost later, and there's no rule tying the two figures together on purpose.
export const LoanCreditPerLoan = 3

// The exact minimum number of Loans needed to afford a Ship of the given level, given the
// Corporation's current Treasury - rulebook page 25: "The number of loans taken must be the
// minimum necessary to cover the cost of the forced action." 0 whenever the Corporation can
// already afford it outright (no Loan needed at all).
export function loansNeededForShip(corporation: HydratedCorporationState, shipLevel: number): number {
    return loansNeededForCost(corporation, shipCost(shipLevel))
}

export function loansNeededForCost(corporation: HydratedCorporationState, cost: number): number {
    const deficit = cost - corporation.treasury
    return deficit <= 0 ? 0 : Math.ceil(deficit / LoanCreditPerLoan)
}

// How many of those Loans' Outposts must be pulled off the board (this Corporation's own built
// Outposts, on any hex type - rulebook page 25: "Outposts used for loans can be removed from the
// Supply or any hex type on the Game Board") rather than its still-unbuilt supply - 0 whenever
// the unbuilt supply alone covers every Loan needed, which - since every starting Corporation's
// own unbuilt supply is non-trivial (OutpostSupplyByCorporationId) and a Corporation forced into
// this situation has typically built little else - is the common case in practice.
export function loanHexesNeeded(corporation: HydratedCorporationState, loans: number): number {
    return Math.max(0, loans - corporation.unbuiltOutposts)
}

// Scrapping Event (rulebook page 8 & 17): "all Ships of the specified lower level are removed
// from the game, reducing CARGO immediately for all Corporations." This applies across every
// Corporation, not just the one that triggered it - and to Ships in either row, though only
// Ships already in the Delivered Ships row have ever added to CARGO (see the "Ships and CARGO"
// key concept, page 8), so only removals from there reduce CARGO.
//
// Spare Parts (Corporate Power Glossary, page 29): "Anytime, One-Time (limit 1 Ship). When a Ship
// of this Corporation would be Scrapped, the President may move 1 of those Ships onto this tile
// instead, delaying its Scrap (and the CARGO reduction) by one Dividend payment." Since it's a
// unique physical tile, at most 1 Corporation can ever hold it, so at most one Scrapping Event can
// ever be paused awaiting this decision at a time. If this event is about to remove a Delivered
// Ship from that Corporation's Charter, pull exactly one such Ship out first (before the normal
// removal below even runs) and record it as pending rather than resolving its fate immediately -
// see model/gameState.ts's pendingSpareParts* fields, stateHandlers/offerSpareParts.ts (which the
// calling action's own state handler redirects into - see stateHandlers/orderShips.ts,
// stateHandlers/scrapLowestShip.ts), and actions/spareParts.ts / declineSpareParts.ts for what
// happens to it next. Any additional Ships this same event would remove at this level (beyond the
// one Spare Parts can save) are still scrapped normally below.
export function applyScrappingEvent(
    state: HydratedStellarVenturesGameState,
    targetLevel: number,
    section?: ShipyardSection
) {
    for (const corporation of state.corporations) {
        if (
            state.pendingSparePartsCorporationId === undefined &&
            state.sparePartsParkedCorporationId === undefined &&
            corporation.hasActivePower(CorporatePowerId.SpareParts) &&
            corporation.deliveredShipLevels.includes(targetLevel)
        ) {
            const index = corporation.deliveredShipLevels.indexOf(targetLevel)
            corporation.deliveredShipLevels.splice(index, 1)
            state.pendingSparePartsCorporationId = corporation.id
            state.pendingSparePartsShipLevel = targetLevel
        }

        const deliveredBefore = corporation.deliveredShipLevels.length
        corporation.deliveredShipLevels = corporation.deliveredShipLevels.filter(
            (level) => level !== targetLevel
        )
        const deliveredRemoved = deliveredBefore - corporation.deliveredShipLevels.length
        if (deliveredRemoved > 0) {
            const actualLoss = Math.min(deliveredRemoved, corporation.cargo)
            corporation.cargo = Math.max(0, corporation.cargo - deliveredRemoved)
            if (section && actualLoss > 0) {
                section.scrapCargoLossByCorporation ??= {}
                section.scrapCargoLossByCorporation[corporation.id] =
                    (section.scrapCargoLossByCorporation[corporation.id] ?? 0) + actualLoss
            }
        }

        corporation.orderedShipLevels = corporation.orderedShipLevels.filter(
            (level) => level !== targetLevel
        )
    }
}

// "First Ship in New Level Ordered?" (rulebook page 17): the first time a Ship is ever Ordered
// from a given Shipyard section, up to two one-time effects resolve, in either order since
// neither depends on the other:
//   - Flip Alien Ship tile (if applicable): reveal alienTileChevrons and increase the Alien
//     Corporation's Mining Capacity by 3 per chevron (i.e. 1 row per chevron on the shared
//     Mining Capacity track - see model/board.ts's identical row-banding for Dividends).
//   - Check for Scrapping Event (if applicable): see applyScrappingEvent above.
// Both are gated by the section's own firstShipOrdered flag so they only ever fire once.
// Administration Round step 2 / Liquidation step 1 (rulebook pages 20, 21 - Liquidation's own
// step is explicitly "As in Administration Round"): moves every Corporation's Ordered Ships into
// Delivered Ships, increasing its CARGO by the sum of the levels just delivered, clamped at
// MAX_CARGO (any excess is lost per the rulebook's reminder). Applies to every Corporation
// regardless of whether it Ordered anything this Era - one with nothing Ordered simply sees no
// change. Shared by actions/deliverShips.ts and actions/liquidate.ts so this exact mechanic isn't
// duplicated between the two contexts that both need it verbatim.
export function deliverOrderedShips(state: HydratedStellarVenturesGameState): void {
    for (const corporation of state.corporations) {
        if (corporation.orderedShipLevels.length === 0) {
            continue
        }

        const deliveredSum = corporation.orderedShipLevels.reduce((total, level) => total + level, 0)
        corporation.deliveredShipLevels.push(...corporation.orderedShipLevels)
        corporation.orderedShipLevels = []
        corporation.cargo = Math.min(maxCargoForCorporation(corporation), corporation.cargo + deliveredSum)
    }
}

// Returns whether this call actually flipped a still-hidden Alien Shipyard tile face up - the
// one piece of secret information this function can expose (the Scrapping Event just moves
// already-public CARGO around, so it doesn't count). Every caller (OrderShip, ScrapLowestShip,
// ForcedShipPurchase) uses this to set its own revealsInfo, since undo must not be able to step
// back past whichever specific action happened to be the one that revealed a tile - see
// GameSession.undoableAction, which refuses to cross any action flagged revealsInfo.
export function resolveFirstShipOrderedEffects(
    state: HydratedStellarVenturesGameState,
    sectionLevel: number
): boolean {
    const section = state.shipyard.sectionForLevel(sectionLevel)
    if (!section || section.firstShipOrdered) {
        return false
    }
    section.firstShipOrdered = true

    const revealedAlienTile = section.alienTileChevrons !== undefined
    if (revealedAlienTile) {
        section.alienTileRevealed = true
        state.alienCorporation.miningCapacity += section.alienTileChevrons! * 3
    }

    if (section.scrapTargetLevel !== undefined) {
        section.hasTriggeredScrappingEvent = true
        applyScrappingEvent(state, section.scrapTargetLevel, section)
    }

    return revealedAlienTile
}
