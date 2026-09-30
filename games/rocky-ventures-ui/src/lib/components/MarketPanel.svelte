<script lang="ts">
    import { CardKind, DeliveryCityId, MarketSlotPrices, getCard } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'

    const gameSession = getGameSession()
    const market = $derived(gameSession.gameState.market)
    const gameState = $derived(gameSession.gameState)

    // Clear the hover preview if the panel goes away (tab switch) while a card is hovered
    $effect(() => () => (gameSession.hoveredCard = undefined))

    function slotTitle(index: number): string {
        const labels: string[] = []
        if (index === 0) labels.push('Tax card')
        if (index === 1) labels.push('Manor gold price')
        if (index === 2) labels.push('Silver price')
        if (index === 3) labels.push('Dornoch gold price')
        return `$${MarketSlotPrices[index]}${labels.length ? ` · ${labels.join(', ')}` : ''}`
    }

    function totalCost(cardId: string, index: number): number | undefined {
        const card = getCard(cardId)
        return card.kind === CardKind.Development ? card.baseCost + MarketSlotPrices[index]! : undefined
    }
</script>

<div class="h-full overflow-y-auto p-4 text-[#f1e6cf]">
    <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-[#c9a961]">Development market <span class="normal-case tracking-normal">· {market.drawPile.length} left in draw pile</span></h2>
        <div class="text-xs text-[#c9a961]">
            Gold Dornoch {`$${gameState.goldPriceFor(DeliveryCityId.Dornoch)}`} · Gold Manor
            {`$${gameState.goldPriceFor(DeliveryCityId.Manor)}`} · Silver {`$${gameState.silverPrice}`}
        </div>
    </div>
    <div class="flex flex-row flex-wrap items-start gap-3">
        {#each [...MarketSlotPrices].reverse() as _price, reversedIndex (reversedIndex)}
            {@const index = MarketSlotPrices.length - 1 - reversedIndex}
            {@const cardId = market.slots[index]}
            {@const imageUrl = cardId ? cardImageUrl(cardId) : undefined}
            {@const cost = cardId ? totalCost(cardId, index) : undefined}
            <div class="flex w-[170px] flex-col items-center">
                <div class="mb-1 whitespace-nowrap text-[11px] text-[#c9a961]">{slotTitle(index)}</div>
                {#if cardId && imageUrl}
                    {@const click = gameSession.marketClick(index)}
                    <button
                        type="button"
                        class="market-card block w-full overflow-hidden rounded-md border shadow-md {click
                            ? 'border-2 border-[#ffd166]'
                            : 'border-[#8a6d3b]'} {gameSession.swapPickSlot === index ? 'ring-4 ring-[#7fd1ff]' : ''}"
                        onclick={() => gameSession.clickMarketCard(index, cardId, imageUrl)}
                        onpointerenter={(event) => gameSession.previewCard(event, cardId, imageUrl)}
                        onpointerleave={() => gameSession.clearCardPreview()}
                        title={click === 'buy'
                            ? 'Click to buy'
                            : click === 'gemMarket'
                              ? 'Click to use this card (2 gems)'
                              : click === 'swap'
                                ? 'Click, then click a neighbour to swap'
                                : 'Click to enlarge'}
                    >
                        <img src={imageUrl} alt={cardId} class="block h-auto w-full" draggable="false" />
                    </button>
                    <div class="mt-1 text-[11px]">
                        {#if cost !== undefined}
                            Buy for <span class="font-bold">{`$${cost}`}</span>
                        {:else}
                            End of Era card
                        {/if}
                    </div>
                {:else}
                    <div class="flex aspect-[369/516] w-full items-center justify-center rounded-md border border-dashed border-[#8a6d3b] text-xs italic text-gray-500">
                        empty
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>

<style>
    .market-card:hover {
        animation: card-pulse 1.2s ease-in-out infinite;
    }
    @keyframes card-pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(255, 214, 110, 0.9);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(255, 214, 110, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(255, 214, 110, 0);
        }
    }
</style>
