<script lang="ts">
    import { CardKind, getCard } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'

    // Live play: the card the current player has open or is pointing at, shown to watchers.
    // The player themselves only sees their card pulse.
    const gameSession = getGameSession()

    const cardId = $derived(gameSession.mirroring ? gameSession.watchedSelection?.lookingAtCardId : undefined)
    const activeId = $derived(gameSession.gameState.activePlayerIds[0])
    const url = $derived.by(() => {
        if (!cardId) return undefined
        try {
            return getCard(cardId).kind === CardKind.Player
                ? playerCardImageUrl(cardId, activeId ? gameSession.colors.getPlayerColor(activeId) : undefined)
                : cardImageUrl(cardId)
        } catch {
            return undefined
        }
    })
</script>

{#if url && activeId}
    <div class="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-center gap-1 rounded-xl border-2 border-[#ffd166] bg-[#1b140c]/95 p-2 shadow-2xl">
        <div class="text-xs text-[#f1e6cf]"><strong class="capitalize">{gameSession.getPlayerName(activeId)}</strong> is looking at</div>
        <img src={url} alt={cardId} class="h-72 w-auto rounded-lg" draggable="false" />
    </div>
{/if}
