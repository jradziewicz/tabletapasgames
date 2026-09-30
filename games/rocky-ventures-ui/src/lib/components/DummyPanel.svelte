<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { DummyColor, DummyName } from '$lib/utils/dummyDisplay.js'

    const gameSession = getGameSession()
    const dummy = $derived(gameSession.gameState.dummy)
</script>

{#if dummy}
    <div class="rounded-lg border px-3 py-2 text-[#f1e6cf]" style="border-color: #2a3155; background-color: #141a33;">
        <div class="flex items-center gap-2">
            <span class="inline-block h-3 w-3 rounded-full border border-black/50" style="background-color: {DummyColor}"></span>
            <span class="font-semibold">{DummyName}</span>
            <span class="ml-auto text-sm">{`$${dummy.money}`}</span>
            <span class="text-sm">🏆 {dummy.victoryPoints}</span>
        </div>
        <div class="mt-1 flex flex-wrap gap-x-3 text-[11px]" style="color: #7f88ad;">
            <span>Weapon {dummy.weaponLevel} / Tool {dummy.toolLevel}</span>
            <span>Tax cards {dummy.tuckedCardIds.length}</span>
            <span>Next: {dummy.nextAction === 'tax' ? 'Tax' : dummy.nextBump === 'weapon' ? 'Weapon +1' : 'Tool +1'}</span>
            {#if dummy.lastAction}
                <span>Last: {dummy.lastAction}</span>
            {/if}
        </div>
    </div>
{/if}
