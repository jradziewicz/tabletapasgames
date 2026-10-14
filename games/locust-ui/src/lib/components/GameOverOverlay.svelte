<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { colonyVigorTotal } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ColonyChip from './ColonyChip.svelte'

    let { onclose }: { onclose: () => void } = $props()

    const session = getGameSession()
    const state = $derived(session.gameState)
    const rankedPlayers = $derived(
        [...state.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    )

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') onclose()
    }
</script>

<svelte:window {onkeydown} />

<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    role="presentation"
    onclick={onclose}
>
    <div
        class="over-card max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border-2 border-[#c9a961] bg-[#22170e] p-6 text-[#f1e6cf] shadow-2xl"
        role="presentation"
        onclick={(event) => event.stopPropagation()}
    >
        <div class="mb-1 text-center text-xs uppercase tracking-[0.4em] text-[#c9a961]">
            Game over
        </div>
        <div class="mb-5 text-center text-3xl font-black text-[#ffd166]">
            {state.result === 'Draw' ? 'Shared victory:' : 'Winner:'}
            {#each state.winningPlayerIds as playerId, index (playerId)}
                {#if index > 0}<span class="text-[#c9a961]"> &amp; </span>{/if}<PlayerName
                    {playerId}
                />
            {/each}
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-right text-[11px] uppercase tracking-wide text-[#c9a961]">
                        <th class="pr-3 pb-2 text-left">Player</th>
                        <th class="pr-3 pb-2 text-left">Colour</th>
                        <th class="pr-3 pb-2">Vigor</th>
                        <th class="pr-3 pb-2">Sets</th>
                        <th class="pr-3 pb-2">Supply</th>
                        <th class="pb-2">Final</th>
                    </tr>
                </thead>
                <tbody>
                    {#each rankedPlayers as player (player.playerId)}
                        {@const winner = state.winningPlayerIds.includes(player.playerId)}
                        {#each state.coloniesOf(player.playerId) as colony, index (colony.color)}
                            {@const countsVigor =
                                !state.isDuel || player.vigorColor === colony.color}
                            {@const countsBonus =
                                !state.isDuel || player.vigorColor !== colony.color}
                            <tr
                                class="text-right {index === 0
                                    ? 'border-t border-[#4a3620]'
                                    : ''} {winner ? 'font-bold text-[#ffd166]' : ''}"
                            >
                                <td class="py-2 pr-3 text-left">
                                    {#if index === 0}<PlayerName playerId={player.playerId} />{/if}
                                </td>
                                <td class="py-2 pr-3 text-left"
                                    ><ColonyChip color={colony.color} showPlayer={false} /></td
                                >
                                <td class="py-2 pr-3 {countsVigor ? '' : 'line-through opacity-40'}"
                                    >{colonyVigorTotal(state, colony.color)}</td
                                >
                                <td class="py-2 pr-3 {countsBonus ? '' : 'line-through opacity-40'}"
                                    >+{colony.finalScore?.setPoints ?? 0}</td
                                >
                                <td class="py-2 pr-3 {countsBonus ? '' : 'line-through opacity-40'}"
                                    >+{colony.finalScore?.supplyPoints ?? 0}</td
                                >
                                <td class="py-2 text-lg"
                                    >{index === 0 ? (player.score ?? 0) : ''}</td
                                >
                            </tr>
                        {/each}
                    {/each}
                </tbody>
            </table>
        </div>
        {#if state.isDuel}
            <p class="mt-3 text-center text-[12px] text-[#a88d5a]">
                Duel: each player counts one colour's Vigor and the other colour's Bonus Points.
            </p>
        {/if}
        <div class="mt-5 text-center">
            <button type="button" onclick={onclose} class="lc-quiet">Close</button>
        </div>
    </div>
</div>

<style>
    .over-card {
        animation: over-in 500ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
    }
    @keyframes over-in {
        from {
            opacity: 0;
            transform: translateY(30px) scale(0.92);
        }
        to {
            opacity: 1;
            transform: none;
        }
    }
</style>
