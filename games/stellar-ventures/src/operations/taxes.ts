import { HexType } from '../model/board.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { LoanCreditPerLoan, loanHexesNeeded, loansNeededForCost } from './shipOrdering.js'

export const TaxAgentsTaxBoxTake = 3

// Borders & Taxes FAQ: Tax Payments are not cumulative - a Corporation pays only for the most
// expensive Tax Zone where it has an Outpost.
export function taxDueForCorporation(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId
): number {
    const borderLevel = state.board.highestBorderLevelWithOutpost(corporationId)
    return state.boardMapDefinition.borders.find((border) => border.level === borderLevel)?.tax ?? 0
}

export function taxPayerCorporationIdsInTurnOrder(
    state: HydratedStellarVenturesGameState,
    corporationIds: CorporationId[]
): CorporationId[] {
    return state.corporationTurnOrder.filter(
        (corporationId) =>
            corporationIds.includes(corporationId) && taxDueForCorporation(state, corporationId) > 0
    )
}

export function builtOutpostHexIds(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId
): string[] {
    return Object.values(state.board.hexes)
        .filter((hex) => hex.outposts.includes(corporationId))
        .map((hex) => hex.id)
}

export function taxLoanHexesNeeded(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId
): number {
    const corporation = state.getCorporation(corporationId)
    const loans = loansNeededForCost(corporation, taxDueForCorporation(state, corporationId))
    return Math.min(
        loanHexesNeeded(corporation, loans),
        builtOutpostHexIds(state, corporationId).length
    )
}

export interface TaxPayment {
    amount: number
    loans: number
}

export function payTax(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    loanHexIds: string[]
): TaxPayment {
    const corporation = state.getCorporation(corporationId)
    const tax = taxDueForCorporation(state, corporationId)
    const loansNeeded = loansNeededForCost(corporation, tax)
    const loansFromSupply = Math.min(loansNeeded, corporation.unbuiltOutposts)
    corporation.unbuiltOutposts -= loansFromSupply
    for (const hexId of loanHexIds) {
        state.board.removeOutpost(hexId, corporationId)
    }
    const loans = loansFromSupply + loanHexIds.length
    corporation.loanCount += loans
    corporation.treasury += loans * LoanCreditPerLoan

    const amount = Math.min(tax, corporation.treasury)
    corporation.treasury -= amount
    state.taxBox = (state.taxBox ?? 0) + amount
    return { amount, loans }
}

export function taxAgentsForceTaxCorporationIds(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    hexId: string
): CorporationId[] {
    const otherCorporationIds = state.board
        .requireHex(hexId)
        .outposts.filter((id) => id !== corporationId)
    return taxPayerCorporationIdsInTurnOrder(state, otherCorporationIds)
}

export function taxAgentsTaxBoxTakeAmount(state: HydratedStellarVenturesGameState): number {
    return Math.min(TaxAgentsTaxBoxTake, state.taxBox ?? 0)
}

// Tax Agents (Amethyst Agency, Borders & Taxes only): after building an Outpost on an Alien
// Planet, the President chooses to force a Tax Payment on the other Corporations present or to
// take ₮3 from the Tax Box. Skipped when neither choice would do anything.
export function beginTaxAgentsChoiceIfEligible(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    hexId: string,
    resumeState: MachineState
): boolean {
    if (state.board.getHex(hexId)?.type !== HexType.AlienPlanet) {
        return false
    }
    if (!state.getCorporation(corporationId).hasActivePower(CorporatePowerId.TaxAgents)) {
        return false
    }
    if (
        taxAgentsForceTaxCorporationIds(state, corporationId, hexId).length === 0 &&
        taxAgentsTaxBoxTakeAmount(state) === 0
    ) {
        return false
    }
    state.taxAgentsCorporationId = corporationId
    state.taxAgentsHexId = hexId
    state.taxAgentsResumeState = resumeState
    return true
}
