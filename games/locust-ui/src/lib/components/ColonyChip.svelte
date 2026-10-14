<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { color, showPlayer = true }: { color: Color; showPlayer?: boolean } = $props()

    const session = getGameSession()
    const colony = $derived(session.gameState.colony(color))
</script>

<span class="inline-flex items-center gap-1.5">
    <span
        class="inline-block h-3.5 w-3.5 rounded-full border border-black/60"
        style:background-color={session.colors.getUiColor(color)}
    ></span>
    {#if showPlayer}
        <PlayerName playerId={colony.playerId} />
        {#if session.gameState.isDuel}
            <span class="text-xs opacity-70">({color})</span>
        {/if}
    {:else}
        <span class="capitalize">{color}</span>
    {/if}
</span>
