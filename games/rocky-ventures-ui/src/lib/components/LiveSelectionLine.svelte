<script lang="ts">
    import { BoardNodesById, CompanyNames, getCard, CardKind, type CompanyId, type HydratedRockyVenturesPlayerState } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Live play: spells out what the current player has selected so far.
    let { player }: { player?: HydratedRockyVenturesPlayerState } = $props()

    const gameSession = getGameSession()

    function cardName(index: number): string | undefined {
        const cardId = player?.tableau[index]
        if (cardId === undefined) return undefined
        const card = getCard(cardId)
        return card.kind === CardKind.Player ? `card ${card.numeral}` : card.kind === CardKind.Development ? `#${card.number}` : undefined
    }

    const parts = $derived.by(() => {
        const selection = gameSession.watchedSelection
        if (!selection) return []
        const move = selection.moveTargetIndex === undefined ? undefined : cardName(selection.moveTargetIndex)
        const railroad = selection.trackCompanyId ?? selection.extractCreditCompanyId
        return [
            move ? `moving to ${move}` : undefined,
            selection.moveDiscardIndexes.length ? `discarding ${selection.moveDiscardIndexes.length}` : undefined,
            selection.movePaidIndexes.length ? `paying to skip ${selection.movePaidIndexes.length}` : undefined,
            selection.step,
            selection.extractNodeId ? BoardNodesById[selection.extractNodeId]?.name : undefined,
            selection.extractCityId ? `to ${BoardNodesById[selection.extractCityId]?.name ?? selection.extractCityId}` : undefined,
            railroad ? CompanyNames[railroad as CompanyId] : undefined,
            selection.huntSelected.length ? `${selection.huntSelected.length} token${selection.huntSelected.length === 1 ? '' : 's'} picked` : undefined
        ].filter((part) => part !== undefined)
    })
</script>

{#if parts.length}
    <div class="mt-1 text-xs text-[#ffd166]">Selecting: {parts.join(', ')}</div>
{/if}
