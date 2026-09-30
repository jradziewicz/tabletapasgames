<script lang="ts">
    import { RegionNames, ScourgeDefinitionsById, type RegionId } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { scourgeImageUrl } from '$lib/utils/scourgeImages.js'

    let {
        region,
        highlightId,
        onclose
    }: { region: RegionId; highlightId?: string; onclose: () => void } = $props()

    const gameSession = getGameSession()
    const scourges = $derived(gameSession.gameState.board.scourgesByRegion[region] ?? [])

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            onclose()
        }
    }
</script>

<svelte:window {onkeydown} />

<div
    class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/75"
    role="presentation"
    onclick={onclose}
>
    <div class="text-lg font-semibold text-[#f1e6cf]">{RegionNames[region]}</div>
    <div class="flex max-w-[95vw] flex-wrap items-center justify-center gap-4">
        {#each scourges as scourge, index (scourge.scourgeId)}
            {@const url = scourgeImageUrl(scourge.scourgeId)}
            {@const definition = ScourgeDefinitionsById[scourge.scourgeId]}
            <div class="scourge-card flex flex-col items-center gap-1" style="animation-delay: {index * 90}ms;">
                {#if url}
                    <img
                        src={url}
                        alt={definition?.name ?? scourge.scourgeId}
                        class="max-h-[60vh] w-auto rounded-xl border-2 shadow-2xl"
                        style="border-color: {scourge.scourgeId === highlightId ? '#ff5a4f' : '#c9a961'}; box-shadow: {scourge.scourgeId === highlightId ? '0 0 28px 8px rgba(255, 90, 79, 0.85)' : 'none'};"
                        draggable="false"
                    />
                {/if}
                <div class="text-sm text-[#f1e6cf]">
                    {#if scourge.scourgeId === highlightId}<strong class="text-[#ff8a80]">NEW · </strong>{/if}Level {scourge.level}
                    {#if scourge.hits > 0}
                        · {scourge.hits} hit{scourge.hits === 1 ? '' : 's'}
                    {/if}
                </div>
            </div>
        {:else}
            <div class="text-[#f1e6cf]">No scourges here.</div>
        {/each}
    </div>
</div>

<style>
    .scourge-card {
        animation: scourge-in 320ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
    }
    @keyframes scourge-in {
        from {
            opacity: 0;
            transform: translateY(24px) scale(0.85);
        }
        to {
            opacity: 1;
            transform: none;
        }
    }
</style>
