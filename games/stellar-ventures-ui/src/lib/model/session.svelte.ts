import { GameSession, TitlePreferences } from '@tabletop/frontend-components'
import { ActionSource, createAction, type GameAction } from '@tabletop/common'
import {
    ActionType,
    StellarVenturesApiActions,
    Liquidate,
    MachineState,
    PlaceBid,
    PassAuction,
    DraftPower,
    IssueShare,
    DeclineIssueShare,
    PlaceShareBid,
    PassShareBid,
    ExpandNetwork,
    DeclineExpandNetworkOrWormhole,
    CreateWormhole,
    AlienAlchemist,
    OrderShip,
    ForcedShipPurchase,
    DeclineOrderShips,
    PlaceBoardroomVote,
    DeclineBoardroomVote,
    ChooseBoardroomBattleCorporation,
    BlackMarket,
    PassInvestorAction,
    InsuranceFraud,
    Launder,
    CargoBoost,
    ResearchWormhole,
    LeakedResearch,
    AlienEngineering,
    PassAlienTechAction,
    JerryRig,
    PrivateContractor,
    DismantlingOutposts,
    FinishExpansion,
    DevelopPlanets,
    SignTheAgreement,
    DeclineSignTheAgreement,
    BackroomDeal,
    DeclineBackroomDeal,
    BackroomDealDirection,
    DeepSpaceSmuggling,
    DeepSpacePirates,
    DeclinePayDividendsPower,
    FinePrint,
    DeclineFinePrint,
    SpareParts,
    DeclineSpareParts,
    IncreaseAlienMiningCapacity,
    IncreaseAmethystMiningCapacity,
    PayTax,
    TaxAgentsForceTax,
    TaxAgentsTakeFromTaxBox,
    ChooseAmethystHomePlanet,
    InvestorActionId,
    AlienTechActionId,
    StellarVenturesPreferenceDefinition,
    type StellarVenturesPreferences,
    type CorporationId,
    type StellarVenturesGameState,
    type HydratedStellarVenturesGameState
} from '@tabletop/stellar-ventures'

/**
 * Minimal Stellar Ventures game session. Most actions still go through the generic
 * submitGenericAction below (see ActionPanel.svelte) by letting the player pick any
 * currently-valid ActionType and hand-type its JSON payload - the "ugly but playable"
 * milestone from the UI task list. Bespoke per-action methods (placeBid/passAuction so
 * far, for the Initial Auction flow) replace that action-by-action as the UI matures.
 */
export class StellarVenturesGameSession extends GameSession<
    StellarVenturesGameState,
    HydratedStellarVenturesGameState
> {
    lastActionError: string | undefined = $state()

    // Per-player UI preferences (currently just each player's own custom TabWorkspace layout -
    // see GameTable.svelte) - saved per account via the title preferences system, so a player's
    // custom layout follows them between browsers on the same account. There's no dedicated
    // "reset layout" action; a player gets back to a from-scratch layout by closing panes and
    // re-adding the tabs they want via each pane's own Add tab menu.
    readonly preferences: TitlePreferences<typeof StellarVenturesPreferences> =
        this.createPreferences(StellarVenturesPreferenceDefinition)

    // Which of Expand Network / Create Wormhole the board's hex clicks currently submit,
    // while both are simultaneously legal options during ExpandNetworkOrWormhole (a
    // Corporation with both an adjacent expansion target AND active Wormhole Technology).
    // Board.svelte falls back to whichever single one is valid when this is unset, and
    // ExpandNetworkPanel offers an explicit toggle only when both are valid at once.
    boardActionMode: ActionType | undefined = $state()

    // Create Wormhole's tentative hex pick (Board.svelte's onHexClick), before it's actually
    // built - the co-designer wanted this "not so immediate": a first click just highlights the
    // hex and previews its cost/Mining Capacity gain (ExpandNetworkPanel.svelte, reusing the same
    // CorporationInfoBox preview treatment Expand Network's own live build already gets), and a
    // second click on that SAME hex is what actually submits CreateWormhole. Reset in
    // beforeNewState (same as boardActionMode - a fresh server state means a fresh pick), and
    // treated as "nothing submitted yet" by the undo() override below, same as
    // developPlanetsHexIds.
    wormholeSelectedHexId: string | undefined = $state()

    // Which Corporation Jerry-Rig/Private Contractor is currently building an Outpost for -
    // set by InvestorActionPanel's own Corporation picker before the first hex is clicked (see
    // Board.svelte's onHexClick). Once a Private Contractor build is actually underway,
    // gameState.expandingCorporationId takes over as the source of truth instead (same
    // Corporation, just now confirmed server-side) - this field only matters for that first
    // click, or for a Jerry-Rig one-shot which never sets expandingCorporationId at all.
    investorBuildCorporationId: CorporationId | undefined = $state()

    // Develop Planet(s) (Alien Tech Action): unlike every other hex-based action, this one
    // submits a whole batch of hexes at once rather than one at a time, so the pending
    // selection has to live somewhere client-side until the player actually submits it -
    // Board.svelte toggles hexes in/out via toggleDevelopPlanetsHex as they're clicked.
    // Cleared on submit (developPlanets) or cancelDevelopPlanets, same as
    // investorBuildCorporationId - not reset in beforeNewState.
    developPlanetsHexIds: string[] = $state([])

    // Which Investor Action / Alien Tech Action circle-picker is currently open (Insurance
    // Fraud's ship level, Jerry-Rig/Private Contractor's Corporation, Cargo Boost/Research
    // Wormhole/Launder's Corporation) - moved here from each panel's own local component state
    // so the undo() override below can see "the player has opened a picker but hasn't actually
    // submitted anything to the server yet" and treat Undo as cancelling that pending choice,
    // instead of falling through to the engine's real undo. Not reset in beforeNewState, same
    // reasoning as investorBuildCorporationId - cleared explicitly by each panel instead.
    investorPickerOpen: InvestorActionId | undefined = $state()
    alienTechPickerOpen: AlienTechActionId | undefined = $state()

    // Sign The Agreement is walked through in this order: Sign (the Alien Explorers Power flips to
    // its "Sign The Agreement" face), Issue Share (a Share moves into Alien Shareholdings and the
    // Agreement Token lands on its track), then Flip the Alien Planet Tile. The first two steps are
    // local-only previews (signTheAgreementStaged, below) so the President can still walk back with
    // Back or Undo - nothing is submitted until the tile flip, since flipping reveals hidden
    // information and signTheAgreement.ts marks the action revealsInfo (no Undo past it). Issuing
    // the Share before the flip is purely a practical ordering for the table; the engine still
    // resolves everything atomically in one action.
    //
    // Once submitted, the same action immediately advances machineState away from
    // OfferSignTheAgreement (to DraftPower) - and ActionPanel.svelte ordinarily swaps panels the
    // instant machineState changes, which would yank OfferSignTheAgreementPanel off-screen before
    // the President sees the flipped tile. signTheAgreementReveal (set right after a successful
    // submit) tells ActionPanel to keep showing OfferSignTheAgreementPanel regardless of
    // machineState for as long as it stays set. corporationId/hexId snapshot the IDs
    // signTheAgreementCorporationId/signTheAgreementHexId held right before they cleared. Not reset
    // in beforeNewState - it has to survive the state update it itself triggers - cleared by
    // OfferSignTheAgreementPanel once the President clicks Continue.
    signTheAgreementStaged: 'power' | 'shares' | undefined = $state()

    signTheAgreementReveal:
        | {
              corporationId: CorporationId
              hexId: string
              // 'taxFraud' (Borders & Taxes only, and only when Committing Tax Fraud actually
              // took something from the Tax Box - see corporation.agreement.taxFraudAmount) is
              // an extra beat after the tile flip ('hex'), gated behind its own "Commit Tax
              // Fraud" button - themed as the President choosing to reveal the crime rather than
              // a rule step they're merely watching resolve.
              stage: 'hex' | 'taxFraud'
          }
        | undefined = $state()

    // Secret Agents' own "Increase Alien" reveal - same client-side pacing gate as
    // signTheAgreementReveal above, for the same reason: increaseAlienMiningCapacity.ts already
    // flips the tile and grants the Alien Corporation its Mining Capacity atomically the instant
    // the action is submitted, but that same action also immediately clears
    // secretAgentsCorporationId/secretAgentsHexId and moves machineState on, which would yank
    // OfferSecretAgentsChoicePanel off-screen before anyone actually saw the tile flip. Set by
    // OfferSecretAgentsChoicePanel.svelte's increaseAlien(), right after a successful submit,
    // snapshotting the corporationId/hexId that were just cleared - chevrons/gain are read
    // straight off the now-current game state, needing no snapshot of their own. Cleared
    // automatically after a few seconds (not by a player click - there's nothing left to decide,
    // this is purely "let them see it before moving on"). Not reset in beforeNewState, same
    // reasoning as signTheAgreementReveal - it needs to survive the very state update it
    // triggers.
    secretAgentsReveal:
        | {
              corporationId: CorporationId
              hexId: string
          }
        | undefined = $state()

    // TESTING ONLY - stashes the Backroom Deal/Decline Backroom Deal action that
    // testingUndoLiquidation() just rewound past, so testingRedoLiquidation() below can resubmit
    // that same decision and land back at the same EndOfGame outcome. Without this there'd be no
    // way back at all once a real, already-committed game-ending decision is undone this way -
    // the framework has no general Redo, and GameEndPanel.svelte (home of the "Undo Liquidation
    // (testing only)" button) disappears the instant gameState.result reverts to undefined,
    // taking its own Undo button down with it. Set only when the undone target was a genuine
    // player decision (a bare automatic Liquidate, when no Corporation ever held/could use
    // Backroom Deal, has no player-submittable equivalent to resubmit, so there's nothing to
    // stash in that case - see testingUndoLiquidation). Cleared the moment it's consumed, and
    // also by beforeNewState below so any OTHER action taken in the meantime invalidates it
    // rather than leaving a stale Redo button around. See Header.svelte's "Redo Liquidation
    // (testing only)" button, which - unlike the Undo button - has to live somewhere that stays
    // mounted regardless of machineState. Remove alongside testingUndoLiquidation/
    // testingRedoLiquidation once Backroom Deal/Accounting Gimmick testing is done.
    testingLiquidationRedoAction: GameAction | undefined = $state()

    override beforeNewState(): void {
        this.lastActionError = undefined
        this.boardActionMode = undefined
        this.taxLoanHexIds = []
        this.wormholeSelectedHexId = undefined
        this.testingLiquidationRedoAction = undefined
        this.signTheAgreementStaged = undefined
        // NOT reset here - a Private Contractor build spans several state updates (one per
        // Outpost placed) and needs to keep pointing at the same Corporation throughout. It's
        // cleared explicitly instead: right after a Jerry-Rig one-shot, and by finishExpansion.
        // this.investorBuildCorporationId intentionally left alone.
    }

    // Several Investor/Alien Tech Action flows have a window where the player has made a local
    // UI choice (opened a picker, picked a Corporation, ticked some hexes for Develop Planet(s))
    // but nothing has actually been submitted to the server yet. Pressing Undo in that window
    // should just cancel the pending local choice and drop back to the plain action circles -
    // "revert to the start of that player's turn," per the co-designer's spec - rather than fall
    // through to the framework's real undo. That matters because the framework's undoableAction
    // (libs/frontend-components/gameSession.svelte.ts) has no action of this player's to find
    // yet in that window, and in a hotseat game it doesn't require the found action to belong to
    // the current viewer at all - it takes literally the most recent action in history, which at
    // this point is still the PREVIOUS player's last action (e.g. the Pass that ended the prior
    // Boardroom Battle auction). Once a real action for this build HAS been submitted (the first
    // hex of a Jerry-Rig/Private Contractor build, confirmed via gameState.expandingCorporationId),
    // this override's conditions no longer match and it falls through to the framework's real
    // undo, which by then correctly finds and reverts only that single submitted action.
    override async undo() {
        if (
            this.investorPickerOpen !== undefined ||
            this.alienTechPickerOpen !== undefined ||
            (this.investorBuildCorporationId !== undefined &&
                this.gameState.expandingCorporationId === undefined) ||
            // Develop Planet(s) never submits anything to the server until Submit is
            // pressed (developPlanets()), so entering the mode at all - even with zero hexes
            // ticked yet - is exactly the same "nothing pending server-side" situation as an
            // open picker, and needs the same Undo-cancels-it-locally treatment.
            this.boardActionMode === ActionType.DevelopPlanets ||
            // A tentative Create Wormhole hex pick (see wormholeSelectedHexId above) hasn't been
            // submitted either - Undo should just clear the highlight/preview, not fall through
            // to reverting some earlier, unrelated action.
            this.wormholeSelectedHexId !== undefined ||
            // Sign / Issue Share are local previews until the tile flip submits the real action.
            this.signTheAgreementStaged !== undefined
        ) {
            this.investorPickerOpen = undefined
            this.alienTechPickerOpen = undefined
            this.investorBuildCorporationId = undefined
            this.developPlanetsHexIds = []
            this.boardActionMode = undefined
            this.wormholeSelectedHexId = undefined
            this.signTheAgreementStaged = undefined
            return
        }
        await super.undo()
    }

    async placeBid(amount: number) {
        if (!this.validActionTypes.includes(ActionType.PlaceBid)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(PlaceBid, { amount })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async passAuction() {
        if (!this.validActionTypes.includes(ActionType.PassAuction)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(PassAuction, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async draftPower(powerId: string) {
        if (!this.validActionTypes.includes(ActionType.DraftPower)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DraftPower, { powerId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async issueShare() {
        if (!this.validActionTypes.includes(ActionType.IssueShare)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(IssueShare, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async declineIssueShare() {
        if (!this.validActionTypes.includes(ActionType.DeclineIssueShare)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeclineIssueShare, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async placeShareBid(amount: number) {
        if (!this.validActionTypes.includes(ActionType.PlaceShareBid)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(PlaceShareBid, { amount })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async passShareBid() {
        if (!this.validActionTypes.includes(ActionType.PassShareBid)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(PassShareBid, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async expandNetwork(hexId: string) {
        if (!this.validActionTypes.includes(ActionType.ExpandNetwork)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(ExpandNetwork, { hexId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async createWormhole(hexId: string) {
        if (!this.validActionTypes.includes(ActionType.CreateWormhole)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(CreateWormhole, { hexId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Dismantling Outposts (Corporate Power Glossary, page 29): "Once per Corporation Round,
    // may return 1 Outpost from a Deep Space hex to the supply, paying ₮1 from the Treasury;
    // the removed Outpost may immediately be placed as part of any build action." Offered
    // alongside Alien Alchemist during Expand Network/Create Wormhole's own step - unlike that
    // one, this needs a specific hex (which Outpost to reclaim), so it rides the same board-click
    // machinery Expand Network/Create Wormhole use (ExpandNetworkPanel's own toggle sets
    // boardActionMode to ActionType.DismantlingOutposts; Board.svelte's onHexClick calls this).
    // Clearing boardActionMode on success (unlike Expand Network, which stays in its own mode for
    // further clicks) matters here because this is a one-shot power, not a repeatable build - once
    // used, dismantlingOutpostsUsedThisCorporationRound flips server-side and there is nothing
    // left for further hex clicks in this mode to do, so hex clicks should fall back to whatever
    // Expand Network/Create Wormhole mode was active before.
    async dismantlingOutposts(hexId: string) {
        if (!this.validActionTypes.includes(ActionType.DismantlingOutposts)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DismantlingOutposts, { hexId })
            await this.applyAction(action)
            this.boardActionMode = undefined
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Deep Space Smuggling (Corporate Power Glossary, page 29): "Pay Dividends, One-Time. Copy
    // another Corporation's CARGO when determining Dividends. Discard after use." Offered right
    // at the start of the active Corporation's own Pay Dividends step, before the automatic
    // payout runs - see actions/deepSpaceSmuggling.ts / stateHandlers/payDividends.ts. Unlike
    // Dismantling Outposts above, this doesn't need a board hex click - the target is a
    // Corporation, chosen on the Dividend Chart itself (DeepSpaceSmugglingPanel.svelte /
    // DividendChartPanel.svelte's own clickable-cargo-marker mode).
    async deepSpaceSmuggling(corporationId: CorporationId) {
        if (!this.validActionTypes.includes(ActionType.DeepSpaceSmuggling)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeepSpaceSmuggling, { corporationId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Deep Space Pirates (Corporate Power Glossary, page 29): "Pay Dividends, One-Time. Copy
    // another Corporation's Mining Capacity when determining Dividends. Discard after use." Same
    // shape as Deep Space Smuggling above, just copying the other track - the target is a
    // Corporation, chosen on the Dividend Chart itself (DeepSpacePiratesPanel.svelte /
    // DividendChartPanel.svelte's own clickable-mining-marker mode).
    async deepSpacePirates(corporationId: CorporationId) {
        if (!this.validActionTypes.includes(ActionType.DeepSpacePirates)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeepSpacePirates, { corporationId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Declines whichever of Deep Space Smuggling / Deep Space Pirates is currently pending for
    // this Pay Dividends instance (see operations/corporatePowers.ts's pendingPayDividendsPower) -
    // shared by both, since they're offered one at a time and never simultaneously.
    async declinePayDividendsPower() {
        if (!this.validActionTypes.includes(ActionType.DeclinePayDividendsPower)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeclinePayDividendsPower, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Fine Print (Corporate Power Glossary, page 29): "Investor Round, One-Time. Before
    // Boardroom Battle begins, discard to prevent any Votes being placed on this Corporation
    // (and it can't be forced to Issue a Share) during that specific Boardroom Battle." Offered
    // once, right at the start of every fresh Boardroom Battle, to the President of whichever
    // Corporation holds it - see actions/finePrint.ts / stateHandlers/boardroomBattle.ts. Plain
    // Apply/Decline, no target to choose - see FinePrintPanel.svelte.
    async finePrint() {
        if (!this.validActionTypes.includes(ActionType.FinePrint)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(FinePrint, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async declineFinePrint() {
        if (!this.validActionTypes.includes(ActionType.DeclineFinePrint)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeclineFinePrint, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Spare Parts (Corporate Power Glossary, page 29): "Anytime, One-Time (limit 1 Ship). When a
    // Ship of this Corporation would be Scrapped, the President may move 1 of those Ships onto
    // this tile instead, delaying its Scrap (and the CARGO reduction) by one Dividend payment."
    // Offered right as a qualifying Scrap happens (state.pendingSparePartsCorporationId/
    // pendingSparePartsShipLevel name the one at-risk Ship - see actions/spareParts.ts) to the
    // President of whichever Corporation holds it. Unlike Fine Print/Deep Space Smuggling's
    // plain Apply button, per the co-designer this Power is used by clicking the at-risk Ship
    // itself (visually moving it onto the tile) - see SparePartsPanel.svelte.
    async spareParts() {
        if (!this.validActionTypes.includes(ActionType.SpareParts)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(SpareParts, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async declineSpareParts() {
        if (!this.validActionTypes.includes(ActionType.DeclineSpareParts)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeclineSpareParts, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Form Amethyst Agency's final step (stateHandlers/formAmethystAgency.ts): once its
    // Formation Auction resolves, the winning President chooses one of Amethyst Agency's 3
    // candidate Home Planets (data/alphaBoard.ts's AmethystCandidateHomeHexIds) via a board
    // click - see Board.svelte's own FormAmethystAgency board action mode.
    async chooseAmethystHomePlanet(hexId: string) {
        if (!this.validActionTypes.includes(ActionType.ChooseAmethystHomePlanet)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(ChooseAmethystHomePlanet, { hexId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async declineExpandNetworkOrWormhole() {
        if (!this.validActionTypes.includes(ActionType.DeclineExpandNetworkOrWormhole)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeclineExpandNetworkOrWormhole, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Alien Alchemist (Corporate Power Glossary, page 29): "remove 2 unbuilt Outposts of this
    // Corporation and return them to the box, gaining 1 Alien Technology Cube." Takes no
    // parameters - the 2 Outposts it removes are fungible pieces from the Corporation's own
    // physical supply, not specific ones a player picks - see ExpandNetworkPanel.svelte, which
    // drives its own "highlight 2 Outposts, click one to confirm" flow entirely client-side
    // before ever calling this.
    async alienAlchemist() {
        if (!this.validActionTypes.includes(ActionType.AlienAlchemist)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(AlienAlchemist, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async orderShip(level: number) {
        if (!this.validActionTypes.includes(ActionType.OrderShip)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(OrderShip, { level })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Forced Purchase's own "No Credits?" Loans (rulebook pages 16-17 & 25) - unlike Develop
    // Planet(s) below, this batch has a FIXED required size (loanHexesNeeded), not a
    // player-chosen one, so Board.svelte's own toggling here is purely about picking WHICH
    // Outposts pay for it, never how many - see forcedShipPurchaseHexIds' own comment.
    forcedShipPurchaseHexIds: string[] = $state([])

    toggleForcedShipPurchaseHex(hexId: string) {
        this.forcedShipPurchaseHexIds = this.forcedShipPurchaseHexIds.includes(hexId)
            ? this.forcedShipPurchaseHexIds.filter((id) => id !== hexId)
            : [...this.forcedShipPurchaseHexIds, hexId]
    }

    cancelForcedShipPurchase() {
        this.forcedShipPurchaseHexIds = []
        this.boardActionMode = undefined
    }

    async forcedShipPurchase(hexIds: string[] = []) {
        if (!this.validActionTypes.includes(ActionType.ForcedShipPurchase)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(ForcedShipPurchase, { hexIds })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        } finally {
            this.forcedShipPurchaseHexIds = []
            this.boardActionMode = undefined
        }
    }

    async declineOrderShips() {
        if (!this.validActionTypes.includes(ActionType.DeclineOrderShips)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeclineOrderShips, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Boardroom Battle (Investor Round step 2): the current voter places any number of their
    // remaining boardroomVotes on one Corporation in a single action - see
    // actions/placeBoardroomVote.ts. There's no "add more later" on the engine side (this one
    // call both spends the Votes and immediately advances to the next voter), so
    // BoardroomBattlePanel.svelte builds up `amount` entirely client-side (repeated clicks) and
    // only calls this once, when the voter confirms.
    async placeBoardroomVote(corporationId: CorporationId, amount: number) {
        if (!this.validActionTypes.includes(ActionType.PlaceBoardroomVote)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(PlaceBoardroomVote, { corporationId, amount })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async declineBoardroomVote() {
        if (!this.validActionTypes.includes(ActionType.DeclineBoardroomVote)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeclineBoardroomVote, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Boardroom Battle's tie-break sub-step - only reachable when the vote itself ends in a tie
    // (state.boardroomBattleTiedCorporationIds has more than one entry - see
    // actions/chooseBoardroomBattleCorporation.ts) and only the Director may call this, choosing
    // among just those tied Corporations.
    async chooseBoardroomBattleCorporation(corporationId: CorporationId) {
        if (!this.validActionTypes.includes(ActionType.ChooseBoardroomBattleCorporation)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(ChooseBoardroomBattleCorporation, {
                corporationId
            })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Investor Shenanigans (rulebook page 19) - see InvestorActionPanel.svelte /
    // AlienTechActionPanel.svelte. Black Market and both Passes take no extra payload; the rest
    // need a target Corporation (and sometimes an amount/Ship level) the panel gathers first.
    // Jerry-Rig, Private Contractor and Develop Planets need a hex pick on the board itself
    // (like Expand Network/Create Wormhole) and aren't wired up yet - they still go through
    // submitGenericAction below via the panel's fallback.
    async blackMarket() {
        if (!this.validActionTypes.includes(ActionType.BlackMarket)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(BlackMarket, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async passInvestorAction() {
        if (!this.validActionTypes.includes(ActionType.PassInvestorAction)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(PassInvestorAction, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async insuranceFraud(corporationId: CorporationId, shipLevel: number) {
        if (!this.validActionTypes.includes(ActionType.InsuranceFraud)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(InsuranceFraud, { corporationId, shipLevel })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async launder(amount: number) {
        if (!this.validActionTypes.includes(ActionType.Launder)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(Launder, { amount })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async cargoBoost(corporationId: CorporationId, amount: number) {
        if (!this.validActionTypes.includes(ActionType.CargoBoost)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(CargoBoost, { corporationId, amount })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async researchWormhole(corporationId: CorporationId) {
        if (!this.validActionTypes.includes(ActionType.ResearchWormhole)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(ResearchWormhole, { corporationId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Leaked Research (Corporate Power Glossary, page 29): a free Research Wormhole for this
    // Corporation's President specifically, available "Anytime" alongside this Corporation's
    // own turn in the Corporation Round (Expand Network/Wormhole, Order Ships, Issue Share
    // before the auction opens) or during this President's own Alien Tech Action in Investor
    // Shenanigans - see actions/leakedResearch.ts's isLeakedResearchWindow. Unlike the ordinary
    // researchWormhole above, there's exactly one eligible Corporation (this player's own
    // presided Corporation still holding the power), so every panel that offers this passes
    // that Corporation's id straight through rather than opening a picker.
    async leakedResearch(corporationId: CorporationId) {
        if (!this.validActionTypes.includes(ActionType.LeakedResearch)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(LeakedResearch, { corporationId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Alien Engineering (Corporate Power Glossary, page 29): reclaims some or all of a
    // Corporation's spent Alien Technology Cubes back to the President as a free action -
    // cargoBoostCubesToReclaim undoes Cargo Boost 1-for-1 (0-2), reclaimWormhole gives up
    // Wormhole Technology entirely for its single cube. Offered during BOTH halves of this
    // player's Investor Shenanigans turn - see actions/alienEngineering.ts,
    // stateHandlers/investorAction.ts and stateHandlers/alienTechAction.ts - so both
    // InvestorActionPanel.svelte and AlienTechActionPanel.svelte embed the same
    // AlienEngineeringPanel.svelte to offer it.
    async alienEngineering(
        corporationId: CorporationId,
        cargoBoostCubesToReclaim: number,
        reclaimWormhole: boolean
    ) {
        if (!this.validActionTypes.includes(ActionType.AlienEngineering)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(AlienEngineering, {
                corporationId,
                cargoBoostCubesToReclaim,
                reclaimWormhole
            })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async passAlienTechAction() {
        if (!this.validActionTypes.includes(ActionType.PassAlienTechAction)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(PassAlienTechAction, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Jerry-Rig: a single free Outpost, submitted the moment a hex is clicked on the map (see
    // Board.svelte) - always clears investorBuildCorporationId right after, one-shot or not.
    async jerryRig(corporationId: CorporationId, hexId: string) {
        if (!this.validActionTypes.includes(ActionType.JerryRig)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(JerryRig, { corporationId, hexId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        } finally {
            this.investorBuildCorporationId = undefined
        }
    }

    // Private Contractor: like Expand Network, builds one Outpost per call and can keep going
    // (up to 5) across further calls - see finishExpansion below to stop. Does NOT clear
    // investorBuildCorporationId - gameState.expandingCorporationId takes over as the build's
    // source of truth from here (see the field's own comment above).
    async privateContractor(corporationId: CorporationId, hexId: string) {
        if (!this.validActionTypes.includes(ActionType.PrivateContractor)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(PrivateContractor, { corporationId, hexId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Stops an in-progress Private Contractor build (this Investor Action's equivalent of
    // declineExpandNetworkOrWormhole) - see InvestorActionPanel.svelte's "Stop Building".
    async finishExpansion() {
        if (!this.validActionTypes.includes(ActionType.FinishExpansion)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(FinishExpansion, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        } finally {
            this.investorBuildCorporationId = undefined
        }
    }

    toggleDevelopPlanetsHex(hexId: string) {
        this.developPlanetsHexIds = this.developPlanetsHexIds.includes(hexId)
            ? this.developPlanetsHexIds.filter((id) => id !== hexId)
            : [...this.developPlanetsHexIds, hexId]
    }

    cancelDevelopPlanets() {
        this.developPlanetsHexIds = []
        this.boardActionMode = undefined
    }

    async developPlanets() {
        if (!this.validActionTypes.includes(ActionType.DevelopPlanets)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DevelopPlanets, {
                hexIds: this.developPlanetsHexIds
            })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        } finally {
            this.developPlanetsHexIds = []
            this.boardActionMode = undefined
        }
    }

    // Sign The Agreement (rulebook page 22) - see OfferSignTheAgreementPanel.svelte. The hex is
    // never a player choice here (unlike Expand Network's board clicks): state.signTheAgreementHexId
    // already names the one Alien Planet hex that triggered this offer, so the panel's "Sign the
    // Agreement" button just replays it back.
    async signTheAgreement() {
        const hexId = this.gameState.signTheAgreementHexId
        if (!this.validActionTypes.includes(ActionType.SignTheAgreement) || !hexId) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(SignTheAgreement, { hexId })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async declineSignTheAgreement() {
        if (!this.validActionTypes.includes(ActionType.DeclineSignTheAgreement)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeclineSignTheAgreement, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Backroom Deal (Corporate Power Glossary, page 29) - see BackroomDealPanel.svelte. The
    // President's whole decision is just which direction to move the Alien Mining Capacity (or
    // decline outright) - which Corporation holds the Power, and by how much
    // (BACKROOM_DEAL_MINING_CAPACITY_DELTA), are never a player choice, so neither is passed
    // here.
    async backroomDeal(direction: BackroomDealDirection) {
        if (!this.validActionTypes.includes(ActionType.BackroomDeal)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(BackroomDeal, { direction })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async declineBackroomDeal() {
        if (!this.validActionTypes.includes(ActionType.DeclineBackroomDeal)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(DeclineBackroomDeal, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // Secret Agents' Mining Capacity choice (Amethyst Agency's own Formation Power) - see
    // OfferSecretAgentsChoicePanel.svelte. Neither option takes a payload: the hex/corporation
    // are already pinned by state.secretAgentsCorporationId/secretAgentsHexId.
    async increaseAlienMiningCapacity() {
        if (!this.validActionTypes.includes(ActionType.IncreaseAlienMiningCapacity)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(IncreaseAlienMiningCapacity, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async increaseAmethystMiningCapacity() {
        if (!this.validActionTypes.includes(ActionType.IncreaseAmethystMiningCapacity)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(IncreaseAmethystMiningCapacity, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    taxLoanHexIds: string[] = $state([])

    toggleTaxLoanHex(hexId: string) {
        this.taxLoanHexIds = this.taxLoanHexIds.includes(hexId)
            ? this.taxLoanHexIds.filter((id) => id !== hexId)
            : [...this.taxLoanHexIds, hexId]
    }

    async payTax(hexIds: string[]) {
        const corporationId = this.gameState.taxPayerCorporationIds?.[0]
        if (!corporationId || !this.validActionTypes.includes(ActionType.PayTax)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(PayTax, { corporationId, hexIds })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        } finally {
            this.taxLoanHexIds = []
        }
    }

    async taxAgentsForceTax() {
        if (!this.validActionTypes.includes(ActionType.TaxAgentsForceTax)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(TaxAgentsForceTax, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async taxAgentsTakeFromTaxBox() {
        if (!this.validActionTypes.includes(ActionType.TaxAgentsTakeFromTaxBox)) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(TaxAgentsTakeFromTaxBox, {})
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async submitGenericAction(actionType: ActionType, payload: Record<string, unknown>) {
        const schema =
            StellarVenturesApiActions[actionType as keyof typeof StellarVenturesApiActions]
        if (!schema) {
            this.lastActionError = `No schema registered for action type ${actionType}`
            return
        }

        this.lastActionError = undefined
        try {
            const action = this.createPlayerAction(schema, payload)
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }
    // TESTING ONLY - lets the co-designer manually re-test Backroom Deal/Liquidation (trying
    // Apply, then rewinding to also try Decline, etc.) without replaying a whole game from
    // scratch, and without depending on Exploration Mode - Explore only lets you try NEW moves
    // forward from wherever you started exploring, it deliberately can't rewrite history from
    // before that (its own undoLimit checkpoint protects everything earlier), so it can't reach
    // back past an already-committed, game-ending decision the way this needs to. Bypasses
    // undoableAction's own normal permission/history rules entirely via GameSession's lower-level
    // undoToTarget - remove this method and its one caller (GameEndPanel.svelte's "Undo
    // Liquidation (testing only)" button) once Backroom Deal/Accounting Gimmick testing is done.
    async testingUndoLiquidation() {
        if (this.gameState.result === undefined) {
            return
        }

        const target =
            [...this.actions]
                .reverse()
                .find(
                    (action) =>
                        action.type === ActionType.BackroomDeal ||
                        action.type === ActionType.DeclineBackroomDeal
                ) ??
            [...this.actions].reverse().find((action) => action.type === ActionType.Liquidate)
        if (!target) {
            return
        }

        this.lastActionError = undefined
        try {
            await this.undoToTarget(target)
            // Stash what was just undone so testingRedoLiquidation can resubmit the same
            // decision - see that method and testingLiquidationRedoAction's own comment. A bare
            // Liquidate (nobody ever held/could use Backroom Deal) has no player-submittable
            // equivalent, so there's nothing to offer a Redo for in that case.
            this.testingLiquidationRedoAction =
                target.type === ActionType.BackroomDeal ||
                target.type === ActionType.DeclineBackroomDeal
                    ? structuredClone($state.snapshot(target))
                    : undefined
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    // TESTING ONLY - see testingUndoLiquidation above and Header.svelte's "Redo Liquidation
    // (testing only)" button. Rather than replaying the raw stashed action (which carries a now-
    // stale id/index/checksum from before the undo), this resubmits the same decision fresh
    // through the normal Backroom Deal/Decline Backroom Deal methods below - onAction's existing
    // "loop back to Liquidation" handling then re-queues the automatic Liquidate System action
    // exactly as it did the first time, landing back at the same EndOfGame outcome. Remove
    // alongside testingUndoLiquidation/testingLiquidationRedoAction once Backroom Deal/Accounting
    // Gimmick testing is done.
    async testingRedoLiquidation() {
        const target = this.testingLiquidationRedoAction
        if (!target) {
            return
        }

        this.testingLiquidationRedoAction = undefined
        if (target.type === ActionType.BackroomDeal) {
            await this.backroomDeal((target as BackroomDeal).direction)
        } else if (target.type === ActionType.DeclineBackroomDeal) {
            await this.declineBackroomDeal()
        }
    }

    // TESTING ONLY - covers the one testingUndoLiquidation() case testingRedoLiquidation can't:
    // undoing a bare, automatic Liquidate that had no Backroom Deal decision before it (nobody
    // ever held/could use Backroom Deal) leaves the game sitting in Liquidation with
    // activePlayerIds cleared and nothing offered to anyone - a state that, in normal play, only
    // ever exists for an instant inside a single action-processing pass (LiquidationStateHandler
    // .enter() queues the automatic Liquidate System action in that very same pass - see that
    // handler's own comment), so nothing ever calls enter() again to re-queue it once a
    // patch-based undo freezes the game there. There's no player decision to resubmit in this
    // case (unlike testingRedoLiquidation above), so this reaches further: Liquidate has no
    // playerId of its own - it's a System action (see actions/liquidate.ts) - and the engine's
    // own isPlayerAllowed (@tabletop/common's GameEngine) lets any action through when it has no
    // playerId, regardless of activePlayerIds. Submitting one directly here, bypassing
    // createPlayerAction's usual playerId stamp, uses that exact same trapdoor rather than
    // working around it - it's how System actions already work, not a special exception carved
    // out for testing. Remove this method (and stuckInLiquidation/its "Force Liquidate (testing
    // only)" button on Header.svelte) once Backroom Deal/Accounting Gimmick testing is done.
    get stuckInLiquidation(): boolean {
        return (
            this.gameState.machineState === MachineState.Liquidation &&
            this.gameState.result === undefined &&
            this.activePlayers.length === 0 &&
            this.validActionTypes.length === 0
        )
    }

    async testingForceLiquidate() {
        if (!this.stuckInLiquidation) {
            return
        }

        this.lastActionError = undefined
        try {
            const action = createAction(Liquidate, {
                id: crypto.randomUUID(),
                gameId: this.game.id,
                source: ActionSource.User,
                createdAt: new Date()
            })
            await this.applyAction(action)
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }
}
