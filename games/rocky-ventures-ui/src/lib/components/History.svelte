<script lang="ts">
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const timeAgo = createTimeAgo()
    const gameSession = getGameSession()

    const reversedActions = $derived(gameSession.actions.toReversed())
</script>

<div class="rounded-lg border border-[#c9a961] text-left p-2 h-full flex flex-col overflow-hidden min-h-[300px] bg-[#1a120b] text-[#f1e6cf]">
    <div class="overflow-auto h-full w-full text-sm">
        {#if reversedActions.length === 0}
            <div class="italic text-[#c9a961]">No actions yet.</div>
        {/if}
        {#each reversedActions as action (action.id)}
            <div class="border-b border-[#3d2c1a] py-1">
                <div class="text-[10px] text-[#c9a961]">
                    {action.createdAt ? timeAgo.format(action.createdAt) : ''}
                </div>
                <div>
                    {#if action.playerId}
                        <PlayerName playerId={action.playerId} />
                    {/if}
                    {action.type}
                </div>
            </div>
        {/each}
    </div>
</div>
