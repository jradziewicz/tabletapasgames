import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'

// The 18 physical "Neutral Corporate Power" tiles (rulebook page 6's Setup step 17; Glossary,
// page 29), shuffled together at Setup and drafted from throughout the game - see
// definition/initializer.ts (Setup), stateHandlers/initialAuction.ts (Initial Auction's Draft
// Power step), and stateHandlers/offerSignTheAgreement.ts (Sign The Agreement's Draft Power
// step). Deliberately excludes AlienExplorers and SecretAgents (Starting Powers, never drafted)
// and "Tax Agents" (Glossary, page 29: "only used on Borders & Taxes Map" - it's a Starting
// Power on that map, assigned directly rather than drafted from this Neutral pool - see
// actions/chooseAmethystHomePlanet.ts).
export const NeutralCorporatePowerIds: CorporatePowerId[] = [
    CorporatePowerId.AccountingGimmick,
    CorporatePowerId.LeakedResearch,
    CorporatePowerId.AlienEngineering,
    CorporatePowerId.CloakingDevices,
    CorporatePowerId.DeepSpaceSmuggling,
    CorporatePowerId.FinePrint,
    CorporatePowerId.IcarusExperiment,
    CorporatePowerId.AlienAlchemist,
    CorporatePowerId.BackroomDeal,
    CorporatePowerId.DeepSpacePirates,
    CorporatePowerId.DismantlingOutposts,
    CorporatePowerId.Hyperdrive,
    CorporatePowerId.StalledIPO,
    CorporatePowerId.SpareParts,
    CorporatePowerId.OreRefinement,
    CorporatePowerId.QuantumPropulsion,
    CorporatePowerId.NebularExplorers,
    CorporatePowerId.Windfall
]

// Setup step 17 (rulebook page 6): "Shuffle all tiles, then make a draw pile of 11... then
// return the remaining to the game box." Only 11 of the 18 physical tiles are ever used in a
// given game - the other 7 (18 - 11) are returned to the box unused and never modeled at all.
// From those 11: "Draw 6 tiles and place them for all to examine" - the visible row Initial
// Auction Presidents draft from (state.availableCorporatePowerIds starts at this many).
// "First Play: Instead, select the 6 of the powers marked with *" isn't modeled as a special
// mode, consistent with how this game's other "First Play" notes aren't specially handled either
// (see e.g. definition/initializer.ts's ALIEN_AGREEMENT_TILE_CHEVRONS comment).
export const INITIAL_AVAILABLE_CORPORATE_POWER_COUNT = 6

// Setup step 17: "Leave the remaining tiles in the draw pile" - the 11-tile pool minus the 6
// already dealt face-up leaves 5 genuinely hidden in state.corporatePowerDrawPileIds until the
// Initial Auction ends (see stateHandlers/draftPower.ts), at which point they join the visible
// pool for the rest of the game.
export const CORPORATE_POWER_DRAW_PILE_COUNT = 5

// Ore Refinement (Glossary, page 29): "Permanent, Ongoing. Permanently increase Mining Capacity
// +3." Doesn't move the shared Mining Capacity token on the board (that's AccountingGimmick's
// trick, still unimplemented) - it's a flat bonus layered on top of the board-derived value
// wherever Mining Capacity is read for game purposes. Every production call site
// (operations/administrationRound.ts's turn-order sort, operations/liquidation.ts's Share
// Liquidation and Determine Winner tiebreak, actions/payDividends.ts's payout row) should call
// this instead of state.board.miningCapacityForCorporation directly, so the bonus is never
// missed at one site while being applied at another.
export const OreRefinementBonus = 3

export function effectiveMiningCapacityForCorporation(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId
): number {
    const base = state.board.miningCapacityForCorporation(corporationId)
    const corporation = state.getCorporation(corporationId)
    const oreRefinementBonus = corporation.hasActivePower(CorporatePowerId.OreRefinement)
        ? OreRefinementBonus
        : 0
    // Secret Agents' own accumulated "Increase Amethyst" bonus (operations/agreement.ts's
    // awardSecretAgentsMiningCapacityBonus) - same "layered on top of the board-derived value"
    // treatment as Ore Refinement's, just accumulating instead of a flat +3.
    const secretAgentsBonus = corporation.secretAgentsMiningCapacityBonus ?? 0
    return base + oreRefinementBonus + secretAgentsBonus
}

// Which of Pay Dividends' two One-Time Powers (Deep Space Smuggling / Deep Space Pirates,
// Glossary page 29) is still waiting to be offered (used or declined) for THIS Pay Dividends
// instance - i.e. for the currently active Corporation's own turn. Checked in this fixed order
// (Smuggling before Pirates) so a Corporation holding both resolves them one at a time rather
// than simultaneously. Returns undefined once both are resolved (or neither is held), signaling
// that Pay Dividends' automatic payout can proceed - see stateHandlers/payDividends.ts.
export type PendingPayDividendsPower = 'smuggling' | 'pirates'

export function pendingPayDividendsPower(
    state: HydratedStellarVenturesGameState
): PendingPayDividendsPower | undefined {
    const corporationId = state.activeCorporationId
    if (!corporationId) {
        return undefined
    }
    const corporation = state.getCorporation(corporationId)
    if (
        corporation.hasActivePower(CorporatePowerId.DeepSpaceSmuggling) &&
        !state.payDividendsSmugglingOfferResolved
    ) {
        return 'smuggling'
    }
    if (
        corporation.hasActivePower(CorporatePowerId.DeepSpacePirates) &&
        !state.payDividendsPiratesOfferResolved
    ) {
        return 'pirates'
    }
    return undefined
}
