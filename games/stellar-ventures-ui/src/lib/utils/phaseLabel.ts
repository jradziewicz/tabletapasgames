import {
    CorporationId,
    MachineState,
    type HydratedStellarVenturesGameState
} from '@tabletop/stellar-ventures'
import { CorporationDisplayNames } from './corporationDisplay.js'

// Friendly labels for each MachineState, used to build the phase breadcrumb below. Not every
// state has bespoke UI yet (see ActionPanel.svelte) - this is purely a "where are we" display.
const STEP_LABELS: Record<MachineState, string> = {
    [MachineState.InitialAuction]: 'Initial Auction',
    [MachineState.IssueShare]: 'Issue Share',
    [MachineState.ExpandNetworkOrWormhole]: 'Expand Network / Wormhole',
    [MachineState.PayDividends]: 'Pay Dividends',
    [MachineState.OrderShips]: 'Order Ships',
    [MachineState.ReleaseDividends]: 'Release Dividends',
    [MachineState.BoardroomBattle]: 'Boardroom Battle',
    [MachineState.InvestorAction]: 'Investor Action',
    [MachineState.AlienTechAction]: 'Alien Tech Action',
    [MachineState.ScrapLowestShip]: 'Scrap Lowest Ship',
    [MachineState.DeliverShips]: 'Deliver Ships',
    [MachineState.AssignTurnOrder]: 'Assign Turn Order',
    [MachineState.FormAmethystAgency]: 'Form Amethyst Agency',
    [MachineState.OfferSignTheAgreement]: 'Sign The Agreement',
    [MachineState.OfferSecretAgentsChoice]: 'Secret Agents',
    [MachineState.OfferTaxAgentsChoice]: 'Tax Agents',
    [MachineState.PayTaxes]: 'Pay Taxes',
    [MachineState.DraftPower]: 'Draft Power',
    [MachineState.OfferSpareParts]: 'Spare Parts',
    [MachineState.Liquidation]: 'Liquidation',
    [MachineState.EndOfGame]: 'Game Over'
}

// Steps that happen as part of a single Corporation's own turn during the Corporation Round
// (Issue Share -> Expand Network/Wormhole -> Pay Dividends -> Order Ships, plus the detours a
// turn can take through Sign The Agreement / Spare Parts / a Scrapping Event) - these are the
// ones where showing "Active Corporation" alongside the step is meaningful.
const CORPORATION_ROUND_STATES = new Set<MachineState>([
    MachineState.IssueShare,
    MachineState.ExpandNetworkOrWormhole,
    MachineState.PayDividends,
    MachineState.OrderShips,
    MachineState.ScrapLowestShip,
    MachineState.DeliverShips,
    MachineState.OfferSignTheAgreement,
    MachineState.OfferSecretAgentsChoice,
    MachineState.OfferTaxAgentsChoice,
    MachineState.OfferSpareParts
])

// Investor Shenanigans' half of each Era, between Corporation Rounds.
const INVESTOR_ROUND_STATES = new Set<MachineState>([
    MachineState.ReleaseDividends,
    MachineState.BoardroomBattle,
    MachineState.InvestorAction,
    MachineState.AlienTechAction
])

// The brief housekeeping steps between Eras.
const ADMINISTRATION_ROUND_STATES = new Set<MachineState>([
    MachineState.AssignTurnOrder,
    MachineState.PayTaxes,
    MachineState.FormAmethystAgency
])

export interface GamePhaseDescription {
    roundLabel: string
    activeCorporationName?: string
    stepLabel: string
}

/**
 * Builds a friendly "where are we in the game" breadcrumb - e.g. "Corporation Round (Era 1) -
 * Active Corporation (Pink Inc.) - Current Step (Issue Share)" - for Header.svelte to show
 * alongside its existing whose-turn-is-it display. This is a display-only grouping of
 * MachineState values into rounds; it isn't meant to be an authoritative model of round
 * structure (see operations/corporationRound.ts / administrationRound.ts for that).
 */
export function describeGamePhase(
    gameState: HydratedStellarVenturesGameState
): GamePhaseDescription {
    const machineState = gameState.machineState
    const era = gameState.era
    const stepLabel = STEP_LABELS[machineState] ?? machineState

    if (machineState === MachineState.InitialAuction) {
        return { roundLabel: 'Initial Auction', stepLabel: 'Initial Auction' }
    }

    if (machineState === MachineState.Liquidation) {
        return { roundLabel: 'Liquidation', stepLabel }
    }

    if (machineState === MachineState.EndOfGame) {
        return { roundLabel: 'Game Over', stepLabel }
    }

    if (machineState === MachineState.DraftPower) {
        // Draft Power is reached both right after an Initial Auction win and mid-Corporation
        // Round (Sign The Agreement's replacement pick) - draftPowerResumeState says which.
        const resumesInitialAuction =
            gameState.draftPowerResumeState === MachineState.InitialAuction
        const corporationId = gameState.draftPowerCorporationId
        return {
            roundLabel: resumesInitialAuction
                ? 'Initial Auction'
                : `Corporation Round (Era ${era})`,
            activeCorporationName: corporationId
                ? CorporationDisplayNames[corporationId]
                : undefined,
            stepLabel
        }
    }

    if (INVESTOR_ROUND_STATES.has(machineState)) {
        return { roundLabel: `Investor Round (Era ${era})`, stepLabel }
    }

    if (ADMINISTRATION_ROUND_STATES.has(machineState)) {
        return { roundLabel: `Administration Round (Era ${era})`, stepLabel }
    }

    const corporationId = gameState.activeCorporationId
    return {
        roundLabel: `Corporation Round (Era ${era})`,
        activeCorporationName:
            corporationId && CORPORATION_ROUND_STATES.has(machineState)
                ? CorporationDisplayNames[corporationId]
                : undefined,
        stepLabel
    }
}

/** Renders a GamePhaseDescription as a single breadcrumb string for Header.svelte. */
export function formatGamePhase(phase: GamePhaseDescription): string {
    if (phase.activeCorporationName) {
        return `${phase.roundLabel} - ${phase.activeCorporationName} - ${phase.stepLabel}`
    }
    if (phase.stepLabel === phase.roundLabel) {
        return phase.roundLabel
    }
    return `${phase.roundLabel} - ${phase.stepLabel}`
}

/**
 * The Corporation currently acting on its own behalf (its President clicking buttons for it),
 * for UI that wants to highlight the Corporation itself rather than whichever player happens to
 * be piloting it - see PlayersPanel.svelte's Corporations section. Deliberately excludes Issue
 * Share's share-auction sub-step: once a share is opened for bidding, activePlayerIds names the
 * current bidder deciding whether to buy it for themselves, which is a personal decision, not
 * one made on the Corporation's behalf, even though it happens mid-turn during that Corporation's
 * Corporation Round step.
 */
export function operatingCorporationId(
    gameState: HydratedStellarVenturesGameState
): CorporationId | undefined {
    const machineState = gameState.machineState
    if (!CORPORATION_ROUND_STATES.has(machineState)) {
        return undefined
    }
    if (machineState === MachineState.IssueShare && gameState.activeShareAuction) {
        return undefined
    }
    return gameState.activeCorporationId
}
