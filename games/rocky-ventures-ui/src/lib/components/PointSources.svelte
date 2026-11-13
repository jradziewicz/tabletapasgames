<script lang="ts">
    import { StatKind } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Admin-only tab: where each player's points came from, from the game's own point records.
    const gameSession = getGameSession()

    const SourceNames: Record<string, string> = {
        hunt: 'Hunting',
        agreement: 'Agreements',
        pointBuy: 'Feasts',
        feastBonus: 'Feast bonus',
        grid: 'Grid',
        vpSale: 'Sold',
        finalCash: 'Final cash'
    }

    const table = $derived.by(() => {
        const state = gameSession.gameState
        const sources: string[] = []
        const rows = state.players.map((player) => {
            const totals: Record<string, number> = {}
            for (const event of state.statEvents) {
                if (event.kind !== StatKind.VictoryPoints || event.playerId !== player.playerId) continue
                const source = event.source ?? 'other'
                totals[source] = (totals[source] ?? 0) + event.amount
                if (!sources.includes(source)) sources.push(source)
            }
            const recorded = Object.values(totals).reduce((sum, amount) => sum + amount, 0)
            return { playerId: player.playerId, totals, other: player.victoryPoints - recorded, total: player.victoryPoints }
        })
        return { sources, rows, showOther: rows.some((row) => row.other !== 0) }
    })
</script>

<div class="p-3 text-sm text-[#f1e6cf]">
    <div class="mb-2 text-xs uppercase tracking-widest text-[#c9a961]">Points by source (admin only)</div>
    <table>
        <thead>
            <tr class="text-left text-[11px] uppercase tracking-wide text-[#c9a961]">
                <th class="pr-4">Player</th>
                {#each table.sources as source (source)}
                    <th class="pr-4">{SourceNames[source] ?? source}</th>
                {/each}
                {#if table.showOther}<th class="pr-4">Other</th>{/if}
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            {#each table.rows as row (row.playerId)}
                <tr>
                    <td class="pr-4 capitalize">{gameSession.getPlayerName(row.playerId)}</td>
                    {#each table.sources as source (source)}
                        <td class="pr-4 font-mono">{row.totals[source] ?? 0}</td>
                    {/each}
                    {#if table.showOther}<td class="pr-4 font-mono">{row.other}</td>{/if}
                    <td class="font-mono font-semibold">{row.total}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
