<script lang="ts">
    import { CalledGameEnding, PlayerName } from '@tabletop/frontend-components'
    import { GameResult } from '@tabletop/common'
    import { totalCredits } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CreditsIcon from './CreditsIcon.svelte'
    import GameSummaryOverlay from './GameSummaryOverlay.svelte'

    const gameSession = getGameSession()

    let summaryOpen = $state(false)

    const winningPlayerIds = $derived(gameSession.gameState.winningPlayerIds ?? [])
    const isDraw = $derived(gameSession.gameState.result === GameResult.Draw)

    const standings = $derived(
        gameSession.gameState.players
            .map((playerState) => ({
                playerId: playerState.playerId,
                credits: totalCredits(gameSession.gameState, playerState.playerId)
            }))
            .toSorted((a, b) => b.credits - a.credits)
    )

</script>

<div class="flex flex-col items-center gap-2 px-4 pt-3 pb-2 text-[#e6e9f5]">
    {#if gameSession.gameCall}
        <!-- A called or conceded game ends on the players' agreement, not on the final credits. -->
        <CalledGameEnding class="text-[16px]" />
    {:else}
        <h1 class="text-center text-[22px] font-semibold tracking-[0.02em]">
            {isDraw ? 'Game ends in a draw' : 'Stellar Ventures winner:'}
        </h1>

        {#if !isDraw && winningPlayerIds.length > 0}
            <div class="flex flex-wrap justify-center gap-2 text-[18px] font-semibold">
                {#each winningPlayerIds as playerId (playerId)}
                    <PlayerName {playerId} />
                {/each}
            </div>
        {/if}
    {/if}

    <div class="mt-2 w-full max-w-sm space-y-1 rounded-lg bg-black/20 p-3">
        {#each standings as standing (standing.playerId)}
            <div class="flex items-center justify-between text-sm">
                <PlayerName playerId={standing.playerId} />
                <span class="font-mono"><CreditsIcon />{standing.credits}</span>
            </div>
        {/each}
    </div>

    <button
        type="button"
        onclick={() => (summaryOpen = true)}
        class="mt-1 rounded-md bg-[#2f6fed] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
    >
        Game Summary
    </button>
</div>

<GameSummaryOverlay open={summaryOpen} onClose={() => (summaryOpen = false)} />
