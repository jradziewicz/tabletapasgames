<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { RegionLabels, ScoringCount } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { phaseText } from '$lib/utils/describe.js'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const phase = $derived(phaseText(state))
    const canUndo = $derived(
        !session.isViewingHistory &&
            (session.hasManualSelection || session.undoableAction !== undefined)
    )
    const actingColorHex = $derived(
        session.actingColor ? session.colors.getUiColor(session.actingColor) : undefined
    )
</script>

<div
    class="flex min-h-[44px] items-center justify-between gap-x-2 border-b border-[#4a3620] px-4 py-1.5 tracking-[0.06em] text-[#f1e6cf] max-sm:flex-wrap max-sm:gap-y-1 max-sm:px-2"
>
    <div class="grid min-w-0 text-[13px] max-sm:basis-full sm:text-[15px]">
        {#if session.isViewingHistory}
            <div in:fade={{ duration: 200 }}>HISTORY</div>
        {:else if state.result}
            <div in:fade={{ duration: 200 }}>END OF GAME</div>
        {:else if session.activePlayers.length === 0}
            <div in:fade={{ duration: 200 }}>{phase}</div>
        {:else}
            <div
                in:fade={{ duration: 200 }}
                class="inline-flex flex-wrap items-center gap-x-1.5 leading-tight"
            >
                {#if actingColorHex}
                    <span
                        class="inline-block h-3 w-3 rounded-sm border border-black/60"
                        style:background-color={actingColorHex}
                    ></span>
                {/if}
                {#if session.isMyTurn}
                    <span>YOUR TURN</span>
                {:else}
                    {#each session.activePlayers as player (player.id)}
                        <PlayerName playerId={player.id} capitalization="uppercase" />
                    {/each}
                {/if}
                {#if state.isDuel && session.actingColor}
                    <span class="text-[#a88d5a]">({session.actingColor.toUpperCase()})</span>
                {/if}
                <span class="text-[#c9a961]">- {phase}</span>
            </div>
        {/if}
    </div>

    <div class="flex shrink-0 items-center gap-2 max-sm:ml-auto">
        <div class="flex items-center gap-1 text-[10px] font-semibold">
            <span class="rounded border border-[#ffd166] bg-[#3a2a17] px-1.5 py-0.5 text-[#ffd166]"
                >ACTIVE {RegionLabels[state.activeRegion]}</span
            >
            <span class="rounded border border-[#4a3620] px-1.5 py-0.5 text-[#c9a961]"
                >SCORING {state.scoringsDone}/{ScoringCount}</span
            >
        </div>
        {#if canUndo}
            <button type="button" class="lc-quiet text-[13px]" onclick={() => session.undo()}
                >UNDO</button
            >
        {/if}
    </div>
</div>
