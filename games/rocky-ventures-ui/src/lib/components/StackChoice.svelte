<script lang="ts">
    import { StackCardGemCost, CardKind, getCard, stackableCardIds } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'
    import gemIcon from '$lib/images/icons/gem.png'

    // Buying a card: add it to the row, or pay gems to stack it on a card already there.
    let { slotIndex }: { slotIndex: number } = $props()
    const gameSession = getGameSession()
    const playerId = $derived(gameSession.gameState.activePlayerIds[0])
    const cardIds = $derived(playerId ? stackableCardIds(gameSession.gameState, playerId) : [])

    function imageUrl(cardId: string): string | undefined {
        return getCard(cardId).kind === CardKind.Player
            ? playerCardImageUrl(cardId, gameSession.colors.getPlayerColor(playerId))
            : cardImageUrl(cardId)
    }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
    <div class="max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-xl border-2 border-[#c9a961] bg-[#1a120b] p-4 text-[#f1e6cf] shadow-2xl">
        <h2 class="text-lg font-semibold">Stack this card?</h2>
        <p class="mt-1 text-sm text-[#c9a961]">
            For
            <span class="inline-flex items-center gap-0.5 font-semibold">{StackCardGemCost} <img src={gemIcon} alt="gems" class="h-3.5 w-auto" /></span>
            put it on top of one of these. You keep that card's top action plus all of the new card's actions, in one spot in your row.
        </p>
        <div class="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {#each cardIds as cardId (cardId)}
                <button
                    type="button"
                    class="rv-lift rounded-lg border-2 border-[#8a6d3b] p-1"
                    onclick={() => gameSession.investWithAgreement(slotIndex, undefined, cardId)}
                >
                    <img src={imageUrl(cardId)} alt={cardId} class="block h-auto w-full rounded" draggable="false" />
                </button>
            {/each}
        </div>
        <div class="mt-3 flex justify-end gap-2">
            <button type="button" class="rv-quiet text-sm" onclick={() => (gameSession.stackPick = undefined)}>Cancel</button>
            <button type="button" class="rv-btn text-sm" onclick={() => gameSession.investWithAgreement(slotIndex, undefined)}>Add to my row</button>
        </div>
    </div>
</div>
