<script lang="ts">
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeHistoryAction, describeSystemAction } from '$lib/utils/history.js'

    const timeAgo = createTimeAgo()
    const session = getGameSession()

    type Entry = { id: string; playerId?: string; text: string; createdAt?: Date; system: boolean }

    const entries: Entry[] = $derived.by(() => {
        const result: Entry[] = []
        for (const action of session.actions) {
            if (action.playerId) {
                result.push({
                    id: action.id,
                    playerId: action.playerId,
                    text: describeHistoryAction(action),
                    createdAt: action.createdAt,
                    system: false
                })
                continue
            }
            const text = describeSystemAction(action)
            if (text) {
                result.push({ id: action.id, text, createdAt: action.createdAt, system: true })
            }
        }
        return result.reverse()
    })
</script>

<div
    class="flex h-full min-h-[300px] flex-col overflow-hidden rounded-lg border border-[#c9a961] bg-[#1a140c] p-2 text-left text-[#f1e6cf]"
>
    <div class="h-full w-full overflow-auto px-1 py-1">
        <ol class="relative ms-1.5 border-s border-[#3d2c1a]">
            {#each entries as entry (entry.id)}
                <li class="ms-4 mb-3">
                    <div
                        class="absolute -start-1.5 mt-1 h-3 w-3 rounded-full border border-[#1a140c] {entry.system
                            ? 'bg-[#2f6b2f]'
                            : 'bg-[#c9a961]'}"
                    ></div>
                    <div class="text-[11px] text-[#a88d5a]">
                        {entry.createdAt ? timeAgo.format(entry.createdAt) : ''}
                    </div>
                    <div class="text-sm leading-snug {entry.system ? 'text-[#b7d7a8]' : ''}">
                        {#if entry.playerId}
                            <PlayerName playerId={entry.playerId} />
                        {/if}
                        {entry.text}
                    </div>
                </li>
            {/each}
            <li class="ms-4">
                <div
                    class="absolute -start-1.5 mt-1 h-3 w-3 rounded-full border border-[#1a140c] bg-[#5a4630]"
                ></div>
                <div class="text-[11px] text-[#a88d5a]">
                    {session.game.createdAt ? timeAgo.format(session.game.createdAt) : ''}
                </div>
                <div class="text-sm text-[#e0cfae]">The game was started</div>
            </li>
        </ol>
    </div>
</div>
