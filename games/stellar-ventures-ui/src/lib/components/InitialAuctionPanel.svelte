<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, MachineState } from '@tabletop/stellar-ventures'
    import {
        CorporationDisplayNames,
        CorporationShareCertificateIcons,
        SHARE_CERTIFICATE_ASPECT
    } from '$lib/utils/corporationDisplay.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import {
        powerCardImageForSide,
        powerHasTwoSides,
        POWER_CARD_ASPECT,
        type PowerCardSide
    } from '$lib/utils/corporatePowerImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CreditsIcon from './CreditsIcon.svelte'
    import BidStepper from './BidStepper.svelte'

    const gameSession = getGameSession()

    const corporationId = $derived(gameSession.gameState.activeInitialAuctionCorporationId)
    const auction = $derived(gameSession.gameState.activeInitialAuction)
    const bidOrder = $derived(gameSession.gameState.initialAuctionBidOrder ?? [])
    const currentBidderId = $derived(gameSession.gameState.initialAuctionCurrentBidderId)

    // Every winning President immediately drafts a second Corporate Power (rulebook page 11,
    // step 4) before the next Corporation goes up for auction - stateHandlers/initialAuction.ts
    // detours the machine into MachineState.DraftPower for that. Sign The Agreement (much later
    // in the game) reuses the exact same DraftPower state for its own one-off draft, so this only
    // counts as part of the Initial Auction when the draft will resume BACK into the auction
    // sequence (InitialAuction for the next Corporation, or IssueShare once all five are done) -
    // never when it resumes somewhere else (PayDividends, AlienTechAction), which is
    // DraftPowerPanel.svelte's own territory instead. Per the co-designer, this drafting step
    // should stay visually part of the same auction screen rather than swapping to a different
    // one, so this component renders it directly instead of ActionPanel handing off.
    const isDrafting = $derived(
        gameSession.gameState.machineState === MachineState.DraftPower &&
            !!gameSession.gameState.draftPowerCorporationId &&
            (gameSession.gameState.draftPowerResumeState === MachineState.InitialAuction ||
                gameSession.gameState.draftPowerResumeState === MachineState.IssueShare)
    )
    const draftPowerCorporationId = $derived(gameSession.gameState.draftPowerCorporationId)
    const draftCorporation = $derived(
        isDrafting && draftPowerCorporationId
            ? gameSession.gameState.getCorporation(draftPowerCorporationId)
            : undefined
    )
    const draftPresidentId = $derived(draftCorporation?.getPresidentPlayerId())
    const isMeDraftPresident = $derived(
        !!gameSession.myPlayer && gameSession.myPlayer.id === draftPresidentId
    )
    const canDraftAction = $derived(gameSession.validActionTypes.includes(ActionType.DraftPower))
    const canDraftNow = $derived(isDrafting && isMeDraftPresident && canDraftAction)

    // Which Corporation's Share should stay highlighted at the front of the row below - the
    // one currently up for bid, or (once that resolves) the one whose President is now drafting
    // their second Power. Per the co-designer, the just-won Share should stay highlighted
    // through the draft rather than disappearing the instant bidding ends, so a player can still
    // see which Corporation's turn it is until they've actually finished picking.
    const highlightCorporationId = $derived(
        corporationId ?? (isDrafting ? draftPowerCorporationId : undefined)
    )

    // initialAuctionQueue only ever holds Corporations whose auction hasn't started yet (the
    // active one is shifted off it when its auction begins), so prepending the highlighted
    // Corporation reconstructs the remaining auction order - and since a completed Corporation
    // (once its draft is also done) is no longer in either field, it naturally drops off this
    // list once its Share is won AND its Power is drafted - consistent with "as shares are
    // auctioned, they disappear", just delayed until the whole turn is actually finished.
    const upcomingCorporationIds = $derived(
        highlightCorporationId
            ? [highlightCorporationId, ...gameSession.gameState.initialAuctionQueue]
            : [...gameSession.gameState.initialAuctionQueue]
    )

    const availablePowerIds = $derived(gameSession.gameState.availableCorporatePowerIds)

    const canBid = $derived(gameSession.validActionTypes.includes(ActionType.PlaceBid))
    const canPass = $derived(gameSession.validActionTypes.includes(ActionType.PassAuction))
    const myTurn = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === currentBidderId)

    const minimumBid = $derived((auction?.highBid ?? -1) + 1)
    const isOpeningBid = $derived(auction?.highBid === undefined)

    // A bid can never be more than the bidder's Liquid Funds (the engine rejects it), so the
    // stepper stops there instead of letting the amount climb past what they can pay.
    const maxBid = $derived(
        currentBidderId ? gameSession.gameState.getPlayerState(currentBidderId).liquidFunds : undefined
    )
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

    async function submitBid() {
        const amount = bidInput
        if (!Number.isFinite(amount)) {
            return
        }
        await gameSession.placeBid(amount)
    }

    async function submitPass() {
        await gameSession.passAuction()
    }

    async function choosePower(powerId: string) {
        await gameSession.draftPower(powerId)
    }

    // Which face of each Available Power card is currently showing. Outside of this player's own
    // draft turn, a click just flips the card in place (reference only); while it's this
    // player's own draft turn, the main click drafts instead, and flipping moves to a small
    // corner control (same split DraftPowerPanel.svelte uses for the same reason).
    let sideById = $state<Record<string, PowerCardSide>>({})
    function sideFor(powerId: string): PowerCardSide {
        return sideById[powerId] ?? 'back'
    }
    function flip(powerId: string) {
        if (!powerHasTwoSides(powerId)) {
            return
        }
        sideById = { ...sideById, [powerId]: sideFor(powerId) === 'front' ? 'back' : 'front' }
    }
</script>

{#if (corporationId && auction) || isDrafting}
    <div class="space-y-3 px-4 py-2 text-[#e6e9f5]">
        <div class="flex flex-wrap items-end gap-2">
            {#each upcomingCorporationIds as corpId (corpId)}
                <div
                    class="overflow-hidden rounded-md transition {corpId === highlightCorporationId
                        ? 'w-16 ring-2 ring-[#2f6fed]'
                        : 'w-11 opacity-60'}"
                >
                    <img
                        src={CorporationShareCertificateIcons[corpId]}
                        alt={CorporationDisplayNames[corpId]}
                        class="block w-full"
                        style="aspect-ratio: {SHARE_CERTIFICATE_ASPECT};"
                    />
                </div>
            {/each}
        </div>

        {#if !isDrafting}
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
                    <BidStepper bind:value={bidInput} min={minimumBid} max={maxBid} disabled={!canBid} />
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
                        You opened this auction - you must place an opening bid (<CreditsIcon />0 is allowed) before
                        anyone can pass.
                    </div>
                {/if}
            {:else if currentBidderId}
                <div class="pt-1 text-xs text-[#7f88ad]">
                    Waiting on <PlayerName playerId={currentBidderId} />...
                </div>
            {/if}
        {:else if !isMeDraftPresident && draftPresidentId}
            <div class="pt-1 text-xs text-[#7f88ad]">
                Waiting on <PlayerName playerId={draftPresidentId} /> to draft a Power...
            </div>
        {/if}

        {#if availablePowerIds.length > 0}
            <div class="pt-1">
                <div class="mb-1 text-xs font-semibold text-[#7f88ad]">
                    {canDraftNow ? 'Draft a Corporate Power' : 'Available Corporate Powers'}
                </div>
                <div class="flex flex-wrap gap-3">
                    {#each availablePowerIds as powerId (powerId)}
                        <button
                            type="button"
                            onclick={() => (canDraftNow ? choosePower(powerId) : flip(powerId))}
                            class="group relative w-[10.5rem] shrink-0 overflow-hidden rounded-md border-0 bg-transparent p-0"
                            aria-label={canDraftNow
                                ? `Draft ${CorporatePowerDisplayNames[powerId] ?? powerId}`
                                : `Flip ${CorporatePowerDisplayNames[powerId] ?? powerId}`}
                        >
                            <img
                                src={powerCardImageForSide(powerId, sideFor(powerId)) ?? ''}
                                alt={CorporatePowerDisplayNames[powerId] ?? powerId}
                                class="block w-full"
                                style="aspect-ratio: {POWER_CARD_ASPECT};"
                            />
                            {#if canDraftNow && powerHasTwoSides(powerId)}
                                <span
                                    role="button"
                                    tabindex="0"
                                    onclick={(event) => {
                                        event.stopPropagation()
                                        flip(powerId)
                                    }}
                                    onkeydown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.stopPropagation()
                                            flip(powerId)
                                        }
                                    }}
                                    class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white opacity-0 transition group-hover:opacity-100"
                                    aria-label="Flip card"
                                    title="Flip card"
                                >⟲</span>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        {#if gameSession.lastActionError}
            <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
        {/if}
    </div>
{/if}
