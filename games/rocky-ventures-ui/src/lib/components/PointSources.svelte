<script lang="ts">
    import { StatKind } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Admin view only: where a player's points came from, from the game's own point records.
    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()

    const SourceNames: Record<string, string> = {
        hunt: 'Hunting',
        agreement: 'Agreements',
        pointBuy: 'Feasts',
        grid: 'Grid',
        vpSale: 'Sold',
        finalCash: 'Final cash'
    }

    const parts = $derived.by(() => {
        const totals = new Map<string, number>()
        for (const event of gameSession.gameState.statEvents) {
            if (event.kind !== StatKind.VictoryPoints || event.playerId !== playerId) continue
            const source = event.source ?? 'other'
            totals.set(source, (totals.get(source) ?? 0) + event.amount)
        }
        const recorded = [...totals.values()].reduce((sum, amount) => sum + amount, 0)
        const other = gameSession.gameState.getPlayerState(playerId).victoryPoints - recorded
        const list = [...totals.entries()]
            .filter(([, amount]) => amount !== 0)
            .map(([source, amount]) => `${SourceNames[source] ?? source} ${amount}`)
        if (other !== 0) list.push(`Other ${other}`)
        return list
    })
</script>

{#if gameSession.isActingAdmin || gameSession.isViewingHost}
    <div class="px-3 py-1 text-[11px] text-[#c9a961]" title="Admin view only">
        VP from: {parts.length ? parts.join(' · ') : 'none yet'}
    </div>
{/if}
