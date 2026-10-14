<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { colonyBonusTotal, colonyVigorTotal } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ColonyChip from './ColonyChip.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)

    const TokenFill: Record<string, string> = {
        grey: '#8d8d8d',
        orange: '#d98a10',
        cream: '#efe6c8',
        blue: '#58c3d4',
        red: '#f0907a',
        yellow: '#f2cf6b',
        green: '#55c25a'
    }
</script>

<div class="flex flex-col gap-3 p-3 text-[#2b2418]">
    {#each state.turnManager.turnOrder as playerId (playerId)}
        {@const player = state.getPlayerState(playerId)}
        <div
            class="rounded-lg border-2 bg-[#f6efdf] p-3"
            class:border-[#7165ad]={state.activePlayerIds.includes(playerId)}
            class:border-transparent={!state.activePlayerIds.includes(playerId)}
        >
            <div class="mb-2 flex items-center justify-between">
                <PlayerName {playerId} additionalClasses="font-semibold" />
                {#if player.score !== undefined}
                    <span class="text-lg font-bold">{player.score} pts</span>
                {/if}
            </div>
            {#each state.coloniesOf(playerId) as colony (colony.color)}
                <div class="mb-2 rounded-md bg-white/60 p-2 text-sm">
                    <div class="flex items-center justify-between">
                        <ColonyChip color={colony.color} showPlayer={false} />
                        <span class="font-bold">{colony.vigor} VP</span>
                    </div>
                    <div class="mt-1 flex gap-3 text-xs">
                        <span title="Discs in your supply">Supply {colony.supply}</span>
                        <span title="Dead discs in the general pool">Dead {colony.dead}</span>
                        <span title="Discs on the board">Board {state.board.discsOfColor(colony.color)}</span>
                    </div>
                    {#if colony.tokens.length > 0}
                        <div class="mt-1 flex flex-wrap gap-1">
                            {#each colony.tokens as token, index (index)}
                                <span
                                    class="inline-block h-4 w-4 rounded-full border border-black/50"
                                    style:background-color={TokenFill[token] ?? '#999'}
                                    title="{token} bonus token"
                                ></span>
                            {/each}
                        </div>
                    {/if}
                    {#if colony.finalScore}
                        <div class="mt-1 text-xs">
                            Vigor {colonyVigorTotal(state, colony.color)} · Bonus {colonyBonusTotal(state, colony.color)}
                            (sets {colony.finalScore.setPoints}, supply {colony.finalScore.supplyPoints})
                            {#if player.vigorColor}
                                · counts {player.vigorColor === colony.color ? 'Vigor' : 'Bonus'}
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/each}
</div>
