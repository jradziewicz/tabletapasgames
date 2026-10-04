<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionType,
        MAX_CARGO,
        eligibleBoardroomBattleCorporationIds,
        effectiveMiningCapacityForCorporation,
        dividendPayoutPerShare,
        taxDueForCorporation,
        CorporationStatus,
        type CorporationId
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PlayerSymbolIcons, PlayerVoteTokenIcons } from '$lib/utils/playerSymbolDisplay.js'
    import {
        CorporationDisplayNames,
        CorporationLogoIcons,
        CorporationLogoAspect
    } from '$lib/utils/corporationDisplay.js'
    import CorporationInfoBox from './CorporationInfoBox.svelte'

    const gameSession = getGameSession()

    // "You are ..." for the viewer, "<name> is ..." for anyone else (PlayerName renders "You").
    function isOrAre(playerId: string | undefined) {
        return playerId !== undefined && playerId === gameSession.myPlayer?.id ? 'are' : 'is'
    }

    const currentVoterId = $derived(gameSession.gameState.boardroomBattleCurrentVoterId)
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === currentVoterId)
    const currentVoter = $derived(
        gameSession.gameState.players.find((p) => p.playerId === currentVoterId)
    )
    const myVotesAvailable = $derived(currentVoter?.boardroomVotes ?? 0)

    const canVote = $derived(gameSession.validActionTypes.includes(ActionType.PlaceBoardroomVote))
    const canDecline = $derived(
        gameSession.validActionTypes.includes(ActionType.DeclineBoardroomVote)
    )

    // Tie-break sub-step (rulebook page 18: "Director chooses in case of a tie") - the vote ended
    // with more than one Corporation tied for the most Votes, and only the Director may pick
    // among just those. boardroomBattleCurrentVoterId is already undefined by the time this is
    // set (voting itself is over), so isMe above is never true here - iAmAllowedToAct below is
    // what actually gates this sub-step's controls.
    const tiedCorporationIds = $derived(gameSession.gameState.boardroomBattleTiedCorporationIds ?? [])
    const isTieBreak = $derived(tiedCorporationIds.length > 1)
    const isDirector = $derived(
        !!gameSession.myPlayer && gameSession.myPlayer.id === gameSession.gameState.directorPlayerId
    )
    const canChoose = $derived(
        gameSession.validActionTypes.includes(ActionType.ChooseBoardroomBattleCorporation)
    )
    // Whichever sub-step is live, this is "can I click a Corporation card right now" - Voting's
    // own myVotesAvailable > 0 guard doesn't apply to a tie-break pick, which isn't spending
    // anything.
    const canAct = $derived(
        isTieBreak ? isDirector && canChoose : isMe && canVote && myVotesAvailable > 0
    )
    // ...and this is "is it this panel showing controls/waiting-text for me at all", same
    // distinction one level up - the Director during a tie-break, the current voter otherwise.
    const iAmAllowedToAct = $derived(isTieBreak ? isDirector : isMe)

    // Every Corporation still eligible this Boardroom Battle - active, with a Share left to
    // issue, and not Fine Print's one-time exemption (see operations/boardroomBattle.ts). During
    // a tie-break, only the tied Corporations themselves are shown - there's nothing to decide
    // about the rest.
    const eligibleCorporationIds = $derived(
        eligibleBoardroomBattleCorporationIds(gameSession.gameState)
    )
    // Sorted highest Mining Capacity to lowest (per the co-designer's own preference), rather
    // than the shared CorporationId enum order every other Corporation listing in this UI uses -
    // Boardroom Battle is specifically about which Corporation is worth fighting over, so leading
    // with the strongest candidate reads better here than an arbitrary fixed order.
    const cardCorporationIds = $derived(
        [...(isTieBreak ? tiedCorporationIds : eligibleCorporationIds)].sort(
            (a, b) =>
                effectiveMiningCapacityForCorporation(gameSession.gameState, b) -
                effectiveMiningCapacityForCorporation(gameSession.gameState, a)
        )
    )

    // Votes already cast THIS Battle (state.boardroomBattleVotes, cleared once it resolves),
    // grouped by Corporation then by voter - each entry is one player's one placement (a player
    // only ever appears once per Corporation per Battle, since voting is a single pass with no
    // second turns - see nextBoardroomVoterId).
    const votesByCorporation = $derived.by(() => {
        const byCorp = new Map<CorporationId, { playerId: string; amount: number }[]>()
        for (const vote of gameSession.gameState.boardroomBattleVotes ?? []) {
            const list = byCorp.get(vote.corporationId) ?? []
            list.push({ playerId: vote.playerId, amount: vote.amount })
            byCorp.set(vote.corporationId, list)
        }
        return byCorp
    })

    function tokenIconFor(playerId: string) {
        const color = gameSession.colors.getPlayerColor(playerId)
        return PlayerVoteTokenIcons[color]
    }

    // Same Private/Minor/Major label CorporationStatsTable.svelte and PlayersPanel.svelte use -
    // purely a display label derived from issued Share count, not a rules branch.
    function statusLabel(status: CorporationStatus) {
        switch (status) {
            case CorporationStatus.Major:
                return 'Major'
            case CorporationStatus.Minor:
                return 'Minor'
            default:
                return 'Private'
        }
    }

    // The current voter's own queued (not-yet-submitted) pick - built up entirely client-side by
    // repeated clicks, exactly like OrderShipPanel's selectedLevels queue. Only one Corporation
    // can receive Votes per turn (PlaceBoardroomVote takes a single corporationId), so clicking a
    // different Corporation than the one already queued switches the queue to it rather than
    // adding to both.
    let queuedCorporationId: CorporationId | undefined = $state()
    let queuedAmount = $state(0)

    async function clickCorporation(corporationId: CorporationId) {
        if (!canAct) return
        if (isTieBreak) {
            // A tie-break pick is a single, immediate choice - no click-to-queue-then-confirm
            // step needed (unlike Voting's variable amount), so clicking a tied Corporation
            // submits the real ChooseBoardroomBattleCorporation action right away.
            await gameSession.chooseBoardroomBattleCorporation(corporationId)
            return
        }
        if (queuedCorporationId !== corporationId) {
            queuedCorporationId = corporationId
            queuedAmount = 1
            return
        }
        if (queuedAmount < myVotesAvailable) {
            queuedAmount += 1
        }
    }

    function clearQueue() {
        queuedCorporationId = undefined
        queuedAmount = 0
    }

    // Confirms whatever's queued - or, if nothing is (myVotesAvailable spent down to 0, or the
    // voter simply chooses not to spend any this turn), acts as Pass instead. Folds what used to
    // be two separate buttons (Done Adding Votes / Pass) into one, since "confirm with nothing
    // queued" and "pass" both mean the same thing here - see the button below.
    async function confirmSelection() {
        if (queuedCorporationId && queuedAmount > 0) {
            const corporationId = queuedCorporationId
            const amount = queuedAmount
            clearQueue()
            await gameSession.placeBoardroomVote(corporationId, amount)
            return
        }
        clearQueue()
        await gameSession.declineBoardroomVote()
    }

    // If the turn moves on (a different voter, voting itself ends, or the tie-break resolves)
    // before confirming, drop anything still just queued - nothing real was submitted for it.
    $effect(() => {
        if ((queuedCorporationId || queuedAmount > 0) && !canAct) {
            queuedCorporationId = undefined
            queuedAmount = 0
        }
    })

    // Every player's own remaining-Votes box, shown side by side (players list order - starting
    // with, and proceeding clockwise from, the Director - see operations/boardroomBattle.ts) so
    // the whole table's position is visible at once, not just whoever's turn it is right now. The
    // current voter's own count previews their still-queued amount (see queuedAmount above) as
    // already spent - tokens visually move out of their box above and into whichever
    // Corporation's box is queued (see voteMarkers there), rather than just a number ticking down.
    // hasVoted only tracks an actual cast vote this Battle (state.boardroomBattleVotes) - a player
    // who Declined instead has no such entry, so their box shows no badge either way.
    const playerVoteInfo = $derived(
        gameSession.gameState.players.map((player) => {
            const castVote = (gameSession.gameState.boardroomBattleVotes ?? []).find(
                (vote) => vote.playerId === player.playerId
            )
            return {
                playerId: player.playerId,
                isDirector: player.playerId === gameSession.gameState.directorPlayerId,
                isActive: player.playerId === currentVoterId,
                hasVoted: !!castVote,
                // Which Corporation this player's cast Vote actually went to - shown as that
                // Corporation's own logo inside the Voted badge below, so at a glance you can see
                // not just who's voted but who they're backing.
                votedForCorporationId: castVote?.corporationId,
                remaining:
                    player.playerId === currentVoterId
                        ? player.boardroomVotes - queuedAmount
                        : player.boardroomVotes
            }
        })
    )

    const activeCorporations = $derived(
        gameSession.gameState.corporations.filter((corporation) => corporation.active)
    )

    // Same "what does this player hold, across every active Corporation" summary
    // PlayersPanel.svelte's own Ownership section computes, reused here as a compact
    // logos-and-counts strip on each player's own Vote box rather than a full breakdown - so a
    // voter's leverage over each Corporation is visible right next to their remaining Votes.
    function shareHoldingsForPlayer(playerId: string) {
        return activeCorporations
            .map((corporation) => ({
                corporationId: corporation.id,
                count: corporation.shareCountForPlayer(playerId),
                totalShares: corporation.shares.length,
                isPresident: corporation.getPresidentPlayerId() === playerId
            }))
            .filter(({ count }) => count > 0)
    }
</script>

<div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
    <div class="text-sm">
        {#if isTieBreak}
            The vote ended in a tie -
            <PlayerName playerId={gameSession.gameState.directorPlayerId} />
            (the Director) must choose which Corporation issues a Share.
        {:else}
            {#if currentVoterId}
                <PlayerName playerId={currentVoterId} />
            {/if}
            {isOrAre(currentVoterId)} voting in the Boardroom Battle
        {/if}
    </div>

    <div class="grid grid-cols-2 gap-2">
        {#each cardCorporationIds as corporationId (corporationId)}
            {@const corporation = gameSession.gameState.getCorporation(corporationId)}
            {@const miningCapacity = effectiveMiningCapacityForCorporation(
                gameSession.gameState,
                corporationId
            )}
            {@const currentPayout = dividendPayoutPerShare(
                corporation.cargo,
                miningCapacity,
                corporation.status
            )}
            <!-- CARGO still incoming from Ships already Ordered but not yet Delivered (next
                 Administration Round - see deliverOrderedShips), and the per-Share Payout that
                 Delivery would then produce - same math OrderShipPanel's own incomingCargo/
                 futurePayout use, just with no freshly-queued Ships to add since nothing is being
                 ordered from this panel. -->
            {@const pendingCargoLevelsSum = corporation.orderedShipLevels.reduce(
                (sum, level) => sum + level,
                0
            )}
            {@const futureCargo = Math.min(MAX_CARGO, corporation.cargo + pendingCargoLevelsSum)}
            {@const cargoGain = futureCargo - corporation.cargo}
            {@const futurePayout = dividendPayoutPerShare(futureCargo, miningCapacity, corporation.status)}
            {@const taxDue = gameSession.gameState.usesTaxes
                ? taxDueForCorporation(gameSession.gameState, corporationId)
                : undefined}
            {@const cast = votesByCorporation.get(corporationId) ?? []}
            {@const isQueuedHere = queuedCorporationId === corporationId}
            {@const clickable = canAct}
            <!-- Tokens already cast by earlier voters this Battle, then (Voting only - a
                 tie-break pick isn't a Vote, so it gets no token preview here, just the button's
                 own ring below) this voter's own still-queued preview (ringed, appended last) -
                 fed into CorporationInfoBox's voteMarkers row exactly like Expand Network feeds
                 it remainingOutposts, so a vote visually "slots into" the Corporation's own box
                 the same way an Outpost does. -->
            {@const voteMarkers = [
                ...cast.flatMap((vote) =>
                    Array.from({ length: vote.amount }, (_, i) => ({
                        key: vote.playerId + '-' + i,
                        src: tokenIconFor(vote.playerId)
                    }))
                ),
                ...(isQueuedHere && !isTieBreak
                    ? Array.from({ length: queuedAmount }, (_, i) => ({
                          key: 'queued-' + i,
                          src: tokenIconFor(currentVoterId ?? ''),
                          queued: true
                      }))
                    : [])
            ]}
            <!-- max-sm:flex/h-full only below sm: - lets CorporationInfoBox's own matching
                 max-sm: h-full stretch it to this row's tallest card on a narrow phone, where
                 grid-cols-2 never drops to 1 column. At sm: and up this is a plain block button
                 (w-full still - the grid cell itself, not this button, controls desktop width),
                 the same as before that mobile fix. -->
            <button
                type="button"
                disabled={!clickable}
                onclick={() => clickCorporation(corporationId)}
                class="block w-full max-sm:flex max-sm:h-full rounded-lg text-left transition
                    {clickable ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                    {isQueuedHere ? 'ring-2 ring-[#3ddc84]' : ''}"
            >
                <CorporationInfoBox
                    {corporationId}
                    treasury={corporation.treasury}
                    {miningCapacity}
                    cargo={corporation.cargo}
                    {cargoGain}
                    {currentPayout}
                    {futurePayout}
                    {taxDue}
                    availableShareCount={corporation.availableShareCount}
                    statusLabel={statusLabel(corporation.status)}
                    {voteMarkers}
                    hasNotSignedAgreement={!corporation.agreement}
                />
            </button>
        {/each}

        {#if cardCorporationIds.length === 0}
            <div class="col-span-2 text-xs text-[#7f88ad]">
                No Corporation has a Share left to issue - this Boardroom Battle has nothing to
                vote on.
            </div>
        {/if}
    </div>

    <!-- Every player's own remaining Votes, shown side by side as individual tokens (same
         "supply as pieces" treatment CorporationInfoBox gives Outposts) rather than just a
         number - the active voter's box is ringed and its count previews the still-queued amount
         as already spent, so tokens visually move out of it and into whichever Corporation's box
         is queued above. -->
    <div class="flex flex-wrap gap-2">
        {#each playerVoteInfo as info (info.playerId)}
            {@const shareHoldings = shareHoldingsForPlayer(info.playerId)}
            <div
                class="min-w-[140px] flex-1 rounded-lg border {info.isActive
                    ? 'border-[#4f7cf2]'
                    : 'border-[#2a3155]'} bg-[#12162b] px-3 py-2"
            >
                <div class="flex items-center justify-between gap-2">
                    <span class="flex items-center gap-1.5 text-xs font-semibold">
                        {#if PlayerSymbolIcons[gameSession.colors.getPlayerColor(info.playerId)]}
                            <img
                                src={PlayerSymbolIcons[gameSession.colors.getPlayerColor(info.playerId)]}
                                alt="Player token"
                                class="h-3.5 w-3.5 shrink-0"
                            />
                        {:else}
                            <span
                                class="h-2.5 w-2.5 shrink-0 rounded-full"
                                style:background-color={gameSession.colors.getPlayerBgColorValue(
                                    info.playerId
                                )}
                            ></span>
                        {/if}
                        <PlayerName playerId={info.playerId} />
                    </span>
                </div>
                <div class="mt-1 flex flex-wrap gap-1">
                    {#if info.isDirector}
                        <span
                            class="rounded-full border border-[#e0b23d] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#f0d27a]"
                        >
                            Director
                        </span>
                    {/if}
                    {#if info.isActive}
                        <span
                            class="rounded-full border border-[#4f7cf2] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9db4f5]"
                        >
                            Voting
                        </span>
                    {/if}
                    {#if info.hasVoted && info.votedForCorporationId}
                        {@const votedLogoAspect = CorporationLogoAspect[info.votedForCorporationId] ?? 1}
                        <span
                            class="flex items-center gap-1 rounded-full border border-[#3ddc84] py-0.5 pl-1 pr-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#8fe0a8]"
                            title="Voted for {CorporationDisplayNames[info.votedForCorporationId]}"
                        >
                            <img
                                src={CorporationLogoIcons[info.votedForCorporationId]}
                                alt={CorporationDisplayNames[info.votedForCorporationId]}
                                class="h-3 shrink-0 drop-shadow"
                                style="width: {12 * votedLogoAspect}px;"
                            />
                            Voted
                        </span>
                    {/if}
                </div>
                <div class="mt-1.5 flex flex-wrap items-center gap-1">
                    {#if info.remaining > 0}
                        {#each { length: info.remaining } as _, i (i)}
                            <img
                                src={tokenIconFor(info.playerId)}
                                alt="Vote"
                                class="h-5 w-5 shrink-0 object-contain drop-shadow"
                            />
                        {/each}
                    {:else}
                        <span class="text-[10px] text-[#7f88ad]">None left</span>
                    {/if}
                </div>
                {#if shareHoldings.length > 0}
                    <!-- Compact "what this player already holds" strip - a small logo plus their
                         Share count per Corporation they own into, so their leverage/incentive in
                         this Battle reads at a glance next to their remaining Votes (full detail,
                         with % owned, stays in PlayersPanel.svelte). -->
                    <div class="mt-1.5 flex flex-wrap items-center gap-2 border-t border-[#232945] pt-1.5">
                        {#each shareHoldings as holding (holding.corporationId)}
                            {@const aspect = CorporationLogoAspect[holding.corporationId] ?? 1}
                            <span
                                class="flex items-center gap-1"
                                title="{CorporationDisplayNames[holding.corporationId]}: {holding.count}/{holding.totalShares} Shares{holding.isPresident
                                    ? ' (President)'
                                    : ''}"
                            >
                                <img
                                    src={CorporationLogoIcons[holding.corporationId]}
                                    alt={CorporationDisplayNames[holding.corporationId]}
                                    class="h-4 shrink-0 drop-shadow"
                                    style="width: {16 * aspect}px;"
                                />
                                <span class="text-[10px] font-semibold text-[#c3c9e6]">
                                    ×{holding.count}
                                </span>
                                {#if holding.isPresident}
                                    <span class="text-[9px] font-bold text-[#8fe0a8]">P</span>
                                {/if}
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    {#if !iAmAllowedToAct}
        <div class="text-xs text-[#7f88ad]">
            {#if isTieBreak}
                Waiting on <PlayerName playerId={gameSession.gameState.directorPlayerId} /> (the Director)
                to break the tie...
            {:else}
                Waiting on {#if currentVoterId}<PlayerName playerId={currentVoterId} />{:else}the next voter{/if}...
            {/if}
        </div>
    {/if}

    {#if isTieBreak && iAmAllowedToAct}
        <div class="border-t border-[#232945] pt-2 text-xs text-[#7f88ad]">
            Click one of the tied Corporations above to choose it.
        </div>
    {/if}

    {#if !isTieBreak && iAmAllowedToAct}
        <div class="flex items-center gap-2 border-t border-[#232945] pt-2">
            <button
                type="button"
                disabled={queuedCorporationId ? queuedAmount === 0 : !canDecline}
                onclick={confirmSelection}
                class="rounded-md bg-[#2f6fed] px-2.5 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-50"
            >
                {queuedCorporationId ? 'Done Adding Votes' : 'Pass (place no Votes)'}
            </button>
            <button
                type="button"
                disabled={!queuedCorporationId}
                onclick={clearQueue}
                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845] disabled:opacity-50"
            >
                Clear
            </button>
        </div>
    {/if}

    {#if gameSession.lastActionError}
        <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
    {/if}
</div>
