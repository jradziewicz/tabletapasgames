<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        ids,
        strip,
        imageFor
    }: { ids: string[]; strip: number; imageFor: (cardId: string) => string | undefined } = $props()

    const gameSession = getGameSession()
</script>

{#each ids as id, index (id)}
    {@const url = imageFor(id)}
    <button
        type="button"
        class="absolute top-0 block h-full w-full overflow-hidden rounded-md border border-[#8a6d3b] shadow-md"
        style="left: {-(index + 1) * strip}px; z-index: {Math.max(1, 9 - index)};"
        title="Tucked under card I"
        onclick={() => gameSession.zoomCard(id, url)}
    >
        {#if url}
            <img src={url} alt={id} class="block h-full w-full object-cover" draggable="false" />
        {:else}
            <span class="block h-full w-full bg-[#3d2c1a] text-[10px]">{id}</span>
        {/if}
    </button>
{/each}
