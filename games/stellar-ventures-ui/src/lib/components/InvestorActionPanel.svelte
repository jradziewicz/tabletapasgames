<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionType,
        InvestorActionId,
        CorporatePowerId,
        ExpandNetworkOutpostCosts,
        effectiveMiningCapacityForCorporation,
        hasAnyValidExpansionTarget,
        dividendPayoutPerShare,
        type CorporationId
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationDisplayNames,
        CorporationLogoIcons,
        CorporationLogoAspect,
        CHARTER_ASPECT
    } from '$lib/utils/corporationDisplay.js'
    import { InvestorActionDiscIcons } from '$lib/utils/investorDisplay.js'
    import { PlayerVoteTokenIcons } from '$lib/utils/playerSymbolDisplay.js'
    import investorActionRow from '$lib/images/investor/investorActionRow.png'
    import CorporationInfoBox from './CorporationInfoBox.svelte'
    import CorporationCharter from './CorporationCharter.svelte'
    import CreditsIcon from './CreditsIcon.svelte'
    import OutpostIcon from './OutpostIcon.svelte'
    import AlienEngineeringPanel from './AlienEngineeringPanel.svelte'

    const gameSession = getGameSession()

    // Investor Shenanigans (rulebook page 19), Investor Action half - the co-designer's own
    // player-mats art (SV_PLAYER_MATS_AW_06_V1.pdf page 1) stands in for the board's own printed
    // row here so this panel isn't just the whole Investor Board squeezed into the sidebar.
    // Visible to everyone once it's anyone's Investor Action (not gated to "my turn" - same as
    // ShareAuctionPanel/BoardroomBattlePanel showing a "waiting on X" state to onlookers); only
    // the acting player gets clickable circles. The Action Disc shown here is the SAME
    // playerState.lastInvestorActionId this player's Investor Board tab reads (InvestorBoard.svelte)
    // - selecting an action here moves it there too, automatically, since both just render
    // whatever that one field currently says.
    const currentPlayerId = $derived(gameSession.gameState.investorShenanigansCurrentPlayerId)
    const currentPlayerState = $derived(
        currentPlayerId
            ? gameSession.gameState.players.find((p) => p.playerId === currentPlayerId)
            : undefined
    )
    const myTurn = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === currentPlayerId)
    const canAct = $derived(myTurn && !gameSession.busy && !gameSession.isViewingHistory)
    // Same one marker per player as the Investor Board tab (InvestorBoard.svelte) and
    // AlienTechActionPanel - matched to their Color, not a fixed image.
    const discIcon = $derived(
        currentPlayerId ? InvestorActionDiscIcons[gameSession.colors.getPlayerColor(currentPlayerId)] : undefined
    )

    // Circle centers measured directly off the row art itself (connected-components on its own
    // dark-circle fill color, same [112,118,123] as the board) - left-to-right as printed:
    // Private Contractor, Jerry-Rig, Insurance Fraud, Black Market. `wired` = has a working click
    // handler below.
    const CIRCLES: {
        discId: InvestorActionId
        actionType: ActionType
        left: number
        label: string
        wired: boolean
    }[] = [
        {
            discId: InvestorActionId.PrivateContractor,
            actionType: ActionType.PrivateContractor,
            left: 17.26,
            label: 'Private Contractor',
            wired: true
        },
        {
            discId: InvestorActionId.JerryRig,
            actionType: ActionType.JerryRig,
            left: 41.72,
            label: 'Jerry-Rig',
            wired: true
        },
        {
            discId: InvestorActionId.InsuranceFraud,
            actionType: ActionType.InsuranceFraud,
            left: 66.2,
            label: 'Insurance Fraud',
            wired: true
        },
        {
            discId: InvestorActionId.BlackMarket,
            actionType: ActionType.BlackMarket,
            left: 90.64,
            label: 'Black Market',
            wired: true
        }
    ]
    const CIRCLE_TOP = 57.87
    const CIRCLE_DIAM = 72.85 // measured off the row art's own printed circles (connected-components on their [112,118,123] fill), as % of the row's own height

    // The row art is much wider than it is tall, so a button sized to the SAME percentage
    // of both width and height renders as an oval, not a circle - convert CIRCLE_DIAM's
    // height percentage into the width percentage that covers the same number of actual
    // pixels, given the row's own aspect ratio, so the click target (and its ring) is a
    // true circle sitting exactly over the printed one.
    const ROW_ASPECT = 7140 / 1035
    const CIRCLE_WIDTH_PCT = CIRCLE_DIAM / ROW_ASPECT

    // Insurance Fraud needs a target Corporation (where this player is President) with at
    // least one Delivered Ship - the specific Ship to scrap is now picked straight off that
    // Corporation's own Charter (see the picker markup below), the same way Order Ships shows
    // one, rather than from a separate list of buttons.
    const insuranceFraudCorporations = $derived.by(() => {
        if (!currentPlayerId) return []
        return gameSession.gameState.corporations.filter(
            (c) =>
                c.active &&
                c.getPresidentPlayerId() === currentPlayerId &&
                c.deliveredShipLevels.length > 0
        )
    })

    // Only meaningful when the President of more than one eligible Corporation at once - which
    // Corporation's Charter is currently showing for the Delivered Ship pick.
    let insuranceFraudCorporationId: CorporationId | undefined = $state()

    // Jerry-Rig / Private Contractor share the same "which Corporation" eligibility check the
    // backend uses to decide whether to even offer them (canOfferJerryRig/canOfferPrivateContractor
    // in actions/jerryRig.ts and privateContractor.ts): a Share in the Corporation, plus at least
    // one legal Outpost hex available right now.
    const buildEligibleCorporations = $derived.by(() => {
        if (!currentPlayerId) return []
        const board = gameSession.gameState.board
        return gameSession.gameState.corporations.filter(
            (c) =>
                c.active &&
                c.shareCountForPlayer(currentPlayerId) > 0 &&
                hasAnyValidExpansionTarget(
                    board,
                    c.id,
                    c.canBuildOnAlienPlanets(),
                    c.hasActivePower(CorporatePowerId.IcarusExperiment),
                    c.hasActivePower(CorporatePowerId.CloakingDevices)
                )
        )
    })

    // True once a Private Contractor build is actually underway server-side and belongs to this
    // player - gameState.expandingCorporationId is the authoritative source here (see
    // session.svelte.ts's investorBuildCorporationId doc comment).
    const privateContractorInProgress = $derived(
        gameSession.gameState.expandingCorporationId !== undefined &&
            gameSession.gameState.expandingKind === ActionType.PrivateContractor &&
            gameSession.gameState.expandingBuilderId === currentPlayerId
    )
    // True the moment a Corporation's been picked (either action) but no hex has been clicked on
    // the map yet - nothing exists server-side until that first click, so
    // session.svelte.ts's investorBuildCorporationId is the only signal for this window.
    const awaitingFirstHexClick = $derived(
        gameSession.investorBuildCorporationId !== undefined &&
            gameSession.gameState.expandingCorporationId === undefined
    )
    const buildInProgress = $derived(awaitingFirstHexClick || privateContractorInProgress)
    const buildingCorporationId = $derived(
        gameSession.gameState.expandingCorporationId ?? gameSession.investorBuildCorporationId
    )
    const builtCount = $derived(gameSession.gameState.expandingHexIds?.length ?? 0)

    // The Corporation being built for, and the same live Mining Capacity / gained-this-
    // action math ExpandNetworkPanel shows - Jerry-Rig and Private Contractor both follow
    // Expand Network rules for what gets built, so the same info box applies to both.
    const buildingCorporation = $derived(
        buildingCorporationId ? gameSession.gameState.getCorporation(buildingCorporationId) : undefined
    )
    const buildLiveMiningCapacity = $derived(
        buildingCorporationId
            ? effectiveMiningCapacityForCorporation(gameSession.gameState, buildingCorporationId)
            : 0
    )
    const buildMiningCapacityGainedThisAction = $derived.by(() => {
        // Jerry-Rig is one-shot (no expandingHexIds tracking) - only Private Contractor's
        // multi-outpost build has a running "gained so far" figure to show.
        const hexIds = privateContractorInProgress ? gameSession.gameState.expandingHexIds : undefined
        if (!hexIds || hexIds.length === 0) return 0
        const board = gameSession.gameState.board
        let total = 0
        for (const hexId of hexIds) {
            const hex = board.requireHex(hexId)
            total += board.miningValueForHex(hex)
        }
        return total
    })
    const buildMiningCapacity = $derived(buildLiveMiningCapacity - buildMiningCapacityGainedThisAction)

    // Current vs. updated Dividend payout per Share, same as ExpandNetworkPanel's own build box
    // (see its comment) - Jerry-Rig/Private Contractor build Outposts under Expand Network's
    // same rules, so Mining Capacity gain previews the same way here.
    const buildCurrentPayout = $derived(
        buildingCorporation
            ? dividendPayoutPerShare(buildingCorporation.cargo, buildMiningCapacity, buildingCorporation.status)
            : 0
    )
    const buildFuturePayout = $derived(
        buildingCorporation
            ? dividendPayoutPerShare(
                  buildingCorporation.cargo,
                  buildMiningCapacity + buildMiningCapacityGainedThisAction,
                  buildingCorporation.status
              )
            : 0
    )

    // Private Contractor is paid by the acting Investor's own Liquid Funds, not the
    // Corporation's Treasury - same lump-sum-by-outpost-count table Expand Network uses, plus
    // the same ₮1-per-other-Corporation placement penalty (unlike Jerry-Rig, which is exempt),
    // just charged to a player instead of a Corporation. expandingPlacementPenalty is real,
    // server-tracked state (see gameState.ts), accumulated the same way Expand Network's is.
    const privateContractorPendingCost = $derived(
        builtCount > 0
            ? (ExpandNetworkOutpostCosts[builtCount] ?? 0) + (gameSession.gameState.expandingPlacementPenalty ?? 0)
            : 0
    )
    const outpostCostTiers = Object.keys(ExpandNetworkOutpostCosts)
        .map(Number)
        .sort((a, b) => a - b)

    // Optimistic "the disc is landing here" override, set the instant a one-shot action is
    // clicked and cleared only once the real submit resolves - so the disc visibly lands on its
    // new spot before ActionPanel swaps this whole panel out for whatever comes next (see
    // clickCircle/chooseInsuranceFraud below).
    let placingDiscId: InvestorActionId | undefined = $state()

    // Once the player has started choosing an Investor Action (a picker is open) or is mid-build
    // (Jerry-Rig/Private Contractor), passing isn't a meaningful option any more - hide it until
    // they back out (re-click the same circle, Cancel, or Undo).
    const actionSelectionInProgress = $derived(gameSession.investorPickerOpen !== undefined || buildInProgress)

    function isOffered(actionType: ActionType) {
        return gameSession.validActionTypes.includes(actionType)
    }

    async function clickCircle(circle: (typeof CIRCLES)[number]) {
        if (!canAct || !isOffered(circle.actionType) || buildInProgress) return

        if (circle.discId === InvestorActionId.BlackMarket) {
            gameSession.investorPickerOpen = undefined
            placingDiscId = InvestorActionId.BlackMarket
            await new Promise((resolve) => setTimeout(resolve, 600))
            try {
                await gameSession.blackMarket()
            } finally {
                placingDiscId = undefined
            }
        } else if (circle.discId === InvestorActionId.InsuranceFraud) {
            insuranceFraudCorporationId = undefined
            gameSession.investorPickerOpen = gameSession.investorPickerOpen === InvestorActionId.InsuranceFraud ? undefined : InvestorActionId.InsuranceFraud
        } else if (circle.discId === InvestorActionId.JerryRig) {
            // Unlike Insurance Fraud, the disc lands here the instant this circle's picker
            // opens - the co-designer wants it visible right away rather than waiting for a
            // Corporation to actually be picked (which Private Contractor mirrors below). Shown
            // via gameSession.investorPickerOpen directly (not a separate placingDiscId) so that
            // Undo - which clears investorPickerOpen through the session's undo() override when
            // nothing's been submitted yet - also puts the disc back where it belongs, instead of
            // leaving a local placingDiscId stuck on this circle.
            gameSession.investorPickerOpen =
                gameSession.investorPickerOpen === InvestorActionId.JerryRig ? undefined : InvestorActionId.JerryRig
        } else if (circle.discId === InvestorActionId.PrivateContractor) {
            gameSession.investorPickerOpen =
                gameSession.investorPickerOpen === InvestorActionId.PrivateContractor
                    ? undefined
                    : InvestorActionId.PrivateContractor
        }
    }

    async function chooseInsuranceFraud(corporationId: CorporationId, shipLevel: number) {
        gameSession.investorPickerOpen = undefined
        placingDiscId = InvestorActionId.InsuranceFraud
        await new Promise((resolve) => setTimeout(resolve, 600))
        try {
            await gameSession.insuranceFraud(corporationId, shipLevel)
        } finally {
            placingDiscId = undefined
        }
    }

    // Picking a Corporation doesn't submit anything by itself - it just tells Board.svelte which
    // Corporation and which action type the next hex click should submit (mirrors how
    // ExpandNetwork/CreateWormhole already share Board.svelte's click handling). The disc is
    // already showing on this circle from the moment its picker opened (see clickCircle above),
    // so there's nothing left to delay here - just clear the picker/placement override and hand
    // off to Board.svelte.
    function startBuild(
        corporationId: CorporationId,
        actionType: ActionType.JerryRig | ActionType.PrivateContractor
    ) {
        gameSession.investorPickerOpen = undefined
        gameSession.investorBuildCorporationId = corporationId
        gameSession.boardActionMode = actionType
    }

    async function stopBuilding() {
        await gameSession.finishExpansion()
    }

    async function pass() {
        await gameSession.passInvestorAction()
    }
</script>

<!-- Fixed min-height, shared with AlienTechActionPanel.svelte's own wrapper below (keep
     these two in sync) - Investor Action and Alien Tech Action are the same player's two
     back-to-back turn segments, so this keeps the panel from visibly resizing either between
     this panel's own sub-states (row art / a picker / an in-progress build) or at the handoff
     to the Alien Tech Action panel that follows it. -->
<div class="min-h-[22rem] space-y-2 px-4 py-2 text-[#e6e9f5]">
    <div class="flex items-center justify-between text-sm">
        <span class="font-semibold">Investor Action</span>
        {#if currentPlayerId}
            <span class="text-[#7f88ad]">
                {#if myTurn}Your turn{:else}Waiting on <PlayerName playerId={currentPlayerId} />...{/if}
            </span>
        {/if}
    </div>

    <!-- The row-art snippet is only for CHOOSING an Investor Action - once one's actually
         picked (an Outpost build under way), it gives way to the same Corporation/Liquid Funds
         info Expand Network shows, since that's what the co-designer wants front and center
         while placing Outposts, not the row art anymore. -->
    {#if !buildInProgress}
        <!-- flex-wrap so the off-board disc / vote-count badges drop to their own row rather
             than getting squeezed - only matters below sm:, where the row art itself goes
             full-width (see next div) and leaves no room beside it on one line. -->
        <div class="flex flex-wrap items-center gap-3">
            <!-- Full-width on mobile - at 34.5% of an already-narrow phone sidebar this row art
                 (and its 4 click circles) rendered as an illegible, barely-tappable sliver; it
                 only needs to shrink back to 34.5% once there's a wide enough action panel
                 (sm:) for that to still read clearly. -->
            <div class="relative w-full shrink-0 overflow-hidden rounded-lg sm:w-[34.5%]" style="aspect-ratio: {7140 / 1035};"> <!-- 25% smaller, then another 20% smaller, then another 25% smaller, then another 33% smaller, then 15% bigger (34.5% of the original full-width row art); overflow-hidden + rounded-lg rounds the row art corners -->
                <img src={investorActionRow} alt="Investor Action" class="absolute inset-0 h-full w-full" />

                {#each CIRCLES as circle (circle.discId)}
                    {@const offered = canAct && isOffered(circle.actionType) && circle.wired && !buildInProgress}
                    <button
                        type="button"
                        disabled={!offered}
                        onclick={() => clickCircle(circle)}
                        aria-label={circle.label}
                        class="absolute rounded-full transition-colors {offered
                            ? 'cursor-pointer ring-2 ring-transparent hover:ring-[#3ddc84]'
                            : 'cursor-default'}"
                        style="left: {circle.left}%; top: {CIRCLE_TOP}%; height: {CIRCLE_DIAM}%; width: {CIRCLE_WIDTH_PCT}%; transform: translate(-50%, -50%);"
                    ></button>

                    <!-- There's only ever ONE physical Action Disc per player (rulebook page 19) - it
                         must MOVE to wherever the player is now choosing, never appear in two
                         places. lastInvestorActionId (its old resting spot from last round) and
                         investorPickerOpen/placingDiscId (the new spot being chosen right now)
                         both independently matched circle.discId before this guard, so opening a
                         DIFFERENT action's picker while the disc still sat on last round's choice
                         rendered the disc twice - once on the old action, once on the new one.
                         Suppress the old-spot render the instant a new choice is in flight. -->
                    {#if ((currentPlayerState?.lastInvestorActionId === circle.discId && gameSession.investorPickerOpen === undefined && placingDiscId === undefined) || gameSession.investorPickerOpen === circle.discId || placingDiscId === circle.discId) && discIcon}
                        <img
                            src={discIcon}
                            alt="Investor Action disc"
                            class="pointer-events-none absolute drop-shadow"
                            style="left: {circle.left}%; top: {CIRCLE_TOP}%; height: {CIRCLE_DIAM * 0.99}%; width: auto; transform: translate(-50%, -50%);"
                        />
                    {/if}
                {/each}
            </div>


            <!-- Off-board resting spot: the disc sits here (not on any action) once a player has
                 passed this round, or before they've taken an action yet this round - to the
                 right of the row art rather than stacked below it, now that the row art is
                 left-justified instead of centered. -->
            {#if currentPlayerState && !currentPlayerState.lastInvestorActionId && !gameSession.investorPickerOpen && !gameSession.investorBuildCorporationId && !placingDiscId && discIcon}
                <div class="flex flex-col items-center gap-1 text-center text-xs text-[#7f88ad]">
                    <img src={discIcon} alt="Investor Action disc (off board)" class="h-10 w-auto opacity-70" />
                </div>
            {/if}

            <!-- How many Boardroom Votes the acting player has left, shown right alongside the
                 row art itself (not buried in the Players panel) since Black Market - one of
                 this very row's own actions - trades Boardroom Votes for Liquid Funds, and
                 Boardroom Battle spends them - both worth seeing at a glance while choosing an
                 Investor Action. currentPlayerVoteTokenIcon falls back to undefined (rendering
                 just the plain number) for a color PlayerVoteTokenIcons has no token art for,
                 same defensive fallback the handshake-token badges use elsewhere. -->
            {#if currentPlayerState}
                {@const currentPlayerVoteTokenIcon = currentPlayerId
                    ? PlayerVoteTokenIcons[gameSession.colors.getPlayerColor(currentPlayerId)]
                    : undefined}
                <div class="flex flex-col items-center gap-1 text-center text-xs text-[#7f88ad]">
                    {#if currentPlayerVoteTokenIcon}
                        <img src={currentPlayerVoteTokenIcon} alt="Boardroom Votes" class="h-8 w-auto drop-shadow" />
                    {/if}
                    <span class="font-mono text-sm font-semibold text-[#e6e9f5]">
                        {currentPlayerState.boardroomVotes}
                    </span>
                </div>
            {/if}
        </div>
    {/if}

    <!-- While placing Outposts (Jerry-Rig's single one, or a Private Contractor build in
         progress), the same Corporation info Expand Network shows - both actions follow Expand
         Network's own build rules. Jerry-Rig is free (pendingCost/showOutpostCostTable both
         omitted - there's nothing to charge the Corporation), Private Contractor costs nothing
         to the Corporation either (the acting Investor pays personally - see the Liquid Funds
         box below), so the Corporation box never shows a pending deduction for either. -->
    {#if buildInProgress && buildingCorporation && buildingCorporationId}
        <CorporationInfoBox
            corporationId={buildingCorporationId}
            treasury={buildingCorporation.treasury}
            miningCapacity={buildMiningCapacity}
            miningCapacityGain={buildMiningCapacityGainedThisAction}
            currentPayout={buildCurrentPayout}
            futurePayout={buildFuturePayout}
            remainingOutposts={buildingCorporation.unbuiltOutposts}
            hasNotSignedAgreement={!buildingCorporation.agreement}
        />
    {/if}

    <!-- Private Contractor draws from the acting Investor's own Liquid Funds, not the
         Corporation's Treasury - same lump-sum cost table Expand Network shows, just billed to a
         player. Live "(-X)" mirrors CorporationInfoBox's own pending-cost styling. -->
    {#if privateContractorInProgress && currentPlayerId && currentPlayerState}
        <div class="rounded-lg border border-[#2a3155] bg-[#12162b] px-3 py-2">
            <div class="text-sm font-semibold text-[#e6e9f5]"><PlayerName playerId={currentPlayerId} /></div>
            <div class="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#c3c9e6]">
                <span>
                    Liquid Funds: <CreditsIcon />{currentPlayerState.liquidFunds}
                    {#if privateContractorPendingCost > 0}
                        <span class="font-semibold text-[#e0343a]">(-{privateContractorPendingCost})</span>
                    {/if}
                </span>
            </div>
            <div
                class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#232945] pt-2 text-xs text-[#c3c9e6]"
            >
                <span class="mr-1 shrink-0 text-[10px] uppercase tracking-widest text-[#7f88ad]">
                    Outpost Costs:
                </span>
                {#each outpostCostTiers as count (count)}
                    <span class="inline-flex items-center gap-1 whitespace-nowrap">
                        {count}<OutpostIcon /> = <CreditsIcon />{ExpandNetworkOutpostCosts[count]}
                    </span>
                {/each}
            </div>
        </div>
    {/if}

    {#if gameSession.investorPickerOpen === InvestorActionId.InsuranceFraud}
        <div class="space-y-2 rounded-md border border-[#3a4166] bg-[#141833] p-2">
            {#if insuranceFraudCorporations.length === 0}
                <div class="text-xs font-semibold">Scrap a Delivered Ship for its cost:</div>
                <div class="text-xs text-[#7f88ad]">No eligible Ships.</div>
            {:else if insuranceFraudCorporations.length > 1 && !insuranceFraudCorporationId}
                <!-- Only shown when President of more than one eligible Corporation at once -
                     same Corporation-picker card style as Jerry-Rig/Private Contractor/Cargo
                     Boost, just to settle which Corporation's Charter to bring in below. -->
                <div class="text-xs font-semibold">Scrap a Delivered Ship for its cost - choose a Corporation:</div>
                <div class="flex flex-wrap gap-2">
                    {#each insuranceFraudCorporations as corporation (corporation.id)}
                        <button
                            type="button"
                            onclick={() => (insuranceFraudCorporationId = corporation.id)}
                            class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#2a3155] bg-[#12162b] px-2.5 py-1.5 text-left transition hover:brightness-110"
                        >
                            <img
                                src={CorporationLogoIcons[corporation.id]}
                                alt=""
                                class="h-8 shrink-0 drop-shadow"
                                style="width: {32 * (CorporationLogoAspect[corporation.id] ?? 1)}px;"
                            />
                            <div class="text-sm font-semibold text-[#e6e9f5]">
                                {CorporationDisplayNames[corporation.id]}
                            </div>
                        </button>
                    {/each}
                </div>
            {:else}
                {@const targetCorporationId = insuranceFraudCorporationId ?? insuranceFraudCorporations[0]!.id}
                <div class="flex items-center justify-between gap-2 text-xs">
                    <span class="font-semibold">
                        Select a Delivered Ship to scrap for {CorporationDisplayNames[targetCorporationId]}:
                    </span>
                    {#if insuranceFraudCorporations.length > 1}
                        <button
                            type="button"
                            onclick={() => (insuranceFraudCorporationId = undefined)}
                            class="shrink-0 text-[#7f88ad] hover:text-white"
                        >
                            change Corporation
                        </button>
                    {/if}
                </div>
                <!-- Same Charter box, same sizing, as the Order Ships action bar
                     (OrderShipPanel.svelte) - except here a Delivered (bottom-row) Ship is the
                     clickable target instead of the Shipyard, and clicking one scraps it
                     immediately rather than queuing anything. Bare CorporationCharter (no
                     CorporationCharterWithPowers wrapper) - Corporate Power cards aren't
                     relevant to picking a Ship to scrap, and skipping them saves some space in
                     this already-tight sidebar. -->
                <div class="relative" style="width: 25%; aspect-ratio: {CHARTER_ASPECT};">
                    <CorporationCharter
                        corporationId={targetCorporationId}
                        onSelectDeliveredShip={(level) => chooseInsuranceFraud(targetCorporationId, level)}
                    />
                </div>
            {/if}
        </div>
    {/if}

    {#if gameSession.investorPickerOpen === InvestorActionId.JerryRig}
        {#if buildEligibleCorporations.length === 0}
            <div class="text-xs text-[#7f88ad]">No eligible Corporations.</div>
        {/if}
        <div class="flex flex-wrap gap-2">
            {#each buildEligibleCorporations as corporation (corporation.id)}
                <button
                    type="button"
                    onclick={() => startBuild(corporation.id, ActionType.JerryRig)}
                    class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#2a3155] bg-[#12162b] px-2.5 py-1.5 text-left transition hover:brightness-110"
                >
                    <img
                        src={CorporationLogoIcons[corporation.id]}
                        alt=""
                        class="h-8 shrink-0 drop-shadow"
                        style="width: {32 * (CorporationLogoAspect[corporation.id] ?? 1)}px;"
                    />
                    <div class="text-sm font-semibold text-[#e6e9f5]">
                        {CorporationDisplayNames[corporation.id]}
                    </div>
                </button>
            {/each}
        </div>
    {/if}

    {#if gameSession.investorPickerOpen === InvestorActionId.PrivateContractor}
        {#if buildEligibleCorporations.length === 0}
            <div class="text-xs text-[#7f88ad]">No eligible Corporations.</div>
        {/if}
        <div class="flex flex-wrap gap-2">
            {#each buildEligibleCorporations as corporation (corporation.id)}
                <button
                    type="button"
                    onclick={() => startBuild(corporation.id, ActionType.PrivateContractor)}
                    class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#2a3155] bg-[#12162b] px-2.5 py-1.5 text-left transition hover:brightness-110"
                >
                    <img
                        src={CorporationLogoIcons[corporation.id]}
                        alt=""
                        class="h-8 shrink-0 drop-shadow"
                        style="width: {32 * (CorporationLogoAspect[corporation.id] ?? 1)}px;"
                    />
                    <div class="text-sm font-semibold text-[#e6e9f5]">
                        {CorporationDisplayNames[corporation.id]}
                    </div>
                </button>
            {/each}
        </div>
    {/if}

    {#if privateContractorInProgress && buildingCorporationId}
        <div class="rounded-md border border-[#3a4166] bg-[#141833] p-2 text-xs">
            <button
                type="button"
                onclick={stopBuilding}
                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
            >
                Stop Building
            </button>
        </div>
    {/if}

    <!-- Alien Engineering (Corporate Power Glossary, page 29) is offered across both halves of
         Investor Shenanigans (see actions/alienEngineering.ts) - shown regardless of
         actionSelectionInProgress, same as its own free-action treatment in
         AlienTechActionPanel.svelte, since it never conflicts with an in-progress build/picker. -->
    <AlienEngineeringPanel />

    {#if canAct && !actionSelectionInProgress}
        <div class="flex items-center gap-2 pt-1">
            <button
                type="button"
                onclick={pass}
                disabled={!isOffered(ActionType.PassInvestorAction)}
                class="rounded-md border border-[#3a4166] px-3 py-1 text-xs font-semibold hover:bg-[#1a1f38] disabled:opacity-40"
            >
                Pass
            </button>
        </div>
    {/if}

    {#if gameSession.lastActionError}
        <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
    {/if}
</div>
