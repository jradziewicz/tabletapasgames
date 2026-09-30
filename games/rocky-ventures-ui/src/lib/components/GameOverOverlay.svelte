<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { endTriggers, finalScores, tableWinners } from '@tabletop/rocky-ventures'
    import { DummyPlayerId } from '@tabletop/rocky-ventures'
    import { DummyColor, DummyName } from '$lib/utils/dummyDisplay.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { onclose }: { onclose: () => void } = $props()

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const scores = $derived([...finalScores(gameState)].sort((left, right) => right.total - left.total))
    const tableWinnerIds = $derived(tableWinners(gameState))
    // From the table, not the site result: a dummy win is recorded on the site as a draw of the real players
    const isDraw = $derived(tableWinnerIds.length > 1)

    function pad(value: number): string {
        return String(value).padStart(2, '0')
    }

    function savePlaytest() {
        const now = new Date()
        const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
        const players = gameSession.game.players.map((player) => ({
            id: player.id,
            name: player.name,
            color: gameState.findPlayerState(player.id)?.color
        }))
        const report = {
            format: 'rocky-playtest-1',
            exportedAt: now.toISOString(),
            game: { id: gameSession.game.id, name: gameSession.game.name, players },
            turnOrder: gameState.turnManager.turnOrder,
            rounds: Math.round(gameState.turnManager.series.length / gameState.turnManager.turnOrder.length),
            endTriggers: endTriggers(gameState),
            finalScores: finalScores(gameState),
            winners: gameState.winningPlayerIds,
            dummyWon: gameState.dummy?.won === true,
            state: gameState.dehydrate()
        }
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `rocky-playtest-${stamp}.json`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            onclose()
        }
    }
</script>

<svelte:window {onkeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="presentation" onclick={onclose}>
    <div
        class="over-card max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border-2 border-[#c9a961] bg-[#22170e] p-6 text-[#f1e6cf] shadow-2xl"
        role="presentation"
        onclick={(event) => event.stopPropagation()}
    >
        <div class="mb-1 text-center text-xs uppercase tracking-[0.4em] text-[#c9a961]">Game over</div>
        <div class="mb-5 text-center text-3xl font-black text-[#ffd166]">
            {#if isDraw}
                Draw:
            {:else}
                Winner:
            {/if}
            {#each tableWinnerIds as playerId, index (playerId)}
                {#if index > 0}<span class="text-[#c9a961]"> & </span>{/if}{#if playerId === DummyPlayerId}{DummyName}{:else}<PlayerName
                        {playerId}
                    />{/if}
            {/each}
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-right text-[11px] uppercase tracking-wide text-[#c9a961]">
                        <th class="pb-2 pr-3 text-left">Player</th>
                        <th class="pb-2 pr-3">VP</th>
                        <th class="pb-2 pr-3">Cash</th>
                        <th class="pb-2 pr-3">Shares</th>
                        <th class="pb-2 pr-3">Total cash</th>
                        <th class="pb-2 pr-3">Cash ÷ 5</th>
                        <th class="pb-2">Final</th>
                    </tr>
                </thead>
                <tbody>
                    {#each scores as score (score.playerId)}
                        {@const isDummy = score.playerId === DummyPlayerId}
                        {@const winner = tableWinnerIds.includes(score.playerId)}
                        <tr class="border-t border-[#4a3620] text-right {winner ? 'font-bold text-[#ffd166]' : ''}">
                            <td class="flex items-center gap-2 py-2 pr-3 text-left">
                                <span
                                    class="inline-block h-3 w-3 rounded-full border border-black/50"
                                    style="background-color: {isDummy ? DummyColor : gameSession.colors.getPlayerUiColor(score.playerId)}"
                                ></span>
                                {#if isDummy}{DummyName}{:else}<PlayerName playerId={score.playerId} />{/if}
                            </td>
                            <td class="py-2 pr-3">{score.victoryPoints}</td>
                            <td class="py-2 pr-3">{`$${score.money}`}</td>
                            <td class="py-2 pr-3">+{`$${score.shareValue}`}</td>
                            <td class="py-2 pr-3">{`$${score.money + score.shareValue}`}</td>
                            <td class="py-2 pr-3">+{score.conversionVictoryPoints}</td>
                            <td class="py-2 text-lg">{score.total}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
        <div class="mt-5 text-center">
            <button
                type="button"
                onclick={savePlaytest}
                class="rv-btn rv-primary mr-2"
            >
                Save playtest
            </button>
            <button type="button" onclick={onclose} class="rv-quiet">Close</button>
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
