<script lang="ts">
    import { ActionType, BoardNodesById, CompanyNames, StatKind, type CompanyId } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { recentOtherPlayerAction } from '$lib/utils/recentAction.js'

    // What another player's last extract took, where it went, and what it paid.
    const gameSession = getGameSession()

    const result = $derived.by(() => {
        const recent = recentOtherPlayerAction<{ nodeId: string; creditCompanyId?: CompanyId }>(
            gameSession,
            ActionType.ExtractAndSell
        )
        if (!recent) return undefined
        const event = recent.after.statEvents
            .slice(recent.before.statEvents.length)
            .find((candidate) => candidate.kind === StatKind.MineExtract)
        if (!event) return undefined
        const detail = Object.fromEntries((event.detail ?? '').split(';').map((pair) => pair.split('=') as [string, string]))
        const ore = event.source === 'gold' ? 'Gold' : event.source === 'silver' ? 'Silver' : undefined
        const creditCompanyId = recent.action.creditCompanyId
        return {
            playerId: recent.playerId,
            amount: `${detail['ore'] ?? ''} ${ore ?? 'ore'}`.trim(),
            mine: BoardNodesById[recent.action.nodeId]?.name,
            city: BoardNodesById[detail['city'] ?? '']?.name,
            railroad: creditCompanyId ? CompanyNames[creditCompanyId] : undefined,
            earned: event.amount
        }
    })
</script>

{#if result}
    <div class="mb-2 rounded border border-[#8a6d3b] bg-black/20 px-2 py-1.5 text-xs text-[#c9a961]">
        <strong class="capitalize text-[#f1e6cf]">{gameSession.getPlayerName(result.playerId)}</strong>
        extracted <strong class="text-[#f1e6cf]">{result.amount}</strong>{#if result.mine}&nbsp;at {result.mine}{/if}{#if result.city}, sold to <strong class="text-[#f1e6cf]">{result.city}</strong>{/if}{#if result.railroad}&nbsp;via {result.railroad}{/if}{#if result.earned !== undefined}: <strong class="text-[#f1e6cf]">{result.earned < 0 ? `-$${-result.earned}` : `+$${result.earned}`}</strong>{/if}
    </div>
{/if}
