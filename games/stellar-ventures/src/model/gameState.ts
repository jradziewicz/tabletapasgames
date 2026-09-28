import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedSimpleAuction,
    HydratedTurnManager,
    PrngState,
    SimpleAuction
} from '@tabletop/common'
import { StellarVenturesPlayerState, HydratedStellarVenturesPlayerState } from './playerState.js'
import { CorporationId, CorporationState, HydratedCorporationState } from './corporation.js'
import { BoardState, HydratedBoardState } from './board.js'
import { ShipyardState, HydratedShipyardState } from './shipyard.js'
import { BoardMap, Difficulty } from '../definition/config.js'
import { type BoardMapDefinition, BoardMapDefinitions } from '../data/boardMaps.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'

export type AlienCorporationState = Type.Static<typeof AlienCorporationState>
export const AlienCorporationState = Type.Object({
    miningCapacity: Type.Number()
})

// A single player's Boardroom Vote(s) placed on one Corporation during the current Boardroom
// Battle (Investor Round, second step) - see operations/boardroomBattle.ts. Not yet resolved:
// whether these are removed from the game for good or returned to the player is decided once
// every player has had their one chance to vote.
export type BoardroomVote = Type.Static<typeof BoardroomVote>
export const BoardroomVote = Type.Object({
    playerId: Type.String(),
    corporationId: Type.Enum(CorporationId),
    amount: Type.Number()
})

// One Corporation's own contribution to a completed batch of Tax Payments (see
// TaxPaymentSummary below) - amount actually paid (operations/taxes.ts's payTax, clamped to
// whatever Treasury could cover) and how many NEW Loans it took on to get there.
export type TaxPaymentRecord = Type.Static<typeof TaxPaymentRecord>
export const TaxPaymentRecord = Type.Object({
    corporationId: Type.Enum(CorporationId),
    amount: Type.Number(),
    loans: Type.Number()
})

// A permanent, replay-free record of the most recently COMPLETED batch of Tax Payments -
// state.taxPayerCorporationIds fully drained (stateHandlers/payTaxes.ts), covering both the
// regular Administration Round Pay Taxes step (stateHandlers/assignTurnOrder.ts) and a Tax
// Agents forced payment (actions/taxAgentsForceTax.ts). `id` increments once per completed
// batch purely so a returning player can tell "have I seen this one yet" from permanent state
// alone (games/stellar-ventures-ui's PayTaxesRevealOverlay.svelte tracks it in localStorage,
// the same per-viewer "seen" pattern FirstShipOrderedRevealOverlay uses for Shipyard sections).
// zones snapshots which Tax Zones (Borders) were closed - and what each currently taxes - at
// the moment this batch was collected, since a later Border closing shouldn't retroactively
// change what an earlier reveal displays.
export type TaxPaymentSummary = Type.Static<typeof TaxPaymentSummary>
export const TaxPaymentSummary = Type.Object({
    id: Type.Number(),
    taxBoxBefore: Type.Number(),
    taxBoxAfter: Type.Number(),
    zones: Type.Array(Type.Object({ level: Type.Number(), tax: Type.Number() })),
    payments: Type.Array(TaxPaymentRecord)
})

export type StellarVenturesGameState = Type.Static<typeof StellarVenturesGameState>
export const StellarVenturesGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(StellarVenturesPlayerState),
            machineState: Type.Enum(MachineState),
            difficulty: Type.Enum(Difficulty),
            boardMap: Type.Optional(Type.Enum(BoardMap)),
            taxBox: Type.Optional(Type.Number()),
            era: Type.Number(),
            corporations: Type.Array(CorporationState),
            corporationTurnOrder: Type.Array(Type.Enum(CorporationId)),
            activeCorporationIndex: Type.Number(),
            board: BoardState,
            shipyard: ShipyardState,
            alienCorporation: AlienCorporationState,
            directorPlayerId: Type.String(),
            availableCorporatePowerIds: Type.Array(Type.String()),
            corporatePowerDrawPileIds: Type.Array(Type.String()),

            // Nebular Explorers (Corporate Power Glossary, page 29): Setup deals 7 of the 10
            // Alien Agreement Tiles (definition/initializer.ts's ALIEN_AGREEMENT_TILE_CHEVRONS)
            // face-down to the 7 Alien Planet hexes, leaving 3 unused. Those 3 are shuffled once
            // at Setup (same shuffle draw as the 7 dealt ones) and kept here in that fixed random
            // order - Nebular Explorers (actions/nebularExplorers.ts) simply pops the first one
            // off whenever used, exactly like state.corporatePowerDrawPileIds is drawn from
            // front-to-back rather than re-shuffled at draw time.
            unusedAlienAgreementTileChevrons: Type.Array(Type.Number()),

            // Initial Auction (Setup): auctions one corporation at a time, 5th-to-1st turn order.
            initialAuctionQueue: Type.Array(Type.Enum(CorporationId)),
            activeInitialAuctionCorporationId: Type.Optional(Type.Enum(CorporationId)),
            activeInitialAuction: Type.Optional(SimpleAuction),
            initialAuctionBidOrder: Type.Optional(Type.Array(Type.String())),
            initialAuctionCurrentBidderId: Type.Optional(Type.String()),
            // Set when the most recently resolved Initial Auction had a winner - i.e. every
            // auction after the first. Only the very first auction bids in reverse turn order;
            // every subsequent one instead starts with (and proceeds clockwise from) this player,
            // per the game's co-designer. Never cleared once Initial Auction finishes since its
            // enter() never runs again afterwards.
            previousInitialAuctionWinnerId: Type.Optional(Type.String()),

            // Issue Share (Corporation Round, first step): the active Corporation is
            // state.activeCorporationId. Bidding order runs in turn order starting with (and
            // going clockwise from) that Corporation's President.
            activeShareAuction: Type.Optional(SimpleAuction),
            shareAuctionBidOrder: Type.Optional(Type.Array(Type.String())),
            shareAuctionCurrentBidderId: Type.Optional(Type.String()),

            // Boardroom Battle (Investor Round, second step - rulebook page 18): voting starts
            // with (and proceeds clockwise from) the Director, one chance per player to place
            // any number of their remaining Boardroom Votes on a single Corporation.
            // boardroomBattleTiedCorporationIds is set only when the vote ends in a tie for the
            // most Votes (including a tie at 0 - i.e. nobody voted), which the Director then
            // breaks. Whichever Corporation wins must issue a Share, auctioned off starting with
            // (and proceeding clockwise from) the Director - reusing activeShareAuction /
            // shareAuctionBidOrder / shareAuctionCurrentBidderId above (see
            // operations/shareAuction.ts) rather than duplicating them.
            boardroomBattleVoteOrder: Type.Optional(Type.Array(Type.String())),
            boardroomBattleCurrentVoterId: Type.Optional(Type.String()),
            boardroomBattleVotes: Type.Optional(Type.Array(BoardroomVote)),
            boardroomBattleTiedCorporationIds: Type.Optional(Type.Array(Type.Enum(CorporationId))),
            boardroomBattleCorporationId: Type.Optional(Type.Enum(CorporationId)),

            // Investor Shenanigans (Investor Round, third step - rulebook page 19): each player,
            // starting with (and proceeding clockwise from) the Director, takes their Investor
            // Action immediately followed by their Alien Tech Action. Both halves of a player's
            // turn share this same player order and current-player pointer - see
            // stateHandlers/investorAction.ts, stateHandlers/alienTechAction.ts and
            // operations/investorShenanigans.ts.
            investorShenanigansPlayerOrder: Type.Optional(Type.Array(Type.String())),
            investorShenanigansCurrentPlayerId: Type.Optional(Type.String()),

            // Expand Network / Private Contractor (rulebook pages 12-13, 19): both build 1-5
            // Outposts "at normal cost" / "following Expand Network rules" - including the same
            // ₮1-per-other-Corporation placement penalty (Jerry-Rig alone is exempt from it,
            // and never touches this deferred-cost system at all) - but Outposts are built one at
            // a time - see actions/expandNetwork.ts, actions/privateContractor.ts,
            // stateHandlers/expandNetworkOrWormhole.ts and stateHandlers/investorAction.ts. While
            // expandingCorporationId is set, that many-Outpost build is "in progress": the
            // Charter/Liquid Funds cost (based on the running total Outpost count, plus the
            // accumulated placement penalty in expandingPlacementPenalty) is deferred and charged
            // as a single lump sum only once the whole build ends - see operations/network.ts's
            // finalizeExpansion - whether that end comes from choosing to sign (see below) or
            // from explicitly stopping (DeclineExpandNetworkOrWormhole / FinishExpansion).
            expandingCorporationId: Type.Optional(Type.Enum(CorporationId)),
            expandingBuilderId: Type.Optional(Type.String()),
            expandingKind: Type.Optional(
                Type.Union([
                    Type.Literal(ActionType.ExpandNetwork),
                    Type.Literal(ActionType.PrivateContractor)
                ])
            ),
            expandingHexIds: Type.Optional(Type.Array(Type.String())),
            expandingPlacementPenalty: Type.Optional(Type.Number()),

            // Sign The Agreement (rulebook page 22): offered immediately after any single Outpost
            // build (ExpandNetwork, CreateWormhole, JerryRig or PrivateContractor) lands on an
            // Alien Planet with a still-hidden Alien Agreement Tile, if the Corporation now meets
            // every requirement (see operations/agreement.ts). The choice always belongs to the
            // Corporation's President - who may not be whoever just built (e.g. a Shareholder's
            // Jerry-Rig during Investor Shenanigans) - so OfferSignTheAgreementStateHandler
            // redirects activePlayerIds to the President, then resumes once they sign or decline.
            // Signing and declining can resume to DIFFERENT places: signing always ends the build
            // action (signTheAgreementResumeState), while declining lets an Expand Network or
            // Private Contractor build continue (signTheAgreementDeclineResumeState loops back to
            // that build's own state) - for a single-Outpost build (CreateWormhole, JerryRig)
            // there's nothing to continue, so declineResumeState is left unset and defaults to
            // the same place signing resumes to. See stateHandlers/offerSignTheAgreement.ts.
            signTheAgreementCorporationId: Type.Optional(Type.Enum(CorporationId)),
            signTheAgreementHexId: Type.Optional(Type.String()),
            signTheAgreementResumeState: Type.Optional(Type.Enum(MachineState)),
            signTheAgreementDeclineResumeState: Type.Optional(Type.Enum(MachineState)),

            // Secret Agents' Mining Capacity choice (Amethyst Agency's own Formation Power -
            // CorporatePowerId.SecretAgents): offered immediately after any single Outpost build
            // (ExpandNetwork, CreateWormhole, JerryRig, PrivateContractor or NebularExplorers)
            // lands Amethyst Agency on an Alien Planet - see operations/agreement.ts's
            // isEligibleForSecretAgentsChoice. Like Sign The Agreement, the choice always belongs
            // to the Corporation's President, not necessarily whoever just built, so
            // OfferSecretAgentsChoiceStateHandler redirects activePlayerIds to the President.
            // Unlike Sign The Agreement, neither option ends the in-progress build, so there's
            // only one resume state (secretAgentsResumeState), not a separate sign/decline pair -
            // see stateHandlers/offerSecretAgentsChoice.ts.
            secretAgentsCorporationId: Type.Optional(Type.Enum(CorporationId)),
            secretAgentsHexId: Type.Optional(Type.String()),
            secretAgentsResumeState: Type.Optional(Type.Enum(MachineState)),

            taxAgentsCorporationId: Type.Optional(Type.Enum(CorporationId)),
            taxAgentsHexId: Type.Optional(Type.String()),
            taxAgentsResumeState: Type.Optional(Type.Enum(MachineState)),

            taxPayerCorporationIds: Type.Optional(Type.Array(Type.Enum(CorporationId))),
            taxResumeState: Type.Optional(Type.Enum(MachineState)),

            // Live accumulation while a batch of Tax Payments is draining (see TaxPaymentSummary
            // above) - taxBoxBefore is captured the instant the batch starts, one payment record
            // is appended per PayTax action, and both are folded into taxPaymentSummary and
            // cleared the moment taxPayerCorporationIds fully drains.
            pendingTaxPaymentBoxBefore: Type.Optional(Type.Number()),
            pendingTaxPayments: Type.Optional(Type.Array(TaxPaymentRecord)),
            taxPaymentSummary: Type.Optional(TaxPaymentSummary),

            // Draft Power (rulebook page 11's Initial Auction step 4, and page 22's Sign The
            // Agreement step 5): the President of draftPowerCorporationId chooses one Power from
            // state.availableCorporatePowerIds, then play resumes at draftPowerResumeState. See
            // actions/draftPower.ts and stateHandlers/draftPower.ts.
            draftPowerCorporationId: Type.Optional(Type.Enum(CorporationId)),
            draftPowerResumeState: Type.Optional(Type.Enum(MachineState)),

            // Alien Alchemist (Corporate Power Glossary, page 29): whether the current
            // Corporation Round's active Corporation has already used Alien Alchemist this round
            // (see actions/alienAlchemist.ts). Reset to false every time
            // operations/corporationRound.ts's advanceToNextCorporationOrInvestorRound hands the
            // Corporation Round to a new Corporation (or ends it) - not per-Corporation state,
            // since only one Corporation's round is ever active at a time.
            alienAlchemistUsedThisCorporationRound: Type.Boolean(),

            // Dismantling Outposts (Corporate Power Glossary, page 29): identical once-per-
            // Corporation-Round bookkeeping as alienAlchemistUsedThisCorporationRound above, for
            // actions/dismantlingOutposts.ts - reset alongside it in the same place.
            dismantlingOutpostsUsedThisCorporationRound: Type.Boolean(),

            // Fine Print (Corporate Power Glossary, page 29): the Corporation (at most 1 - each
            // Neutral Power is a single physical tile) that discarded Fine Print to exempt itself
            // from THIS specific Boardroom Battle (no Votes placeable on it, can't be forced to
            // Issue a Share) - see stateHandlers/boardroomBattle.ts and actions/finePrint.ts.
            // Cleared once this Boardroom Battle fully resolves; a fresh one starts unexempted.
            finePrintExemptCorporationId: Type.Optional(Type.Enum(CorporationId)),
            // Whether Fine Print's one-time "before Boardroom Battle begins" offer has already
            // been resolved (used - see finePrintExemptCorporationId - or declined) for THIS
            // Boardroom Battle. Distinct from finePrintExemptCorporationId because declining
            // still needs to permanently close the window for this specific Battle without
            // marking any Corporation exempt. Reset to undefined alongside
            // finePrintExemptCorporationId once this Boardroom Battle fully resolves.
            finePrintOfferResolved: Type.Optional(Type.Boolean()),

            // Pay Dividends powers (Deep Space Smuggling / Deep Space Pirates, Corporate Power
            // Glossary, page 29): before Pay Dividends' automatic payout runs, the active
            // Corporation's President gets one chance to copy another Corporation's CARGO
            // (Smuggling) and/or Mining Capacity (Pirates), if they hold the matching Power - see
            // stateHandlers/payDividends.ts, actions/deepSpaceSmuggling.ts and
            // actions/deepSpacePirates.ts. Which other Corporation to substitute in for the active
            // Corporation's own CARGO / Mining Capacity when the automatic payout actually runs;
            // set by using the Power (which also discards it, being One-Time), left unset if
            // declined or not held. Read (and cleared) by actions/payDividends.ts.
            payDividendsCopyCargoFromCorporationId: Type.Optional(Type.Enum(CorporationId)),
            payDividendsCopyMiningCapacityFromCorporationId: Type.Optional(
                Type.Enum(CorporationId)
            ),
            // Gates re-offering each Power within THIS Pay Dividends instance (used, declined, or
            // not held all count as "resolved" here) - reset to undefined every time
            // PayDividendsStateHandler.onAction advances to OrderShips, so the next Corporation's
            // (or this same Corporation's next turn's) Pay Dividends starts fresh. Two separate
            // flags since a Corporation could hold both Powers at once and resolve them one at a
            // time - see stateHandlers/payDividends.ts's pendingPayDividendsPower.
            payDividendsSmugglingOfferResolved: Type.Optional(Type.Boolean()),
            payDividendsPiratesOfferResolved: Type.Optional(Type.Boolean()),

            // Backroom Deal (Corporate Power Glossary, page 29): whether this One-Time Power has
            // already been offered/resolved for the CURRENT Liquidation - see
            // stateHandlers/liquidation.ts and actions/backroomDeal.ts. Liquidation only happens
            // once per game, so this is really just "has Backroom Deal been used or declined yet",
            // but modeled the same way as the other pre-automatic-step decisions here for
            // consistency.
            backroomDealResolved: Type.Optional(Type.Boolean()),

            // Spare Parts (Corporate Power Glossary, page 29): "Anytime, One-Time (limit 1 Ship).
            // When a Ship of this Corporation would be Scrapped, the President may move 1 of
            // those Ships onto this tile instead, delaying its Scrap (and the CARGO reduction) by
            // one Dividend payment." Since it's a unique physical tile, at most 1 Corporation can
            // ever hold it, so at most one Scrapping Event can ever be paused awaiting this
            // decision at a time - see operations/shipOrdering.ts's applyScrappingEvent (which
            // sets the pending* fields below instead of removing that Corporation's Delivered
            // Ship immediately) and stateHandlers/offerSpareParts.ts (which the pending state
            // redirects into - mirroring signTheAgreement's redirect pattern). Once resolved
            // (actions/spareParts.ts or actions/declineSpareParts.ts), a rescued Ship's info moves
            // into the sparePartsParked* fields until actions/payDividends.ts finally scraps it
            // for real, exactly one Dividend payment later.
            pendingSparePartsCorporationId: Type.Optional(Type.Enum(CorporationId)),
            pendingSparePartsShipLevel: Type.Optional(Type.Number()),
            pendingSparePartsResumeState: Type.Optional(Type.Enum(MachineState)),
            sparePartsParkedCorporationId: Type.Optional(Type.Enum(CorporationId)),
            sparePartsParkedShipLevel: Type.Optional(Type.Number())
        })
    ])
)

const StellarVenturesGameStateValidator = Compile(StellarVenturesGameState)

export class HydratedStellarVenturesGameState
    extends HydratableGameState<typeof StellarVenturesGameState, HydratedStellarVenturesPlayerState>
    implements StellarVenturesGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedStellarVenturesPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare difficulty: Difficulty
    declare boardMap?: BoardMap
    declare taxBox?: number
    declare era: number
    declare corporations: HydratedCorporationState[]
    declare corporationTurnOrder: CorporationId[]
    declare activeCorporationIndex: number
    declare board: HydratedBoardState
    declare shipyard: HydratedShipyardState
    declare alienCorporation: AlienCorporationState
    declare directorPlayerId: string
    declare availableCorporatePowerIds: string[]
    declare corporatePowerDrawPileIds: string[]
    declare unusedAlienAgreementTileChevrons: number[]
    declare initialAuctionQueue: CorporationId[]
    declare activeInitialAuctionCorporationId?: CorporationId
    declare activeInitialAuction?: HydratedSimpleAuction
    declare initialAuctionBidOrder?: string[]
    declare initialAuctionCurrentBidderId?: string
    declare previousInitialAuctionWinnerId?: string
    declare activeShareAuction?: HydratedSimpleAuction
    declare shareAuctionBidOrder?: string[]
    declare shareAuctionCurrentBidderId?: string
    declare boardroomBattleVoteOrder?: string[]
    declare boardroomBattleCurrentVoterId?: string
    declare boardroomBattleVotes?: BoardroomVote[]
    declare boardroomBattleTiedCorporationIds?: CorporationId[]
    declare boardroomBattleCorporationId?: CorporationId
    declare investorShenanigansPlayerOrder?: string[]
    declare investorShenanigansCurrentPlayerId?: string
    declare expandingCorporationId?: CorporationId
    declare expandingBuilderId?: string
    declare expandingKind?: ActionType.ExpandNetwork | ActionType.PrivateContractor
    declare expandingHexIds?: string[]
    declare expandingPlacementPenalty?: number
    declare signTheAgreementCorporationId?: CorporationId
    declare signTheAgreementHexId?: string
    declare signTheAgreementResumeState?: MachineState
    declare signTheAgreementDeclineResumeState?: MachineState
    declare secretAgentsCorporationId?: CorporationId
    declare secretAgentsHexId?: string
    declare secretAgentsResumeState?: MachineState
    declare taxAgentsCorporationId?: CorporationId
    declare taxAgentsHexId?: string
    declare taxAgentsResumeState?: MachineState
    declare taxPayerCorporationIds?: CorporationId[]
    declare taxResumeState?: MachineState
    declare pendingTaxPaymentBoxBefore?: number
    declare pendingTaxPayments?: TaxPaymentRecord[]
    declare taxPaymentSummary?: TaxPaymentSummary
    declare draftPowerCorporationId?: CorporationId
    declare draftPowerResumeState?: MachineState
    declare alienAlchemistUsedThisCorporationRound: boolean
    declare dismantlingOutpostsUsedThisCorporationRound: boolean
    declare finePrintExemptCorporationId?: CorporationId
    declare finePrintOfferResolved?: boolean
    declare payDividendsCopyCargoFromCorporationId?: CorporationId
    declare payDividendsCopyMiningCapacityFromCorporationId?: CorporationId
    declare payDividendsSmugglingOfferResolved?: boolean
    declare payDividendsPiratesOfferResolved?: boolean
    declare backroomDealResolved?: boolean
    declare pendingSparePartsCorporationId?: CorporationId
    declare pendingSparePartsShipLevel?: number
    declare pendingSparePartsResumeState?: MachineState
    declare sparePartsParkedCorporationId?: CorporationId
    declare sparePartsParkedShipLevel?: number

    constructor(data: StellarVenturesGameState) {
        super(data, StellarVenturesGameStateValidator)

        this.players = data.players.map((player) => new HydratedStellarVenturesPlayerState(player))
        this.corporations = data.corporations.map(
            (corporation) => new HydratedCorporationState(corporation)
        )
        this.board = new HydratedBoardState(data.board)
        this.shipyard = new HydratedShipyardState(data.shipyard)
        this.activeInitialAuction = data.activeInitialAuction
            ? new HydratedSimpleAuction(data.activeInitialAuction)
            : undefined
        this.activeShareAuction = data.activeShareAuction
            ? new HydratedSimpleAuction(data.activeShareAuction)
            : undefined
    }

    getCorporation(corporationId: CorporationId): HydratedCorporationState {
        const corporation = this.corporations.find((candidate) => candidate.id === corporationId)
        if (!corporation) {
            throw Error(`No corporation found with id ${corporationId}`)
        }
        return corporation
    }

    get boardMapDefinition(): BoardMapDefinition {
        return BoardMapDefinitions[this.boardMap ?? BoardMap.Alpha]
    }

    get usesTaxes(): boolean {
        return this.boardMapDefinition.borders.length > 0
    }

    get activeCorporationId(): CorporationId | undefined {
        return this.corporationTurnOrder[this.activeCorporationIndex]
    }
}
