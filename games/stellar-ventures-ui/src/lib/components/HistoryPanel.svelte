<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const actions = $derived(gameSession.actions)

    const OMIT_KEYS = new Set([
        'id',
        'gameId',
        'source',
        'type',
        'playerId',
        'undoPatch',
        'forwardPatch',
        'index',
        'simultaneousGroupId',
        'revealsInfo',
        'skipOptimisticExecution',
        'createdAt',
        'updatedAt'
    ])

    // "ExpandNetwork" -> "Expand Network". Every action type reads this way rather than needing
    // a per-type human sentence - matches the generic-but-readable approach the rest of this
    // "ugly but playable" milestone already uses (see ActionPanel's own JSON fallback).
    function formatType(type: string) {
        return type.replace(/([a-z])([A-Z])/g, '$1 $2')
    }

    function extraFields(action: Record<string, unknown>) {
        return Object.entries(action).filter(
            ([key, value]) => !OMIT_KEYS.has(key) && value !== undefined
        )
    }
</script>

<div class="h-full overflow-y-auto p-4 text-[#e6e9f5]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">History</h2>

    {#if actions.length === 0}
        <div class="text-xs text-[#7f88ad]">No actions yet.</div>
    {:else}
        <div class="space-y-1">
            {#each actions as action, index (action.id)}
                {@const fields = extraFields(action as unknown as Record<string, unknown>)}
                <div class="rounded-md bg-black/20 px-2.5 py-1.5 text-xs">
                    <div class="flex items-center justify-between">
                        <span class="font-semibold">{index + 1}. {formatType(action.type)}</span>
                        <span class="text-[#7f88ad]">
                            {#if action.playerId}
                                <PlayerName playerId={action.playerId} />
                            {:else}
                                System
                            {/if}
                        </span>
                    </div>
                    {#if fields.length > 0}
                        <div class="mt-0.5 flex flex-wrap gap-x-3 text-[#7f88ad]">
                            {#each fields as [key, value] (key)}
                                <span>{key}: {JSON.stringify(value)}</span>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>
