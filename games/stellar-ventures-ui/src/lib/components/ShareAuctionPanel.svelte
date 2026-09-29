<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionType,
        MachineState,
        MAX_CARGO,
        CorporationStatus,
        CorporationId,
        effectiveMiningCapacityForCorporation,
        dividendPayoutPerShare
    } from '@tabletop/stellar-ventures'
    import {
        CorporationDisplayNames,
        CorporationShareCertificateIcons,
        SHARE_CERTIFICATE_ASPECT
    } from '$lib/utils/corporationDisplay.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CreditsIcon from './CreditsIcon.svelte'
    import CorporationInfoBox from './CorporationInfoBox.svelte'
    import BidStepper from './BidStepper.svelte'
    import LeakedResearchConfirmPanel from './LeakedResearchConfirmPanel.svelte'

    const gameSession = getGameSession()

    // Three ways into this same panel (see ActionPanel.svelte): the Corporation Round's own
    // Issue Share step (activeCorporationId), the forced auction that follows a resolved
    // Boardroom Battle (boardroomBattleCorporationId - see operations/boardroomBattle.ts's
    // beginForcedAuction), or Amethyst Agency's own Formation Auction (always
    // CorporationId.AmethystAgency - see stateHandlers/formAmethystAgency.ts). All three drive
    // the exact same activeShareAuction/PlaceShareBid/PassShareBid machinery, so one panel
    // handles all of them - only the header label and the "President decides whether to Issue"
    // pre-auction step (only the Corporation Round's own Issue Share has that choice - both
    // Boardroom Battle's forced auction and Amethyst's Formation Auction start bidding
    // immediately, with no President decision first) differ.
    const isBoardroomForced = $derived(gameSession.gameState.machineState === MachineState.BoardroomBattle)
    const isAmethystFormation = $derived(
        gameSession.gameState.machineState === MachineState.FormAmethystAgency
    )
    // NOTE: activeCorporationId is a computed getter (corporationTurnOrder[activeCorporationIndex])
    // that keeps returning whichever Corporation was last active in the Corporation Round - it
    // never becomes undefined once the game is underway, so `activeCorporationId ??
    // boardroomBattleCorporationId` would always resolve to the stale Corporation Round value
    // during a Boardroom Battle forced auction instead of ever falling through. Key off
    // isBoardroomForced/isAmethystFormation explicitly instead of relying on either field being
    // undefined.
    const corporationId = $derived(
        isBoardroomForced
            ? gameSession.gameState.boardroomBattleCorporationId
            : isAmethystFormation
              ? CorporationId.AmethystAgency
              : gameSession.gameState.activeCorporationId
    )
    const corporation = $derived(corporationId ? gameSession.gameState.getCorporation(corporationId) : undefined)
    const presidentId = $derived(corporation?.getPresidentPlayerId())

    const auction = $derived(gameSession.gameState.activeShareAuction)
    const bidOrder = $derived(gameSession.gameState.shareAuctionBidOrder ?? [])
    const currentBidderId = $derived(gameSession.gameState.shareAuctionCurrentBidderId)

    // Same Corporation info card every other action bar uses (see CorporationInfoBox.svelte and
    // BoardroomBattlePanel.svelte, which this is modeled on) - Treasury, Mining Capacity, Cargo
    // (plus the incoming-Cargo/future-Payout preview from Ships already Ordered but not yet
    // Delivered), current Payout, Shares Remaining and Status - rather than just a color dot and
    // a name.
    const miningCapacity = $derived(
        corporationId ? effectiveMiningCapacityForCorporation(gameSession.gameState, corporationId) : 0
    )
    // The Share up for auction here isn't actually issued (Corporation.issuedShareCount /
    // .status untouched) until someone wins the bidding and it's transferred to them - but once
    // the auction has opened, that outcome is certain (an opened Share Auction always ends with
    // exactly one winner), so from the moment bidding starts we preview Status (and therefore
    // Payout, which is looked up by Status - see dividendPayoutPerShare) as if this Share were
    // already issued, rather than waiting for the auction to actually resolve. Before the
    // auction opens (still on the President's Issue/Decline choice), this is just the
    // Corporation's real current Status.
    const previewedStatus = $derived(
        corporation
            ? corporation.statusForIssuedShareCount(corporation.issuedShareCount + (auction ? 1 : 0))
            : undefined
    )
    const currentPayout = $derived(
        corporation && previewedStatus !== undefined
            ? dividendPayoutPerShare(corporation.cargo, miningCapacity, previewedStatus)
            : 0
    )
    const pendingCargoLevelsSum = $derived(
        corporation?.orderedShipLevels.reduce((sum, level) => sum + level, 0) ?? 0
    )
    const futureCargo = $derived(
        corporation ? Math.min(MAX_CARGO, corporation.cargo + pendingCargoLevelsSum) : 0
    )
    const cargoGain = $derived(corporation ? futureCargo - corporation.cargo : 0)
    const futurePayout = $derived(dividendPayoutPerShare(futureCargo, miningCapacity, previewedStatus))

    function statusLabel(status?: CorporationStatus) {
        switch (status) {
            case CorporationStatus.Major:
                return 'Major'
            case CorporationStatus.Minor:
                return 'Minor'
            default:
                return 'Private'
        }
    }

    const canIssue = $derived(gameSession.validActionTypes.includes(ActionType.IssueShare))
    const canDecline = $derived(gameSession.validActionTypes.includes(ActionType.DeclineIssueShare))
    // Leaked Research (Corporate Power Glossary, page 29) - a free Research Wormhole for this
    // Corporation, offered alongside the Corporation Round's own Issue Share step before the
    // auction opens (see actions/leakedResearch.ts's isLeakedResearchWindow - never during a
    // Boardroom Battle forced auction or Amethyst's Formation Auction, which don't offer
    // IssueShare/DeclineIssueShare either). No target picker needed, but per the co-designer
    // clicking the button brings up the Power Tile first (leakedResearchConfirming) rather than
    // submitting immediately - see LeakedResearchConfirmPanel.svelte.
    const canLeakedResearch = $derived(gameSession.validActionTypes.includes(ActionType.LeakedResearch))
    let leakedResearchConfirming = $state(false)

    async function confirmLeakedResearch() {
        leakedResearchConfirming = false
        if (!corporationId) return
        await gameSession.leakedResearch(corporationId)
    }

    $effect(() => {
        if (leakedResearchConfirming && !canLeakedResearch) {
            leakedResearchConfirming = false
        }
    })
    const canBid = $derived(gameSession.validActionTypes.includes(ActionType.PlaceShareBid))
    const canPass = $derived(gameSession.validActionTypes.includes(ActionType.PassShareBid))
    const myTurn = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === currentBidderId)
    const isPresident = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    const minimumBid = $derived((auction?.highBid ?? -1) + 1)
    const isOpeningBid = $derived(auction?.highBid === undefined)

    let bidInput = $state(0)

    // Keep the suggested bid sensible as the high bid changes from turn to turn - re-derive
    // whenever it becomes my turn again or the high bid moves.
    $effect(() => {
        if (myTurn) {
            bidInput = minimumBid
        }
    })

    function participantFor(playerId: string) {
        return auction?.participants.find((participant) => participant.playerId === playerId)
    }

    async function submitIssue() {
        await gameSession.issueShare()
    }

    async function submitDecline() {
        await gameSession.declineIssueShare()
    }

    async function submitBid() {
        const amount = bidInput
        if (!Number.isFinite(amount)) {
            return
        }
        await gameSession.placeShareBid(amount)
    }

    async function submitPass() {
        await gameSession.passShareBid()
    }
</script>

<!--
    Issue Share, the first step of each Corporation's turn during the Corporation Round: the
    President decides whether to issue the Corporation's next available Share (opening it to a
    bidding auction among all players, reusing the same auction shape as the Initial Auction) or
    decline for this turn. Note: a President holding the Leaked Research power can still trigger
    it here via the generic fallback in ActionPanel - it isn't wired into this bespoke panel yet.
    Also doubles as the forced auction after a resolved Boardroom Battle (isBoardroomForced) -
    same auction UI below, just no President Issue/Decline step first.
-->
{#if corporationId && corporation}
    <div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
        <div class="text-xs font-semibold uppercase tracking-wide text-[#7f88ad]">
            {isBoardroomForced
                ? 'Boardroom Battle Forced Auction'
                : isAmethystFormation
                  ? 'Amethyst Agency Formation Auction'
                  : 'Issue Share'}
        </div>
        <div class="flex items-center gap-3">
            <!-- The actual Share Certificate art, so everyone sees at a glance which Corporation's
                 Share is on the block right now. Hidden on phones, where the info card beside it
                 already names the Corporation and the space is better spent on that. -->
            <img
                src={CorporationShareCertificateIcons[corporationId]}
                alt="{CorporationDisplayNames[corporationId]} Share Certificate"
                class="h-20 shrink-0 rounded-sm shadow-lg max-sm:hidden"
                style="width: {80 * SHARE_CERTIFICATE_ASPECT}px;"
            />
            <div class="flex-1">
                <!-- Same Corporation info card every other action bar uses (see
                     CorporationInfoBox.svelte and BoardroomBattlePanel.svelte, which this is
                     modeled on) - Treasury, Mining Capacity, Cargo (plus the incoming-Cargo/
                     future-Payout preview from Ships already Ordered but not yet Delivered),
                     current Payout, Shares Remaining, Status, remaining Outposts and
                     currently Delivered Ships. -->
                <CorporationInfoBox
                    {corporationId}
                    treasury={corporation.treasury}
                    {miningCapacity}
                    cargo={corporation.cargo}
                    {cargoGain}
                    {currentPayout}
                    {futurePayout}
                    availableShareCount={corporation.availableShareCount}
                    statusLabel={statusLabel(previewedStatus)}
                    remainingOutposts={corporation.unbuiltOutposts}
                    shipLevels={corporation.deliveredShipLevels}
                />
            </div>
        </div>

        {#if !auction}
            {#if isAmethystFormation}
                <!-- Should be unreachable in practice - enter() starts the Formation Auction
                     immediately, before this panel would ever render with no auction active -
                     but keep a plain waiting message rather than falling into the Issue Share
                     President-decision UI below, which doesn't apply here. -->
                <div class="pt-1 text-xs text-[#7f88ad]">Starting the Formation Auction...</div>
            {:else if isPresident && (canIssue || canDecline)}
                <div class="flex items-center gap-2 pt-1">
                    <button
                        type="button"
                        onclick={submitIssue}
                        disabled={!canIssue}
                        class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-40"
                    >
                        Issue Share
                    </button>
                    <button
                        type="button"
                        onclick={submitDecline}
                        disabled={!canDecline}
                        class="rounded-md border border-[#3a4166] px-3 py-1 text-xs font-semibold hover:bg-[#1a1f38] disabled:opacity-40"
                    >
                        Decline
                    </button>
                    {#if canLeakedResearch && !leakedResearchConfirming}
                        <button
                            type="button"
                            onclick={() => (leakedResearchConfirming = true)}
                            class="rounded-md border border-[#3a4166] px-3 py-1 text-xs font-semibold hover:bg-[#1a1f38]"
                        >
                            Leaked Research
                        </button>
                    {/if}
                </div>

                {#if leakedResearchConfirming && corporationId}
                    <div class="pt-2">
                        <LeakedResearchConfirmPanel
                            {corporationId}
                            onConfirm={confirmLeakedResearch}
                            onCancel={() => (leakedResearchConfirming = false)}
                        />
                    </div>
                {/if}
            {:else if presidentId}
                <div class="pt-1 text-xs text-[#7f88ad]">
                    Waiting on <PlayerName playerId={presidentId} /> to decide...
                </div>
            {/if}
        {:else}
            <div class="flex flex-wrap gap-1.5">
                {#each bidOrder as playerId (playerId)}
                    {@const participant = participantFor(playerId)}
                    <div
                        class="rounded-md border px-2 py-1 text-xs {playerId === currentBidderId
                            ? 'border-[#2f6fed] bg-[#182449]'
                            : 'border-[#2a2f45] bg-[#141833]'} {participant?.passed
                            ? 'opacity-50 line-through'
                            : ''}"
                    >
                        <PlayerName {playerId} />
                        <span class="ml-1 font-mono">
                            {#if participant?.bid !== undefined}<CreditsIcon />{participant.bid}{:else}—{/if}
                        </span>
                    </div>
                {/each}
            </div>

            {#if myTurn && (canBid || canPass)}
                <div class="flex flex-wrap items-center gap-2 pt-1">
                    <BidStepper bind:value={bidInput} min={minimumBid} disabled={!canBid} />
                    <button
                        type="button"
                        onclick={submitBid}
                        disabled={!canBid}
                        class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-40"
                    >
                        {isOpeningBid ? 'Open Bidding' : 'Place Bid'}
                    </button>
                    <button
                        type="button"
                        onclick={submitPass}
                        disabled={!canPass}
                        class="rounded-md border border-[#3a4166] px-3 py-1 text-xs font-semibold hover:bg-[#1a1f38] disabled:opacity-40"
                    >
                        Pass
                    </button>
                </div>
                {#if isOpeningBid}
                    <div class="text-xs text-[#7f88ad]">
                        You opened this auction - you must place an opening bid (<CreditsIcon />0 is allowed)
                        before anyone can pass.
                    </div>
                {/if}
            {:else if currentBidderId}
                <div class="pt-1 text-xs text-[#7f88ad]">
                    Waiting on <PlayerName playerId={currentBidderId} />...
                </div>
            {/if}
        {/if}

        {#if gameSession.lastActionError}
            <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
        {/if}
    </div>
{/if}
