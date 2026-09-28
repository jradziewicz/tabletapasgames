<script lang="ts">
    import {
        ActionType,
        MachineState,
        pendingPayDividendsPower,
        finePrintCorporation
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import InitialAuctionPanel from './InitialAuctionPanel.svelte'
    import DraftPowerPanel from './DraftPowerPanel.svelte'
    import ShareAuctionPanel from './ShareAuctionPanel.svelte'
    import ExpandNetworkPanel from './ExpandNetworkPanel.svelte'
    import OrderShipPanel from './OrderShipPanel.svelte'
    import BoardroomBattlePanel from './BoardroomBattlePanel.svelte'
    import InvestorActionPanel from './InvestorActionPanel.svelte'
    import AlienTechActionPanel from './AlienTechActionPanel.svelte'
    import OfferSignTheAgreementPanel from './OfferSignTheAgreementPanel.svelte'
    import OfferSecretAgentsChoicePanel from './OfferSecretAgentsChoicePanel.svelte'
    import OfferTaxAgentsChoicePanel from './OfferTaxAgentsChoicePanel.svelte'
    import PayTaxesPanel from './PayTaxesPanel.svelte'
    import ChooseAmethystHomePlanetPanel from './ChooseAmethystHomePlanetPanel.svelte'
    import BackroomDealPanel from './BackroomDealPanel.svelte'
    import DeepSpaceSmugglingPanel from './DeepSpaceSmugglingPanel.svelte'
    import DeepSpacePiratesPanel from './DeepSpacePiratesPanel.svelte'
    import FinePrintPanel from './FinePrintPanel.svelte'
    import SparePartsPanel from './SparePartsPanel.svelte'

    const gameSession = getGameSession()

    let chosenActionType: ActionType | undefined = $state()
    let payloadText = $state('{}')
    let parseError: string | undefined = $state()

    // A chosen-but-not-yet-submitted generic action (see the fallback UI at the bottom of this
    // file) is only ever meaningful for the machineState it was picked under. If that state
    // changes out from under it - most notably Undo jumping back to an earlier phase, but also
    // just as easily another player's own action moving things forward - the choice (and its
    // half-typed JSON payload) no longer applies to anything real. Without this, clicking Undo
    // while mid-way through that raw JSON entry form left it stuck on screen showing that same
    // now-stale action instead of the plain button list (or a phase's own bespoke panel) Undo
    // actually returned to.
    let lastMachineState: MachineState | undefined = $state(undefined)
    $effect(() => {
        const current = gameSession.gameState.machineState
        if (lastMachineState !== undefined && lastMachineState !== current && chosenActionType) {
            chosenActionType = undefined
            payloadText = '{}'
            parseError = undefined
        }
        lastMachineState = current
    })

    const canAct = $derived(
        gameSession.isMyTurn && !gameSession.busy && !gameSession.isViewingHistory
    )
    // Every winning President drafts a second Corporate Power immediately after their auction
    // resolves (rulebook page 11, step 4) - stateHandlers/initialAuction.ts detours the machine
    // into MachineState.DraftPower for that, same state Sign The Agreement reuses much later in
    // the game for its own one-off draft. Only the Initial Auction's own draft resumes back into
    // InitialAuction (the next Corporation) or IssueShare (once all five are done) - Sign The
    // Agreement always resumes elsewhere (PayDividends, AlienTechAction) - so that resume target
    // is what tells the two apart. Per the co-designer, the Initial Auction's draft step should
    // stay on the same auction screen rather than swap to a different one, so InitialAuctionPanel
    // renders it directly instead of a separate hand-off here.
    const isInitialAuctionDraftPower = $derived(
        gameSession.gameState.machineState === MachineState.DraftPower &&
            !!gameSession.gameState.draftPowerCorporationId &&
            (gameSession.gameState.draftPowerResumeState === MachineState.InitialAuction ||
                gameSession.gameState.draftPowerResumeState === MachineState.IssueShare)
    )
    const isInitialAuction = $derived(
        (gameSession.gameState.machineState === MachineState.InitialAuction &&
            !!gameSession.gameState.activeInitialAuction) ||
            isInitialAuctionDraftPower
    )
    const isDraftPower = $derived(
        gameSession.gameState.machineState === MachineState.DraftPower &&
            !!gameSession.gameState.draftPowerCorporationId &&
            !isInitialAuctionDraftPower
    )
    // ShareAuctionPanel doubles as the forced auction that follows a resolved Boardroom Battle
    // (same activeShareAuction/PlaceShareBid/PassShareBid machinery - see that panel's own
    // comment) - both routed here rather than just the plain Issue Share step.
    const isIssueShare = $derived(
        (gameSession.gameState.machineState === MachineState.IssueShare &&
            !!gameSession.gameState.activeCorporationId) ||
            (gameSession.gameState.machineState === MachineState.BoardroomBattle &&
                !!gameSession.gameState.activeShareAuction) ||
            (gameSession.gameState.machineState === MachineState.FormAmethystAgency &&
                !!gameSession.gameState.activeShareAuction)
    )
    // Form Amethyst Agency's other sub-phase (stateHandlers/formAmethystAgency.ts): once its
    // Formation Auction (handled above by ShareAuctionPanel, same as isIssueShare) resolves,
    // activeShareAuction clears and the winning President still needs to choose a Home Planet -
    // see ChooseAmethystHomePlanetPanel.svelte / Board.svelte's own board action mode for that.
    const isChooseAmethystHomePlanet = $derived(
        gameSession.gameState.machineState === MachineState.FormAmethystAgency &&
            !gameSession.gameState.activeShareAuction
    )
    const isExpandNetworkOrWormhole = $derived(
        gameSession.gameState.machineState === MachineState.ExpandNetworkOrWormhole &&
            !!gameSession.gameState.activeCorporationId
    )
    const isOrderShips = $derived(
        gameSession.gameState.machineState === MachineState.OrderShips &&
            !!gameSession.gameState.activeCorporationId
    )
    // The plain per-player voting step and the tie-break choice both get this same bespoke
    // panel (BoardroomBattlePanel switches its own click behavior between the two - see there).
    // The forced Share auction that follows a resolved Battle (activeShareAuction set) is
    // excluded here and picked up by isIssueShare above instead, same as Fine Print's own
    // one-time offer at the very start of the Battle, which now gets its own panel below
    // (isFinePrintOffer/FinePrintPanel.svelte) rather than falling through to the generic UI.
    const isBoardroomBattleVote = $derived(
        gameSession.gameState.machineState === MachineState.BoardroomBattle &&
            !gameSession.gameState.activeShareAuction &&
            (!!gameSession.gameState.boardroomBattleCurrentVoterId ||
                (gameSession.gameState.boardroomBattleTiedCorporationIds?.length ?? 0) > 1)
    )

    // Fine Print (Corporate Power Glossary, page 29) - the one genuine player decision at the
    // very start of a fresh Boardroom Battle, before voting order is even set up - see
    // FinePrintPanel.svelte / stateHandlers/boardroomBattle.ts's own
    // finePrintOfferResolved-gated validActionsForPlayer. Same "outside the normal turn order,
    // visible to everyone but only actionable for that one President" treatment as Backroom
    // Deal/Deep Space Smuggling above.
    const isFinePrintOffer = $derived(
        gameSession.gameState.machineState === MachineState.BoardroomBattle &&
            !gameSession.gameState.finePrintOfferResolved &&
            !!finePrintCorporation(gameSession.gameState)
    )
    // Investor Shenanigans (rulebook page 19) - see InvestorActionPanel.svelte /
    // AlienTechActionPanel.svelte. Routed on machine state + a current actor being set, same as
    // the other bespoke panels above (visible to everyone, not just the acting player).
    const isInvestorAction = $derived(
        gameSession.gameState.machineState === MachineState.InvestorAction &&
            !!gameSession.gameState.investorShenanigansCurrentPlayerId
    )
    const isAlienTechAction = $derived(
        gameSession.gameState.machineState === MachineState.AlienTechAction &&
            !!gameSession.gameState.investorShenanigansCurrentPlayerId
    )

    // Sign The Agreement (rulebook page 22) - offered outside the normal turn order (the
    // Corporation's President, not necessarily whoever's turn it otherwise is - see
    // OfferSignTheAgreementPanel.svelte / stateHandlers/offerSignTheAgreement.ts).
    const isOfferSignTheAgreement = $derived(
        gameSession.gameState.machineState === MachineState.OfferSignTheAgreement &&
            !!gameSession.gameState.signTheAgreementCorporationId
    )

    // Secret Agents' Mining Capacity choice (Amethyst Agency's own Formation Power) - same
    // "outside the normal turn order" treatment as Sign The Agreement above - see
    // OfferSecretAgentsChoicePanel.svelte / stateHandlers/offerSecretAgentsChoice.ts.
    const isOfferSecretAgentsChoice = $derived(
        gameSession.gameState.machineState === MachineState.OfferSecretAgentsChoice &&
            !!gameSession.gameState.secretAgentsCorporationId
    )

    const isOfferTaxAgentsChoice = $derived(
        gameSession.gameState.machineState === MachineState.OfferTaxAgentsChoice &&
            !!gameSession.gameState.taxAgentsCorporationId
    )

    const isPayTaxes = $derived(
        gameSession.gameState.machineState === MachineState.PayTaxes &&
            !!gameSession.gameState.taxPayerCorporationIds?.length
    )

    // Backroom Deal (Corporate Power Glossary, page 29) - the one genuine player decision inside
    // Liquidation, offered once to whichever Corporation's President holds it, before the
    // automatic Hostile Takeover / Share Liquidation runs - see BackroomDealPanel.svelte /
    // stateHandlers/liquidation.ts. Same "outside the normal turn order, visible to everyone but
    // only actionable for that President" treatment as Sign The Agreement / Secret Agents above.
    // Unlike those two, resolving it (used or declined) loops straight back into this same
    // MachineState.Liquidation rather than moving on, so no separate reveal-pacing field is
    // needed here.
    const isBackroomDealOffer = $derived(
        gameSession.gameState.machineState === MachineState.Liquidation &&
            !gameSession.gameState.backroomDealResolved
    )

    // Deep Space Smuggling (Corporate Power Glossary, page 29) - the one genuine player decision
    // inside Pay Dividends, offered once to whichever Corporation's President holds it, before
    // the automatic payout runs - see DeepSpaceSmugglingPanel.svelte / stateHandlers/
    // payDividends.ts / operations/corporatePowers.ts's own pendingPayDividendsPower (reused
    // directly here rather than re-derived from validActionTypes, since Smuggling and Pirates
    // can otherwise be ambiguous to tell apart purely from which action types happen to be
    // valid, e.g. when neither has a legal target and only DeclinePayDividendsPower is offered).
    const isDeepSpaceSmugglingOffer = $derived(
        gameSession.gameState.machineState === MachineState.PayDividends &&
            pendingPayDividendsPower(gameSession.gameState) === 'smuggling'
    )

    // Deep Space Pirates (Corporate Power Glossary, page 29) - the Mining Capacity counterpart
    // of Deep Space Smuggling just above (same offer point, same one-at-a-time guarantee via
    // pendingPayDividendsPower - see DeepSpacePiratesPanel.svelte).
    const isDeepSpacePiratesOffer = $derived(
        gameSession.gameState.machineState === MachineState.PayDividends &&
            pendingPayDividendsPower(gameSession.gameState) === 'pirates'
    )

    // Spare Parts (Corporate Power Glossary, page 29) - offered the instant a qualifying Scrap
    // happens ("Anytime", so this can interrupt whatever other machineState was active - see
    // pendingSparePartsResumeState), to the President of whichever Corporation holds it. Same
    // "outside the normal turn order, visible to everyone but only actionable for that
    // President" treatment as Sign The Agreement/Secret Agents/Fine Print above - see
    // SparePartsPanel.svelte.
    const isOfferSpareParts = $derived(
        gameSession.gameState.machineState === MachineState.OfferSpareParts &&
            !!gameSession.gameState.pendingSparePartsCorporationId
    )

    function chooseAction(actionType: string) {
        chosenActionType = actionType as ActionType
        payloadText = '{}'
        parseError = undefined
    }

    function cancel() {
        chosenActionType = undefined
        parseError = undefined
    }

    async function submit() {
        if (!chosenActionType) {
            return
        }

        let payload: Record<string, unknown>
        try {
            payload = JSON.parse(payloadText || '{}')
        } catch {
            parseError = 'Payload must be valid JSON'
            return
        }

        parseError = undefined
        const actionType = chosenActionType
        chosenActionType = undefined
        await gameSession.submitGenericAction(actionType, payload)
    }
</script>

<!--
    ActionPanel routes each machine state to its own bespoke UI as one gets built (so far the
    Initial Auction, Draft Power, and Issue Share - see InitialAuctionPanel.svelte,
    DraftPowerPanel.svelte, ShareAuctionPanel.svelte) and falls back to a generic
    pick-the-action-type-then-hand-type-JSON UI otherwise (see the game's task list - "Build
    minimal playable UI"). That generic path stays around for every phase that hasn't gotten
    its own bespoke UI yet.
-->
{#if gameSession.secretAgentsReveal}
    <!-- Same "stay put through the reveal" treatment as signTheAgreementReveal just below, for
         Secret Agents' own "Increase Alien" tile-flip - see session.svelte.ts's
         secretAgentsReveal comment. -->
    <OfferSecretAgentsChoicePanel />
{:else if gameSession.signTheAgreementReveal}
    <!-- Highest priority, ahead of every machineState-driven branch below: once a Corporation
         has Signed The Agreement, the real machineState has already moved on (to DraftPower,
         see session.svelte.ts's signTheAgreementReveal comment) even though the deciding player
         hasn't finished watching the local reveal yet. Stay on OfferSignTheAgreementPanel until
         it clears that field itself, then fall through to whichever branch below now matches. -->
    <OfferSignTheAgreementPanel />
{:else if isInitialAuction}
    <InitialAuctionPanel />
{:else if isDraftPower}
    <DraftPowerPanel />
{:else if isIssueShare}
    <ShareAuctionPanel />
{:else if isChooseAmethystHomePlanet}
    <ChooseAmethystHomePlanetPanel />
{:else if isExpandNetworkOrWormhole}
    <ExpandNetworkPanel />
{:else if isOrderShips}
    <OrderShipPanel />
{:else if isFinePrintOffer}
    <FinePrintPanel />
{:else if isBoardroomBattleVote}
    <BoardroomBattlePanel />
{:else if isInvestorAction}
    <InvestorActionPanel />
{:else if isAlienTechAction}
    <AlienTechActionPanel />
{:else if isOfferSignTheAgreement}
    <OfferSignTheAgreementPanel />
{:else if isOfferSecretAgentsChoice}
    <OfferSecretAgentsChoicePanel />
{:else if isOfferTaxAgentsChoice}
    <OfferTaxAgentsChoicePanel />
{:else if isPayTaxes}
    <PayTaxesPanel />
{:else if isBackroomDealOffer}
    <BackroomDealPanel />
{:else if isDeepSpaceSmugglingOffer}
    <DeepSpaceSmugglingPanel />
{:else if isDeepSpacePiratesOffer}
    <DeepSpacePiratesPanel />
{:else if isOfferSpareParts}
    <SparePartsPanel />
{:else}
    <div class="px-4 py-2 text-[#e6e9f5]">
        {#if !canAct}
            <div class="text-xs text-[#7f88ad]">
                {gameSession.isViewingHistory ? 'Viewing history' : 'Waiting for other players...'}
            </div>
        {:else if !chosenActionType}
            <div class="flex flex-wrap gap-1.5">
                {#each gameSession.validActionTypes as actionType (actionType)}
                    <button
                        type="button"
                        onclick={() => chooseAction(actionType)}
                        class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2 py-1 text-xs hover:bg-[#262c4d]"
                    >
                        {actionType}
                    </button>
                {/each}
                {#if gameSession.validActionTypes.length === 0}
                    <div class="text-xs text-[#7f88ad]">No valid actions right now.</div>
                {/if}
            </div>
        {:else}
            <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                    <span class="font-semibold">{chosenActionType}</span>
                    <button type="button" onclick={cancel} class="text-[#7f88ad] hover:text-white">
                        cancel
                    </button>
                </div>
                <textarea
                    bind:value={payloadText}
                    rows="3"
                    spellcheck="false"
                    class="w-full rounded-md border border-[#3a4166] bg-[#10142a] px-2 py-1 font-mono text-xs text-[#e6e9f5]"
                ></textarea>
                {#if parseError}
                    <div class="text-xs text-[#e0343a]">{parseError}</div>
                {/if}
                <button
                    type="button"
                    onclick={submit}
                    class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa]"
                >
                    Submit
                </button>
            </div>
        {/if}

        {#if gameSession.lastActionError}
            <div class="mt-1.5 text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
        {/if}
    </div>
{/if}
