<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionType,
        CorporatePowerId,
        ExpandNetworkOutpostCosts,
        QuantumPropulsionDiscount,
        ALIEN_ALCHEMIST_OUTPOST_COST,
        DISMANTLING_OUTPOSTS_COST,
        effectiveMiningCapacityForCorporation,
        createWormholeCostForCorporation,
        dividendPayoutPerShare,
        dividendRowForCargo,
        dividendRowForMiningCapacity,
        taxDueForCorporation
    } from '@tabletop/stellar-ventures'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CorporationInfoBox from './CorporationInfoBox.svelte'
    import OutpostIcon from './OutpostIcon.svelte'
    import CreditsIcon from './CreditsIcon.svelte'
    import HexIcon from './HexIcon.svelte'
    import DividendChartPanel from './DividendChartPanel.svelte'
    import LeakedResearchConfirmPanel from './LeakedResearchConfirmPanel.svelte'

    const gameSession = getGameSession()

    // "You are ..." for the viewer, "<name> is ..." for anyone else (PlayerName renders "You").
    function isOrAre(playerId: string | undefined) {
        return playerId !== undefined && playerId === gameSession.myPlayer?.id ? 'are' : 'is'
    }

    const corporationId = $derived(gameSession.gameState.activeCorporationId)
    const corporation = $derived(
        corporationId ? gameSession.gameState.getCorporation(corporationId) : undefined
    )
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    // Borders & Taxes only (Alpha never sets usesTaxes) - what this Corporation would owe next
    // Pay Taxes, so the President can weigh it while deciding whether/where to expand. Doesn't
    // change from expanding itself (Tax is read off Outpost placement inside a Tax Zone, not
    // Mining Capacity), it's just useful context to show alongside everything else here.
    const taxDue = $derived(
        corporationId && gameSession.gameState.usesTaxes
            ? taxDueForCorporation(gameSession.gameState, corporationId)
            : undefined
    )

    const canDecline = $derived(
        gameSession.validActionTypes.includes(ActionType.DeclineExpandNetworkOrWormhole)
    )

    // Alien Alchemist (Corporate Power Glossary, page 29) - offered alongside Expand Network/
    // Create Wormhole for the rest of this Corporation's Corporation Round, not tied to either
    // mode. Clicking its button doesn't submit anything by itself - it highlights the first
    // ALIEN_ALCHEMIST_OUTPOST_COST Outposts in the Outposts row below (CorporationInfoBox's own
    // outpostSacrificeHighlightCount) and waits for the President to click one of them to
    // actually confirm (see confirmAlienAlchemist) - the co-designer's own preferred "highlight,
    // then click to confirm" flow, even though the underlying action itself takes no parameters.
    const canAlienAlchemist = $derived(gameSession.validActionTypes.includes(ActionType.AlienAlchemist))
    let alienAlchemistPicking = $state(false)

    function toggleAlienAlchemistPicking() {
        alienAlchemistPicking = !alienAlchemistPicking
    }

    async function confirmAlienAlchemist() {
        alienAlchemistPicking = false
        await gameSession.alienAlchemist()
    }

    // Leaving this mode (a different Corporation comes up, or Alien Alchemist stops being
    // offered - e.g. already used this Corporation Round) drops the highlight rather than
    // leaving stale Outposts glowing with nothing left to confirm.
    $effect(() => {
        if (alienAlchemistPicking && !canAlienAlchemist) {
            alienAlchemistPicking = false
        }
    })

    // Dismantling Outposts (Corporate Power Glossary) - remove 1 already-built Outpost from the
    // board for DISMANTLING_OUTPOSTS_COST, once per Corporation Round, restoring it to this
    // Corporation's unbuilt Outposts supply (see operations/network.ts). Offered alongside
    // Expand Network/Create Wormhole for the rest of this Corporation's Corporation Round, same
    // as Alien Alchemist above, but this one needs an actual hex click (which Outpost to
    // remove) rather than Alien Alchemist's own in-panel outpostSacrificeHighlightCount
    // mechanic - so instead of a local boolean, it drives gameSession.boardActionMode directly,
    // the same board-click mode Board.svelte already reads for ExpandNetwork/CreateWormhole/
    // DevelopPlanets (see Board.svelte's canDismantlingOutposts/onHexClick/validHexIds).
    const canDismantlingOutposts = $derived(
        gameSession.validActionTypes.includes(ActionType.DismantlingOutposts)
    )
    const dismantlingOutpostsPicking = $derived(
        gameSession.boardActionMode === ActionType.DismantlingOutposts
    )

    function toggleDismantlingOutposts() {
        gameSession.boardActionMode = dismantlingOutpostsPicking ? undefined : ActionType.DismantlingOutposts
    }

    // Leaked Research (Corporate Power Glossary, page 29) - a free Research Wormhole for this
    // Corporation, offered alongside Expand Network/Create Wormhole for the rest of this
    // Corporation's turn, same as Alien Alchemist/Dismantling Outposts above. No target picker
    // needed (this Corporation is the only eligible target), but per the co-designer clicking
    // the button brings up the Power Tile first (leakedResearchConfirming) rather than
    // submitting immediately - see LeakedResearchConfirmPanel.svelte.
    const canLeakedResearch = $derived(gameSession.validActionTypes.includes(ActionType.LeakedResearch))
    let leakedResearchConfirming = $state(false)

    async function confirmLeakedResearch() {
        leakedResearchConfirming = false
        if (!corporationId) return
        await gameSession.leakedResearch(corporationId)
    }

    // Leaving this mode (a different Corporation comes up, or Leaked Research stops being
    // offered - e.g. already used) drops the confirm card rather than leaving it stuck open on
    // an action that can no longer be submitted.
    $effect(() => {
        if (leakedResearchConfirming && !canLeakedResearch) {
            leakedResearchConfirming = false
        }
    })

    // Leaving this mode (a different Corporation comes up, or Dismantling Outposts stops being
    // offered - e.g. already used this Corporation Round) drops back to the default Expand
    // Network/Create Wormhole mode rather than leaving the board stuck highlighting Outposts for
    // a click that can no longer be submitted.
    $effect(() => {
        if (dismantlingOutpostsPicking && !canDismantlingOutposts) {
            gameSession.boardActionMode = undefined
        }
    })

    // Expand Network and Create Wormhole are mutually exclusive per hex click, but a Corporation
    // with both an adjacent expansion target AND active Wormhole Technology can legally use
    // either one - same two derived flags Board.svelte itself checks, and the same fallback
    // order when the President hasn't picked explicitly yet (gameSession.boardActionMode unset):
    // prefer Expand Network, since it's the more common case and can be Undo'd hex-by-hex, while
    // Create Wormhole spends its one shot immediately. The toggle below only appears when both
    // are actually legal at once - when only one is, there's nothing to choose between.
    const canExpandNetwork = $derived(gameSession.validActionTypes.includes(ActionType.ExpandNetwork))
    const canCreateWormhole = $derived(gameSession.validActionTypes.includes(ActionType.CreateWormhole))
    const mode = $derived(
        gameSession.boardActionMode ?? (canExpandNetwork ? ActionType.ExpandNetwork : ActionType.CreateWormhole)
    )
    const isWormholeMode = $derived(mode === ActionType.CreateWormhole && canCreateWormhole)

    function chooseMode(newMode: ActionType.ExpandNetwork | ActionType.CreateWormhole) {
        gameSession.boardActionMode = newMode
        gameSession.wormholeSelectedHexId = undefined
    }

    // Create Wormhole has no adjacency requirement (unlike Expand Network) but a cost that
    // depends entirely on which hex gets clicked (createWormholeCostForCorporation: ₮1 per hex
    // skipped from the Corporation's nearest Outpost, +₮4 flat, +₮1 per other Corporation
    // already there), so unlike Expand Network's fixed cost table there's no single number to
    // preview before a hex is actually chosen - this just explains the formula instead, same as
    // the rulebook does.
    const hasQuantumPropulsion = $derived(
        !!corporationId && !!corporation?.hasActivePower(CorporatePowerId.QuantumPropulsion)
    )

    // Create Wormhole's tentative hex pick (Board.svelte's onHexClick - a first click on a hex
    // just sets this and previews its numbers below; a second click on that SAME hex is what
    // actually submits CreateWormhole). Undefined once nothing's picked yet, or right after a
    // build actually goes through (gameSession.beforeNewState resets it on every new state).
    const wormholeSelectedHexId = $derived(gameSession.wormholeSelectedHexId)
    const wormholeCostPreview = $derived.by(() => {
        if (!wormholeSelectedHexId || !corporationId) {
            return undefined
        }
        return createWormholeCostForCorporation(gameSession.gameState, corporationId, wormholeSelectedHexId)
    })
    // Mirrors board.ts's miningCapacityForCorporation for just this one (not-yet-built) hex -
    // Mega-Earth's shared value track is indexed by however many Corporations WOULD be built
    // there after this one (see currentMegaEarthValue's own comment: the value is shared by
    // every Corporation there, this one included), everything else just its own printed value.
    const wormholeMiningGainPreview = $derived.by(() => {
        if (!wormholeSelectedHexId) {
            return 0
        }
        const board = gameSession.gameState.board
        const hex = board.getHex(wormholeSelectedHexId)
        if (!hex) {
            return 0
        }
        return board.miningValueAfterNextOutpost(hex)
    })

    const builtCount = $derived(gameSession.gameState.expandingHexIds?.length ?? 0)

    // The rulebook's cost table is a flat total keyed by however many Outposts have been built
    // in this one action so far (not summed per Outpost - see operations/network.ts's
    // expandNetworkCost), plus the accumulated ₮1-per-other-Corporation placement penalty -
    // both only actually charged as a single lump sum once the build ends (by signing or
    // declining).
    const totalCost = $derived(
        (builtCount > 0 ? (ExpandNetworkOutpostCosts[builtCount] ?? 0) : 0) +
            (gameSession.gameState.expandingPlacementPenalty ?? 0)
    )

    // Every Outpost built this action is placed on the board immediately (only its cost is
    // deferred - see actions/expandNetwork.ts), so Mining Capacity already reflects them live as
    // the President clicks each hex; no separate "preview" math needed here.
    const liveMiningCapacity = $derived(
        corporationId ? effectiveMiningCapacityForCorporation(gameSession.gameState, corporationId) : 0
    )

    // How much of liveMiningCapacity was actually gained THIS action - the sum of each
    // already-built hex's own Mining value (mirroring board.ts's miningCapacityForCorporation
    // exactly, hex by hex, rather than diffing against a snapshot taken at some earlier mount -
    // that stays correct even if this panel gets torn down and remounted mid-build, e.g. by an
    // intervening Sign The Agreement offer). Subtracted back out of liveMiningCapacity so the
    // Corporation Info box can show the President both their starting figure and a live "+X" on
    // top of it, rather than a single number that quietly moved.
    const miningCapacityGainedThisAction = $derived.by(() => {
        const hexIds = gameSession.gameState.expandingHexIds
        if (!hexIds || hexIds.length === 0) {
            return 0
        }
        const board = gameSession.gameState.board
        let total = 0
        for (const hexId of hexIds) {
            const hex = board.requireHex(hexId)
            total += board.miningValueForHex(hex)
        }
        return total
    })
    const miningCapacity = $derived(liveMiningCapacity - miningCapacityGainedThisAction)

    // Current vs. updated Dividend payout per Share (same treatment Order Ships/Boardroom
    // Battle/Share Auction already give this box - see CorporationInfoBox's own
    // currentPayout/futurePayout comments) - Cargo doesn't move from building Outposts, so only
    // Mining Capacity's side of the comparison changes here, mirroring whichever mining capacity
    // figures this panel is already showing above (live build totals in Expand Network mode,
    // this one hex's preview in Wormhole mode).
    const baseMiningCapacityForPayout = $derived(isWormholeMode ? liveMiningCapacity : miningCapacity)
    const miningCapacityGainForPayout = $derived(
        isWormholeMode ? wormholeMiningGainPreview : miningCapacityGainedThisAction
    )
    const currentPayout = $derived(
        corporation
            ? dividendPayoutPerShare(corporation.cargo, baseMiningCapacityForPayout, corporation.status)
            : 0
    )
    const futurePayout = $derived(
        corporation
            ? dividendPayoutPerShare(
                  corporation.cargo,
                  baseMiningCapacityForPayout + miningCapacityGainForPayout,
                  corporation.status
              )
            : 0
    )

    // Other, rarer options this step also allows (a handful of one-off Corporate Powers -
    // Nebular Explorers) don't have bespoke UI yet - fall back to the same
    // pick-the-action-type-then-hand-type-JSON flow ActionPanel uses everywhere else, scoped to
    // just those. Expand Network and Create Wormhole both now have their own board-click flow
    // (the mode toggle above), and Alien Alchemist/Dismantling Outposts/Leaked Research all have
    // their own buttons below, so all are excluded here.
    const otherActionTypes = $derived(
        gameSession.validActionTypes.filter(
            (actionType) =>
                actionType !== ActionType.ExpandNetwork &&
                actionType !== ActionType.CreateWormhole &&
                actionType !== ActionType.DeclineExpandNetworkOrWormhole &&
                actionType !== ActionType.AlienAlchemist &&
                actionType !== ActionType.DismantlingOutposts &&
                actionType !== ActionType.LeakedResearch
        )
    )

    let chosenActionType: ActionType | undefined = $state()
    let payloadText = $state('{}')
    let parseError: string | undefined = $state()

    function chooseAction(actionType: string) {
        chosenActionType = actionType as ActionType
        payloadText = '{}'
        parseError = undefined
    }

    function cancelOther() {
        chosenActionType = undefined
        parseError = undefined
    }

    async function submitOther() {
        if (!chosenActionType) return

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

    // Per the co-designer: before actually ending this Corporation's turn (Decline/Stop
    // Expanding, which submits DeclineExpandNetworkOrWormhole and moves the machine on to Pay
    // Dividends), show a quick confirmation preview first - the Dividend Chart with only this
    // Corporation's own Cargo/Mining Capacity markers (DividendChartPanel's onlyCorporationId),
    // the payout cell that's actually about to be paid pulsing (payoutHighlight), and a
    // "Confirm End Operations" button that's the one thing that actually submits. `liveMiningCapacity`
    // rather than baseMiningCapacityForPayout, since by now every hex built this action (and, in
    // Wormhole mode, the just-created wormhole - createWormhole already resolves immediately on
    // click, before this confirm step) is already live - this is the final number, not a
    // before/after comparison. Purely local pacing (nothing submitted until actually confirmed),
    // same convention as every other reveal/confirm step in this app.
    let confirmingEndOperations = $state(false)

    const endOperationsPayoutHighlight = $derived.by(() => {
        if (!corporation) return undefined
        const row = Math.min(
            dividendRowForCargo(corporation.cargo),
            dividendRowForMiningCapacity(liveMiningCapacity)
        )
        return { row, status: corporation.status }
    })

    function beginEndOperationsConfirm() {
        confirmingEndOperations = true
    }

    function cancelEndOperationsConfirm() {
        confirmingEndOperations = false
    }

    // Same "drop stale local mode when it no longer applies" treatment as
    // alienAlchemistPicking/dismantlingOutpostsPicking above - this component instance persists
    // across different Corporations' own Expand Network turns (ActionPanel doesn't remount it
    // per-Corporation), so without this a confirm screen left open would otherwise carry over
    // onto the NEXT Corporation's turn.
    $effect(() => {
        if (confirmingEndOperations && !canDecline) {
            confirmingEndOperations = false
        }
    })
    let confirmEndOperationsCorporationId: string | undefined
    $effect(() => {
        if (corporationId !== confirmEndOperationsCorporationId) {
            confirmEndOperationsCorporationId = corporationId
            confirmingEndOperations = false
        }
    })

    async function stopExpanding() {
        confirmingEndOperations = false
        await gameSession.declineExpandNetworkOrWormhole()
    }
</script>

{#if corporationId}
    <div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
        {#if confirmingEndOperations && corporation}
            <!-- Per the co-designer: a quick confirmation preview before this Corporation's
                 turn actually ends - see confirmingEndOperations' own comment above. No text -
                 the highlighted chart already says what's about to be paid. -->
            <!-- Chart and buttons share one centered column (30rem = the chart's own max-w-md
                 plus DividendChartPanel's p-4), so the buttons sit centered directly under the
                 chart instead of hugging the far left of a wide action bar. -->
            <div class="mx-auto w-full max-w-[30rem] space-y-2">
            <div class="h-72">
                <DividendChartPanel
                    onlyCorporationId={corporationId}
                    payoutHighlight={endOperationsPayoutHighlight}
                />
            </div>
            <div class="flex justify-center gap-1.5">
                <button
                    type="button"
                    onclick={stopExpanding}
                    class="rounded-md bg-[#2f6fed] px-2.5 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa]"
                >
                    Confirm Dividend
                </button>
                <button
                    type="button"
                    onclick={cancelEndOperationsConfirm}
                    class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1.5 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
                >
                    Back
                </button>
            </div>
            </div>
        {:else}
        <div class="text-sm">
            {#if presidentId}
                <PlayerName playerId={presidentId} />
            {/if}
            {#if isWormholeMode}
                {isOrAre(presidentId)} creating a wormhole for
                <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span>
            {:else}
                {isOrAre(presidentId)} expanding
                <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span>'s network
            {/if}
        </div>

        {#if canExpandNetwork && canCreateWormhole}
            <!-- Only shown when both are actually legal at once (an adjacent expansion target
                 AND active Wormhole Technology) - otherwise Board.svelte just falls back to
                 whichever single one is valid and there's nothing to choose between. -->
            <div class="flex gap-1.5">
                <button
                    type="button"
                    onclick={() => chooseMode(ActionType.ExpandNetwork)}
                    class="rounded-md border px-2.5 py-1 text-xs font-semibold {!isWormholeMode
                        ? 'border-[#2f6fed] bg-[#1a2a52] text-[#e6e9f5]'
                        : 'border-[#3a4166] bg-[#1a1f38] text-[#7f88ad] hover:bg-[#212845]'}"
                >
                    Expand Network
                </button>
                <button
                    type="button"
                    onclick={() => chooseMode(ActionType.CreateWormhole)}
                    class="rounded-md border px-2.5 py-1 text-xs font-semibold {isWormholeMode
                        ? 'border-[#2f6fed] bg-[#1a2a52] text-[#e6e9f5]'
                        : 'border-[#3a4166] bg-[#1a1f38] text-[#7f88ad] hover:bg-[#212845]'}"
                >
                    Create Wormhole
                </button>
            </div>
        {/if}

        <!-- The acting Corporation's own name/logo, Treasury and Mining Capacity. Expand
             Network defers its cost to a single lump sum charged only once the build ends (see
             totalCost), so it gets a live "(-X)" preview and the flat cost table; Create
             Wormhole charges its one Outpost's cost immediately on build
             (actions/createWormhole.ts), but no longer immediately on CLICK - once a hex is
             tentatively picked (wormholeSelectedHexId), this box shows the exact same kind of
             live preview Expand Network gets, just computed for that one hex instead of a
             running build. -->
        {#if corporation}
            <CorporationInfoBox
                {corporationId}
                treasury={corporation.treasury}
                pendingCost={dismantlingOutpostsPicking
                    ? DISMANTLING_OUTPOSTS_COST
                    : isWormholeMode
                      ? (wormholeCostPreview ?? 0)
                      : totalCost}
                miningCapacity={baseMiningCapacityForPayout}
                miningCapacityGain={miningCapacityGainForPayout}
                {currentPayout}
                {futurePayout}
                {taxDue}
                remainingOutposts={corporation.unbuiltOutposts}
                showOutpostCostTable={!isWormholeMode}
                hasNotSignedAgreement={!corporation.agreement}
                outpostSacrificeHighlightCount={alienAlchemistPicking ? ALIEN_ALCHEMIST_OUTPOST_COST : 0}
                onOutpostSacrificeClick={confirmAlienAlchemist}
            />
        {/if}

        {#if isWormholeMode}
            <!-- No adjacency requirement and no fixed cost table (unlike Expand Network) - the
                 rulebook's own formula, spelled out here as a compact visual equation (real
                 Outpost/Credits icons, not a placeholder currency character) since there's no
                 single number to preview before a hex is actually picked. -->
            <div class="rounded-md border border-[#2a3155] bg-[#12162b] px-2.5 py-1.5 text-xs text-[#c3c9e6]">
                <div class="flex flex-wrap items-center gap-1 text-sm font-semibold text-[#e6e9f5]">
                    <span>1</span>
                    <OutpostIcon />
                    <span>=</span>
                    <CreditsIcon />
                    <span>4 +</span>
                    <CreditsIcon />
                    <span>1 per</span>
                    <HexIcon />
                    <span>skipped</span>
                </div>
                <div class="mt-1">
                    Build 1 Outpost anywhere on the board - no adjacency needed. +<CreditsIcon
                    />1 per other Corporation already there{#if hasQuantumPropulsion}, -<CreditsIcon
                    />{QuantumPropulsionDiscount} (Quantum Propulsion){/if}.
                </div>
            </div>
            {#if !wormholeSelectedHexId && isMe}
                <div class="text-xs text-[#7f88ad]">Click a hex to preview its cost.</div>
            {/if}
        {/if}

        {#if !isMe}
            <div class="text-xs text-[#7f88ad]">
                Waiting on {#if presidentId}<PlayerName playerId={presidentId} />{:else}the President{/if}
                to {isWormholeMode ? 'create a wormhole' : 'expand the network'}...
            </div>
        {/if}

        {#if isMe}
            <div class="flex gap-1.5">
                {#if isWormholeMode && wormholeSelectedHexId}
                    <!-- The explicit way to lock in the tentative pick (Board.svelte's onHexClick
                         also lets a second click on the SAME hex do this - this button is just a
                         more discoverable, unambiguous alternative to that). -->
                    <button
                        type="button"
                        onclick={() => gameSession.createWormhole(wormholeSelectedHexId)}
                        class="rounded-md bg-[#2f6fed] px-2.5 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa]"
                    >
                        Create Wormhole
                    </button>
                {/if}
                {#if canDecline}
                    <button
                        type="button"
                        onclick={beginEndOperationsConfirm}
                        class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1.5 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
                    >
                        <!-- Create Wormhole only ever builds 1 Outpost per action (unlike Expand
                             Network's multi-hex builtCount), so "Done Expanding" - worded for
                             backing out of an in-progress multi-build - never applies here; it's
                             always plainly "Decline" in Wormhole mode. -->
                        {isWormholeMode || builtCount === 0 ? 'Decline' : 'Done Expanding'}
                    </button>
                {/if}
                {#if canAlienAlchemist}
                    <button
                        type="button"
                        onclick={toggleAlienAlchemistPicking}
                        class="rounded-md border px-2.5 py-1.5 text-xs font-semibold {alienAlchemistPicking
                            ? 'border-[#3ddc84] bg-[#123a2a] text-[#8fe0a8]'
                            : 'border-[#3a4166] bg-[#1a1f38] hover:border-[#2f6fed] hover:bg-[#212845]'}"
                    >
                        Alien Alchemist
                    </button>
                {/if}
                {#if canDismantlingOutposts}
                    <button
                        type="button"
                        onclick={toggleDismantlingOutposts}
                        class="rounded-md border px-2.5 py-1.5 text-xs font-semibold {dismantlingOutpostsPicking
                            ? 'border-[#3ddc84] bg-[#123a2a] text-[#8fe0a8]'
                            : 'border-[#3a4166] bg-[#1a1f38] hover:border-[#2f6fed] hover:bg-[#212845]'}"
                    >
                        Dismantle
                    </button>
                {/if}
                {#if canLeakedResearch}
                    <button
                        type="button"
                        onclick={() => (leakedResearchConfirming = true)}
                        class="rounded-md border px-2.5 py-1.5 text-xs font-semibold {leakedResearchConfirming
                            ? 'border-[#3ddc84] bg-[#123a2a] text-[#8fe0a8]'
                            : 'border-[#3a4166] bg-[#1a1f38] hover:border-[#2f6fed] hover:bg-[#212845]'}"
                    >
                        Leaked Research
                    </button>
                {/if}
            </div>
        {/if}

        {#if leakedResearchConfirming && corporationId}
            <LeakedResearchConfirmPanel
                {corporationId}
                onConfirm={confirmLeakedResearch}
                onCancel={() => (leakedResearchConfirming = false)}
            />
        {/if}

        {#if alienAlchemistPicking}
            <div class="text-xs text-[#8fe0a8]">
                Click one of the highlighted Outposts below to remove 2 and gain 1 Alien
                Technology Cube.
            </div>
        {/if}

        {#if dismantlingOutpostsPicking}
            <div class="text-xs text-[#8fe0a8]">
                Click a highlighted Outpost on the board to remove it for <CreditsIcon
                />{DISMANTLING_OUTPOSTS_COST} and return it to {CorporationDisplayNames[corporationId]}'s
                unbuilt Outposts.
            </div>
        {/if}

        {#if isMe && otherActionTypes.length > 0}
            <div class="border-t border-[#232945] pt-2">
                {#if !chosenActionType}
                    <div class="flex flex-wrap gap-1.5">
                        {#each otherActionTypes as actionType (actionType)}
                            <button
                                type="button"
                                onclick={() => chooseAction(actionType)}
                                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2 py-1 text-xs hover:bg-[#262c4d]"
                            >
                                {actionType}
                            </button>
                        {/each}
                    </div>
                {:else}
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between text-xs">
                            <span class="font-semibold">{chosenActionType}</span>
                            <button type="button" onclick={cancelOther} class="text-[#7f88ad] hover:text-white">
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
                            onclick={submitOther}
                            class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa]"
                        >
                            Submit
                        </button>
                    </div>
                {/if}
            </div>
        {/if}
        {/if}

        {#if gameSession.lastActionError}
            <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
        {/if}
    </div>
{/if}
