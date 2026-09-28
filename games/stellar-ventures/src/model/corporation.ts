import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from '@tabletop/common'

export enum CorporationId {
    PinkInc = 'pinkInc',
    FrostFederated = 'frostFederated',
    ScarletSyndicate = 'scarletSyndicate',
    CeruleanCouncil = 'ceruleanCouncil',
    GambogeGuild = 'gambogeGuild',
    AmethystAgency = 'amethystAgency'
}

export const StartingCorporationIds = [
    CorporationId.PinkInc,
    CorporationId.FrostFederated,
    CorporationId.ScarletSyndicate,
    CorporationId.CeruleanCouncil,
    CorporationId.GambogeGuild
]

// The physical Outpost supply, confirmed against the rulebook's component list (120 Outposts
// total, in each Corporation's own color): PinkInc 21, Frost Federated 19, Scarlet Syndicate 17,
// Cerulean Council 25, Gamboge Guild 23, Amethyst Agency 15 (21+19+17+25+23+15 = 120). This is
// each Corporation's ENTIRE physical supply, not just what's left to build - see
// HydratedCorporationState.unbuiltOutposts for the count still in the box at any given moment
// (definition/initializer.ts sets its Setup value; operations/network.ts's
// buildOutpostForCorporation decrements it on every build; actions/alienAlchemist.ts is the one
// power that removes Outposts from it without building them).
export const OutpostSupplyByCorporationId: Record<CorporationId, number> = {
    [CorporationId.PinkInc]: 21,
    [CorporationId.FrostFederated]: 19,
    [CorporationId.ScarletSyndicate]: 17,
    [CorporationId.CeruleanCouncil]: 25,
    [CorporationId.GambogeGuild]: 23,
    [CorporationId.AmethystAgency]: 15
}

export enum CorporationStatus {
    Private = 'private',
    Minor = 'minor',
    Major = 'major'
}

export type ShareOwner = Type.Static<typeof ShareOwner>
export const ShareOwner = Type.Union([
    Type.Object({
        type: Type.Literal('player'),
        playerId: Type.String()
    }),
    Type.Object({
        type: Type.Literal('alien')
    })
])

export type Share = Type.Static<typeof Share>
export const Share = Type.Object({
    owner: Type.Optional(ShareOwner),
    // Stamped with state.actionCount (or an equivalent monotonic counter) when this share is
    // issued, so ties in share count can be broken by "who bought their share first" per the
    // rulebook's President tie-break rule.
    issuedSequence: Type.Optional(Type.Number()),
    // What the winning bidder actually paid for this specific Share at the moment it was issued
    // to them (Initial Auction's highBid, or a regular/forced Issue Share auction's highBid - see
    // stateHandlers/initialAuction.ts's resolveAuctionIfComplete and
    // operations/shareAuction.ts's resolveShareAuctionWinner, both of which pass this through to
    // issueShareToPlayer below). Undefined for a Share issued to the Alien Shareholdings (never
    // costs anyone anything) or one issued before this field existed. A Share's owner never
    // changes once set (issueShareToPlayer only ever claims a still-unissued Share - see its own
    // comment), so this permanently and correctly reflects the CURRENT holder's real cost with no
    // replay needed - see components/GameSummaryOverlay.svelte.
    pricePaid: Type.Optional(Type.Number())
})

// A Corporation never has more than two Active Powers at any time (rulebook page 25's
// Miscellaneous clarifications). Every place a Corporation gains a Power (Setup, Initial
// Auction's Draft Power step, Sign The Agreement's own Draft Power step, Amethyst Agency's
// Formation Power) only ever does so when it currently holds fewer than this many, so nothing
// needs to separately enforce the cap - this constant exists purely for documentation/reference.
export const MAX_ACTIVE_CORPORATE_POWERS = 2

// Corporate Power ids (rulebook's Corporation Power Glossary, pages 28-29, and the punchboard's
// physical tiles - each has an iconography side and a text side, with the Glossary as the
// authoritative source for exact wording). Referenced by HydratedCorporationState.hasActivePower
// and wherever a specific Power's effect is implemented. "Powers are only gained through Set-up,
// Initial Auction and Signing the Agreement" (page 25) - see operations/corporatePowers.ts for
// where the Neutral pool (below) gets shuffled and drafted from, and actions/draftPower.ts /
// stateHandlers/draftPower.ts for the actual drafting mechanic.
//
// Effects are added incrementally as each Power's actual gameplay effect gets implemented - a
// Power below with only a Glossary citation in its comment is modeled as data (a Corporation can
// hold it, gain it, lose it) but doesn't yet DO anything, the same way AlienExplorers itself
// started out before Sign The Agreement was built. See the game's task list for current status.
export enum CorporatePowerId {
    // --- Starting Powers (rulebook page 3's Setup step 15b / page 9's Formation Power) - never
    // drafted from the Neutral pool below. ---

    // Setup step 15b: every starting Corporation begins the game with this Power active. Allows
    // building Outposts on Alien Planets; the player who builds such an Outpost gains 1 Alien
    // Technology Cube (see operations/network.ts's awardAlienExplorersCubes). Flips to "Sign The
    // Agreement" (page 29) once the Corporation has Outposts on 2+ Alien Planets - see
    // actions/signTheAgreement.ts.
    AlienExplorers = 'alienExplorers',

    // Amethyst Agency's Formation Power (rulebook page 9; Amethyst Agency FAQ, page 23: "Amethyst
    // Agency begins with the 'Secret Agents' Power when playing on the Alpha map... It does not
    // select a second power when the Corporation launches"), granted directly at Formation - see
    // actions/chooseAmethystHomePlanet.ts. Glossary (page 29): may build Outposts on Alien
    // Planets without the players gaining Alien Technology; after building on one with a still-
    // hidden tile, the President chooses to either increase Amethyst's own Mining Capacity +3 or
    // increase the Alien Corporation's Mining Capacity by the tile's chevrons, discarding the
    // tile either way (or, if the Alien Planet has no tile, may only choose the +3). Effect not
    // yet implemented.
    SecretAgents = 'secretAgents',
    TaxAgents = 'taxAgents',

    // --- Neutral Corporate Powers (rulebook page 6's Setup step 17 / page 29's Glossary): 18
    // tiles total, shuffled together and drafted from state.availableCorporatePowerIds /
    // corporatePowerDrawPileIds - see operations/corporatePowers.ts's NeutralCorporatePowerIds.
    // "Tax Agents" (page 29, "only used on Borders & Taxes Map") is the physical punchboard's 19th
    // tile and is intentionally excluded from this Neutral pool - on the Borders & Taxes map it's
    // assigned directly to Amethyst Agency as a Starting Power instead (see
    // actions/chooseAmethystHomePlanet.ts), the same way SecretAgents is on the Alpha map. ---

    // Timing: Liquidation. During Hostile Takeover, appears to have +5 Mining Capacity (doesn't
    // move the token, and doesn't change the actual value used for Share Value calculation).
    // Implemented as a formula-only adjustment inside operations/liquidation.ts's
    // shareValuePerShare (AccountingGimmickTakeoverBonus) - purely automatic, no action/discard.
    AccountingGimmick = 'accountingGimmick',
    // Timing: Anytime, One-Time. President may perform Research Wormhole as a free action for
    // this Corporation, still spending Alien Technology as normal. Confirmed with the game's
    // co-designer: "free" means this doesn't consume the President's once-per-Investor-Round
    // Alien Tech Action slot (stateHandlers/alienTechAction.ts), and "Anytime" means it's offered
    // both during this Corporation's own turn in the Corporation Round (Issue Share, Expand
    // Network/Wormhole, Order Ships - not the fully-automatic Pay Dividends) and during its
    // President's Alien Tech Action in Investor Shenanigans - see
    // actions/leakedResearch.ts's isLeakedResearchWindow for the exact windows. It's discarded
    // after use (One-Time), same as Windfall.
    LeakedResearch = 'leakedResearch',
    // Timing: Investor Round, Ongoing. President may reclaim any number of Technology Cubes from
    // the Charter as a free action; the Corporation immediately loses Cargo Boost and/or Wormhole
    // access. Implemented as a free (non-turn-consuming) action offered during BOTH halves of
    // Investor Shenanigans - the Investor Action and the Alien Tech Action - mirroring Leaked
    // Research's wiring - see actions/alienEngineering.ts, stateHandlers/investorAction.ts and
    // stateHandlers/alienTechAction.ts.
    AlienEngineering = 'alienEngineering',
    // Timing: Any Build, Ongoing. May build Outposts on Deep Space hexes ignoring Outpost
    // Restrictions and Placement Penalties. Implemented as ignoresDeepSpaceOutpostCap
    // (model/board.ts's canBuildOutpost, threaded through operations/network.ts) and
    // placementPenaltyForHexForCorporation (operations/network.ts) - see each build action file's
    // call sites (expandNetwork.ts, createWormhole.ts, privateContractor.ts, jerryRig.ts).
    CloakingDevices = 'cloakingDevices',
    // Timing: Pay Dividends, One-Time. Copy another Corporation's CARGO when determining
    // Dividends. Discard after use. Implemented as a one-time decision offered at the start of
    // this Corporation's own Pay Dividends step - see actions/deepSpaceSmuggling.ts and
    // stateHandlers/payDividends.ts.
    DeepSpaceSmuggling = 'deepSpaceSmuggling',
    // Timing: Investor Round, One-Time. Before Boardroom Battle begins, discard to prevent any
    // Votes being placed on this Corporation (and it can't be forced to Issue a Share) during
    // that specific Boardroom Battle. Implemented as a one-time decision offered at the very
    // start of every fresh Boardroom Battle - see actions/finePrint.ts and
    // stateHandlers/boardroomBattle.ts.
    FinePrint = 'finePrint',
    // Timing: Any Build, Ongoing. May build Outposts on Sun Anomaly hexes. Lifts the Sun/Anomaly
    // Outpost Restriction (model/board.ts's canBuildOutpost) for every build type - Expand
    // Network, Create Wormhole, Private Contractor, Jerry-Rig (see operations/network.ts's
    // canBuildExpansionOutpost / hasAnyValidExpansionTarget and each action file's call sites).
    IcarusExperiment = 'icarusExperiment',
    // Timing: Corporation Round, Ongoing. Once per Corporation Round, President may remove 2
    // unbuilt Outposts of this Corporation and return them to the box, gaining 1 Alien Technology
    // Cube. Implemented against a real per-Corporation Outpost supply (OutpostSupplyByCorporationId
    // above, HydratedCorporationState.unbuiltOutposts) - see actions/alienAlchemist.ts.
    AlienAlchemist = 'alienAlchemist',
    // Timing: Liquidation, One-Time (before Hostile Takeover). Move the Alien Mining Capacity up
    // or down by one row (±3 - confirmed by the game's co-designer). Implemented as a one-time
    // decision offered at the start of Liquidation, before the automatic Hostile Takeover / Share
    // Liquidation System action - see actions/backroomDeal.ts and stateHandlers/liquidation.ts.
    BackroomDeal = 'backroomDeal',
    // Timing: Pay Dividends, One-Time. Copy another Corporation's Mining Capacity when
    // determining Dividends. Discard after use. Implemented as a one-time decision offered at
    // the start of this Corporation's own Pay Dividends step (after Deep Space Smuggling, if
    // both are somehow held) - see actions/deepSpacePirates.ts and stateHandlers/payDividends.ts.
    DeepSpacePirates = 'deepSpacePirates',
    // Timing: Corporation Round, Ongoing. Once per Corporation Round, may return 1 Outpost from a
    // Deep Space hex to the supply, paying ₮1 from the Treasury; the removed Outpost may
    // immediately be placed as part of any build action. Implemented as the inverse of a normal
    // build (model/board.ts's removeOutpost, operations/network.ts's removeOutpostForCorporation)
    // - see actions/dismantlingOutposts.ts.
    DismantlingOutposts = 'dismantlingOutposts',
    // Timing: Permanent, Ongoing. Permanently increase CARGO +1. Confirmed by the game's
    // co-designer: this is an immediate, one-time +1 to this Corporation's actual CARGO
    // (corporation.cargo) at the moment it's drafted, not an increase to its CARGO cap (every
    // Corporation shares the same flat MAX_CARGO of 13 - operations/shipOrdering.ts). Unlike
    // Windfall, it is never discarded after resolving - see actions/draftPower.ts's
    // HydratedDraftPower.apply().
    Hyperdrive = 'hyperdrive',
    // Timing: Anytime, Ongoing. This Corporation becomes a Major Corporation on its 5th Share
    // issued instead of its 4th. Implemented directly in HydratedCorporationState.status.
    StalledIPO = 'stalledIPO',
    // Timing: Anytime, One-Time (limit 1 Ship). When a Ship of this Corporation would be
    // Scrapped, the President may move 1 of those Ships onto this tile instead, delaying its
    // Scrap (and the CARGO reduction) by one Dividend payment. Implemented as a detour to
    // MachineState.OfferSpareParts, triggered from within
    // operations/shipOrdering.ts's applyScrappingEvent - see actions/spareParts.ts,
    // actions/declineSpareParts.ts, and stateHandlers/offerSpareParts.ts.
    SpareParts = 'spareParts',
    // Timing: Permanent, Ongoing. Permanently increase Mining Capacity +3. Implemented as a flat
    // bonus layered on top of the board-derived value - see
    // operations/corporatePowers.ts's effectiveMiningCapacityForCorporation.
    OreRefinement = 'oreRefinement',
    // Timing: Corporation Round, Ongoing. ₮2 discount on the Create Wormhole action (requires
    // Active Wormhole Technology). Implemented in
    // operations/network.ts's createWormholeCostForCorporation.
    QuantumPropulsion = 'quantumPropulsion',
    // Timing: Any Build, One-Time. May build an Outpost on a Nebular Anomaly hex, placing a
    // random unused Alien Planet tile beneath it and treating it as an Alien Planet from then on
    // (for every Corporation, not just this one) - including being eligible to Sign The
    // Agreement. Implemented as its own dedicated build action (Create Wormhole's cost formula,
    // no Wormhole Technology requirement) rather than a permission flag threaded into the other
    // build actions - see actions/nebularExplorers.ts.
    NebularExplorers = 'nebularExplorers',
    // Timing: Immediately, One-Time. Immediately receive ₮5 to the Corporate Treasury, then
    // discard. Implemented entirely inline at the moment of drafting - see
    // actions/draftPower.ts's HydratedDraftPower.apply() - since drafting is the only
    // "Immediately" moment this Power could ever be held.
    Windfall = 'windfall'
}

export type CorporatePowerState = Type.Static<typeof CorporatePowerState>
export const CorporatePowerState = Type.Object({
    id: Type.String(),
    flipped: Type.Optional(Type.Boolean())
})

export type AgreementState = Type.Static<typeof AgreementState>
export const AgreementState = Type.Object({
    planetCountAtSigning: Type.Number(),
    // Commit Tax Fraud (Borders & Taxes rulebook addendum, Sign The Agreement): half the Tax Box
    // (rounded up), taken into this Corporation's Treasury the instant it signs - see
    // actions/signTheAgreement.ts. Only ever set on the Borders & Taxes map (state.usesTaxes);
    // undefined on Alpha, where there's no Tax Box to take from. Recorded permanently here (not
    // just applied to treasury) purely so games/stellar-ventures-ui's TaxFraudRevealOverlay.svelte
    // can dramatize "how much" after the fact, the same way FirstShipOrderedRevealOverlay
    // reconstructs its own reveals from permanent, already-shared state rather than a snapshot.
    taxFraudAmount: Type.Optional(Type.Number())
})

export type CorporationState = Type.Static<typeof CorporationState>
export const CorporationState = Type.Object({
    id: Type.Enum(CorporationId),
    active: Type.Boolean(),
    treasury: Type.Number(),
    shares: Type.Array(Share),
    homePlanetId: Type.Optional(Type.String()),
    cargo: Type.Number(),
    orderedShipLevels: Type.Array(Type.Number()),
    deliveredShipLevels: Type.Array(Type.Number()),
    wormholeActive: Type.Boolean(),
    powers: Type.Array(CorporatePowerState),
    agreement: Type.Optional(AgreementState),
    loanCount: Type.Number(),
    turnOrderPosition: Type.Number(),
    // How many of this Corporation's own OutpostSupplyByCorporationId physical Outposts are
    // still in the box (not yet built anywhere on the board, and not removed by Alien Alchemist).
    // Set at Setup (definition/initializer.ts) to the full supply minus 1 for the starting
    // Corporations' Home Planet Outpost (Amethyst Agency starts at its full supply, since its own
    // Home Planet Outpost isn't placed until Formation - actions/chooseAmethystHomePlanet.ts).
    unbuiltOutposts: Type.Number(),
    // How many Alien Technology Cubes are currently spent on this Corporation's Charter via
    // Cargo Boost (actions/cargoBoost.ts), each having granted +1 CARGO 1-for-1 (before any
    // clamping at maxCargoForCorporation, which can "waste" a cube - rulebook confirmed legal).
    // Alien Engineering (actions/alienEngineering.ts) reclaims some or all of these cubes back to
    // the President, reducing CARGO by the same amount reclaimed. Optional/undefined is treated
    // as 0 everywhere it's read, so existing fixtures/saves without this field stay valid.
    cargoBoostCubesOnCharter: Type.Optional(Type.Number()),
    // Secret Agents (Amethyst Agency's own Formation Power - see CorporatePowerId.SecretAgents
    // above): each time this Corporation's President chooses "Increase Amethyst" while resolving
    // the Power's Mining Capacity choice, this permanently increases by
    // SECRET_AGENTS_MINING_CAPACITY_BONUS (operations/agreement.ts's
    // awardSecretAgentsMiningCapacityBonus / actions/increaseAmethystMiningCapacity.ts) - unlike
    // Ore Refinement's flat, always-on bonus, this one accumulates one +3 at a time and can only
    // ever grow. Optional/undefined is treated as 0 everywhere it's read (see
    // operations/corporatePowers.ts's effectiveMiningCapacityForCorporation).
    secretAgentsMiningCapacityBonus: Type.Optional(Type.Number()),
    // Running total of every Credit this Corporation has ever paid out in dividends to each
    // player, keyed by playerId (PayDividends' per-share payout - actions/payDividends.ts - and
    // Sign The Agreement's one-time Bonus Dividend - actions/signTheAgreement.ts - both add to
    // this via addDividendReceived below; ReleaseDividends deliberately does NOT, since it's just
    // Frozen Funds already counted here moving to Liquid, not new money). Optional/undefined is
    // treated as 0 everywhere it's read (a Corporation that never paid a dividend, or one that
    // did before this field existed) - see components/GameSummaryOverlay.svelte.
    dividendsReceivedByPlayer: Type.Optional(Type.Record(Type.String(), Type.Number())),
    // Running total of every Credit each player has personally spent on this Corporation via the
    // Private Contractor Investor Action (rulebook page 19, actions/privateContractor.ts) - paid
    // out of the acting Investor's own liquidFunds rather than this Corporation's treasury, so it
    // never shows up in `treasury` at all and would otherwise be invisible after the fact. Added
    // to via addPrivateContractorExpense below, called from operations/network.ts's
    // finalizeExpansion at the same point the actual Credits get deducted. Optional/undefined is
    // treated as 0 everywhere it's read - see components/GameSummaryOverlay.svelte's "Private
    // Contractor" column.
    privateContractorExpenseByPlayer: Type.Optional(Type.Record(Type.String(), Type.Number()))
})

export const CorporationStateValidator = Compile(CorporationState)

export class HydratedCorporationState
    extends Hydratable<typeof CorporationState>
    implements CorporationState
{
    declare id: CorporationId
    declare active: boolean
    declare treasury: number
    declare shares: Share[]
    declare homePlanetId?: string
    declare cargo: number
    declare orderedShipLevels: number[]
    declare deliveredShipLevels: number[]
    declare wormholeActive: boolean
    declare powers: CorporatePowerState[]
    declare agreement?: AgreementState
    declare loanCount: number
    declare turnOrderPosition: number
    declare unbuiltOutposts: number
    declare cargoBoostCubesOnCharter?: number
    declare secretAgentsMiningCapacityBonus?: number
    declare dividendsReceivedByPlayer?: Record<string, number>
    declare privateContractorExpenseByPlayer?: Record<string, number>

    constructor(data: CorporationState) {
        super(data, CorporationStateValidator)
    }

    get issuedShareCount(): number {
        return this.shares.filter((share) => share.owner !== undefined).length
    }

    get availableShareCount(): number {
        return this.shares.filter((share) => share.owner === undefined).length
    }

    // Stalled IPO (Glossary, page 29): "Anytime, Ongoing. This Corporation becomes a Major
    // Corporation on its 5th Share issued instead of its 4th." Always in effect while the Power
    // is active - no action/decision involved, so it's implemented entirely here rather than as
    // a wrapper at each call site (unlike e.g. Ore Refinement's effectiveMiningCapacityForCorporation).
    get status(): CorporationStatus {
        return this.statusForIssuedShareCount(this.issuedShareCount)
    }

    // Same threshold logic as the live status getter above, but for a hypothetical issued Share
    // count rather than the actual current one - lets a caller (e.g. the Issue Share UI, once an
    // auction is underway for this Corporation's next Share) preview the Status a not-yet-issued
    // Share will produce once it actually is, without duplicating the Stalled IPO threshold here
    // and drifting out of sync with it.
    statusForIssuedShareCount(issuedShareCount: number): CorporationStatus {
        const majorThreshold = this.hasActivePower(CorporatePowerId.StalledIPO) ? 5 : 4
        if (issuedShareCount >= majorThreshold) {
            return CorporationStatus.Major
        }
        if (issuedShareCount >= 2) {
            return CorporationStatus.Minor
        }
        return CorporationStatus.Private
    }

    getPresidentPlayerId(): string | undefined {
        const shareCountsByPlayerId = new Map<string, number>()
        // Ties are broken by whoever bought their (highest-count) share first, so track the
        // lowest issuedSequence seen for each player as a tiebreaker.
        const earliestSequenceByPlayerId = new Map<string, number>()
        for (const share of this.shares) {
            if (share.owner?.type !== 'player') {
                continue
            }
            const playerId = share.owner.playerId
            shareCountsByPlayerId.set(playerId, (shareCountsByPlayerId.get(playerId) ?? 0) + 1)
            if (share.issuedSequence !== undefined) {
                const earliest = earliestSequenceByPlayerId.get(playerId)
                if (earliest === undefined || share.issuedSequence < earliest) {
                    earliestSequenceByPlayerId.set(playerId, share.issuedSequence)
                }
            }
        }

        let presidentPlayerId: string | undefined
        let highestShareCount = 0
        let presidentEarliestSequence = Infinity
        for (const [playerId, shareCount] of shareCountsByPlayerId) {
            const earliestSequence = earliestSequenceByPlayerId.get(playerId) ?? Infinity
            if (
                shareCount > highestShareCount ||
                (shareCount === highestShareCount && earliestSequence < presidentEarliestSequence)
            ) {
                highestShareCount = shareCount
                presidentEarliestSequence = earliestSequence
                presidentPlayerId = playerId
            }
        }
        return presidentPlayerId
    }

    shareCountForPlayer(playerId: string): number {
        return this.shares.filter(
            (share) => share.owner?.type === 'player' && share.owner.playerId === playerId
        ).length
    }

    hasActivePower(powerId: string): boolean {
        return this.powers.some((power) => power.id === powerId)
    }

    // Whether this Corporation may build Outposts on Alien Planet hexes at all - true for
    // either of the two Powers that grant it: Alien Explorers (every starting Corporation's own
    // Setup Power, until it's flipped away by Signing The Agreement - operations/agreement.ts)
    // or Secret Agents (Amethyst Agency's own Formation Power, granted directly at Formation -
    // actions/chooseAmethystHomePlanet.ts - never drafted, never lost). The two Powers differ in
    // their OTHER effects (Secret Agents grants no Alien Technology Cube for the build, and adds
    // its own Mining Capacity choice - see operations/network.ts's awardAlienExplorersCubes), but
    // for the plain "can it build here" question every canBuildExpansionOutpost call site cares
    // about, they're identical - hence one shared helper instead of every caller repeating the
    // AlienExplorers-only check (which was the actual bug that kept Amethyst Agency itself off of
    // Alien Planets despite Secret Agents saying otherwise).
    canBuildOnAlienPlanets(): boolean {
        return (
            this.hasActivePower(CorporatePowerId.AlienExplorers) ||
            this.hasActivePower(CorporatePowerId.SecretAgents) ||
            this.hasActivePower(CorporatePowerId.TaxAgents)
        )
    }

    issueShareToPlayer(playerId: string, sequence: number, pricePaid?: number) {
        const unissuedShare = this.shares.find((share) => share.owner === undefined)
        if (!unissuedShare) {
            throw Error(`No available shares to issue for corporation ${this.id}`)
        }
        unissuedShare.owner = { type: 'player', playerId }
        unissuedShare.issuedSequence = sequence
        unissuedShare.pricePaid = pricePaid
    }

    // Running total tracker for dividendsReceivedByPlayer (see the schema field's own comment
    // above) - called by PayDividends for each Share's regular payout and by Sign The Agreement
    // for its one-time Bonus Dividend. Never called by ReleaseDividends (Frozen -> Liquid is not
    // new income).
    addDividendReceived(playerId: string, amount: number) {
        this.dividendsReceivedByPlayer = this.dividendsReceivedByPlayer ?? {}
        this.dividendsReceivedByPlayer[playerId] =
            (this.dividendsReceivedByPlayer[playerId] ?? 0) + amount
    }

    // Running total tracker for privateContractorExpenseByPlayer (see the schema field's own
    // comment above) - called by operations/network.ts's finalizeExpansion for each Private
    // Contractor build, right alongside the actual liquidFunds deduction it mirrors.
    addPrivateContractorExpense(playerId: string, amount: number) {
        this.privateContractorExpenseByPlayer = this.privateContractorExpenseByPlayer ?? {}
        this.privateContractorExpenseByPlayer[playerId] =
            (this.privateContractorExpenseByPlayer[playerId] ?? 0) + amount
    }

    issueShareToAlien(sequence: number) {
        const unissuedShare = this.shares.find((share) => share.owner === undefined)
        if (!unissuedShare) {
            throw Error(`No available shares to issue for corporation ${this.id}`)
        }
        unissuedShare.owner = { type: 'alien' }
        unissuedShare.issuedSequence = sequence
    }
}
