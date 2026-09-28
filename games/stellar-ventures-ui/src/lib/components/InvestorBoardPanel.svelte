<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PlayerSymbolIcons, PlayerVoteTokenIcons } from '$lib/utils/playerSymbolDisplay.js'
    import { INVESTOR_BOARD_ASPECT } from '$lib/utils/investorDisplay.js'
    import {
        CorporationDisplayNames,
        CorporationShareCertificateIcons,
        SHARE_CERTIFICATE_ASPECT
    } from '$lib/utils/corporationDisplay.js'
    import alienTechCube from '$lib/images/investor/alienTechCube.png'
    import InvestorBoard from './InvestorBoard.svelte'

    const gameSession = getGameSession()
    const players = $derived(gameSession.gameState.players)
    const activeCorporations = $derived(
        gameSession.gameState.corporations.filter((corporation) => corporation.active)
    )

    // Defaults to my own seat if I'm a player in this game, otherwise the first seat - same
    // "open on something relevant to me" idea CharterPanel uses (it defaults to the active
    // Corporation).
    let selectedPlayerId: string = $state(
        gameSession.myPlayer?.id ?? gameSession.gameState.players[0]?.playerId ?? ''
    )

    const selectedPlayerState = $derived(
        players.find((player) => player.playerId === selectedPlayerId)
    )
    const selectedPlayerColor = $derived(
        selectedPlayerId ? gameSession.colors.getPlayerColor(selectedPlayerId) : undefined
    )

    // Same portfolio calculation PlayersPanel.svelte uses for its own "Ownership" list - each
    // active Corporation this player holds at least one Share of, for the small share "plate"
    // row below the board.
    const shareHoldings = $derived.by(() => {
        if (!selectedPlayerId) return []
        return activeCorporations
            .map((corporation) => ({
                corporationId: corporation.id,
                count: corporation.shareCountForPlayer(selectedPlayerId)
            }))
            .filter(({ count }) => count > 0)
    })

    // Votes/Cubes columns are capped visually so an unusually large count still reads as a
    // column of pieces rather than an endless scroll - the exact number is always shown below it
    // too.
    const MAX_PIECES_SHOWN = 12
    function piecesShown(count: number) {
        return Math.min(Math.max(count, 0), MAX_PIECES_SHOWN)
    }
</script>

<div class="h-full overflow-y-auto p-4 text-[#e6e9f5]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        Investor Board
    </h2>

    <div class="mb-3 flex flex-wrap gap-1.5">
        {#each players as playerState (playerState.playerId)}
            {@const color = gameSession.colors.getPlayerColor(playerState.playerId)}
            <button
                type="button"
                onclick={() => (selectedPlayerId = playerState.playerId)}
                class="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs {selectedPlayerId ===
                playerState.playerId
                    ? 'border-[#2f6fed] bg-[#212845] text-white'
                    : 'border-[#3a4166] bg-[#1a1f38] text-[#a8afd1] hover:bg-[#212845]'}"
            >
                {#if PlayerSymbolIcons[color]}
                    <img src={PlayerSymbolIcons[color]} alt="" class="h-4 w-4 shrink-0 drop-shadow" />
                {/if}
                <PlayerName playerId={playerState.playerId} />
            </button>
        {/each}
    </div>

    {#if selectedPlayerState}
        <!-- Board centered, flanked by a Boardroom Votes column on the left and an Alien Tech
             Cubes column on the right - both off the board itself (unlike Frozen/Liquid Funds
             and the Action Discs, which stay on it). items-stretch makes both columns match the
             board's own height, and justify-end within each then pins its icons to the bottom -
             "the same general line" as the board's own bottom banner - rather than vertically
             centering the column as a whole. -->
        <!-- Phones: the board fills the space left between the two side columns (and the columns
             and gaps tighten) so it is legible; desktop keeps the tuned sizes noted inline. -->
        <div class="flex items-stretch justify-center gap-2 md:gap-[0.8rem]"> <!-- desktop: 20% smaller than the prior gap-4 -->
            <div class="flex w-[2.8rem] shrink-0 flex-col items-center justify-end gap-[0.15rem] md:w-[4.8rem]"> <!-- 50% bigger than the prior w-[3.2rem] -->
                {#each { length: piecesShown(selectedPlayerState.boardroomVotes) } as _, index (index)}
                    {#if selectedPlayerColor && PlayerVoteTokenIcons[selectedPlayerColor]}
                        <img
                            src={PlayerVoteTokenIcons[selectedPlayerColor]}
                            alt="Boardroom Vote"
                            class="w-[2.4rem] drop-shadow"
                        />
                    {/if}
                {/each}
            </div>

            <div class="relative min-w-0 flex-1 md:w-[35.2%] md:flex-none md:shrink-0" style="aspect-ratio: {INVESTOR_BOARD_ASPECT};"> <!-- desktop: 20% smaller than the prior 44% -->
                <InvestorBoard playerId={selectedPlayerId} />
            </div>

            <div class="flex w-[2.2rem] shrink-0 flex-col items-center justify-end gap-[0.1rem] md:w-[3.2rem]"> <!-- 20% smaller than the prior w-16 -->
                {#each { length: piecesShown(selectedPlayerState.alienTechCubes) } as _, index (index)}
                    <img src={alienTechCube} alt="Alien Technology cube" class="w-[1.6rem] drop-shadow" />
                {/each}
            </div>
        </div>

        <!-- Shares held, below the board - just the real Share Certificate art itself for each
             Corporation this player holds at least one Share of (no logo, no count text, no
             plate/border chrome around it - the certificates speak for themselves), a bigger
             overlapping fan per Corporation than the Charter's own Share stack uses. -->
        {#if shareHoldings.length > 0}
            <div class="mt-[0.8rem] flex flex-wrap justify-center gap-[1.2rem]"> <!-- 20% smaller than the prior mt-4/gap-6 -->
                {#each shareHoldings as holding (holding.corporationId)}
                    <div class="relative h-[8rem] w-[12.8rem]"> <!-- 20% smaller again, on top of the prior 20% reduction from 200x320px -->
                        {#each { length: holding.count } as _, index (index)}
                            <img
                                src={CorporationShareCertificateIcons[holding.corporationId]}
                                alt="{CorporationDisplayNames[holding.corporationId]} Share Certificate"
                                class="absolute rounded-sm shadow-lg"
                                style="
                                    height: 100%;
                                    width: auto;
                                    aspect-ratio: {SHARE_CERTIFICATE_ASPECT};
                                    left: {index * 12}%;
                                    z-index: {index};
                                "
                            />
                        {/each}
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>
