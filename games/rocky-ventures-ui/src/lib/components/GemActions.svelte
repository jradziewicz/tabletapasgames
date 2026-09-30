<script lang="ts">
    import { CardKind, GemActionCosts, getCard, marketCardCost, reasonGemActionInvalid, type GemActionKind } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'
    import gemIcon from '$lib/images/icons/gem.png'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const activeId = $derived(gameState.activePlayerIds[0])
    const player = $derived(activeId ? gameState.getPlayerState(activeId) : undefined)
    const mode = $derived(gameSession.gemMode)

    const launchers: { kind: GemActionKind; label: string }[] = [
        { kind: 'repeat', label: 'Repeat card' },
        { kind: 'market', label: 'Market card' },
        { kind: 'swap', label: 'Swap' },
        { kind: 'movePawn', label: 'Move pawn' }
    ]

    function reason(kind: GemActionKind, target = 0): string | undefined {
        return activeId ? reasonGemActionInvalid(gameState, activeId, kind, target) : 'Not your turn'
    }

    function launchable(kind: GemActionKind): boolean {
        if (kind === 'repeat') {
            return reason(kind) === undefined
        }
        if (kind === 'movePawn') {
            return (player?.tableau ?? []).some((_, index) => reason(kind, index) === undefined)
        }
        return gameState.market.slots.some((_, index) => reason(kind, index) === undefined)
    }

    function launch(kind: GemActionKind) {
        if (kind === 'repeat') {
            gameSession.spendGems(kind)
        } else {
            gameSession.gemMode = kind
        }
    }

    function priceAt(cardId: string | undefined, slotIndex: number): string {
        if (cardId === undefined) {
            return ''
        }
        const cost = marketCardCost(getCard(cardId), slotIndex)
        return cost === undefined ? '–' : `$${cost}`
    }

    function tableauImage(cardId: string): string | undefined {
        const card = getCard(cardId)
        if (card.kind === CardKind.Player && activeId) {
            return playerCardImageUrl(cardId, gameSession.colors.getPlayerColor(activeId))
        }
        return cardImageUrl(cardId)
    }
</script>

{#if player}
    <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span class="inline-flex items-center gap-1 font-semibold">
            <img src={gemIcon} alt="gems" class="h-4 w-auto" />{player.gems}
        </span>
        {#if mode === undefined}
            {#each launchers as launcher (launcher.kind)}
                <button
                    type="button"
                    disabled={!launchable(launcher.kind)}
                    onclick={() => launch(launcher.kind)}
                    class="rv-btn rv-gem"
                >
                    {launcher.label} · {GemActionCosts[launcher.kind]}
                </button>
            {/each}
        {:else}
            <button
                type="button"
                onclick={() => gameSession.clearLocalSelection()}
                class="rv-quiet"
            >
                Back
            </button>
        {/if}
    </div>
    {#if mode === 'market' || mode === 'swap'}
        <div class="flex flex-wrap items-center gap-1">
            {#each gameState.market.slots as cardId, slotIndex (cardId)}
                <div class="flex flex-col items-center gap-0.5">
                    <button
                        type="button"
                        disabled={mode === 'market' && reason('market', slotIndex) !== undefined}
                        onclick={() => gameSession.clickMarketCard(slotIndex, cardId, cardImageUrl(cardId))}
                        onpointerenter={(event) => gameSession.previewCard(event, cardId, cardImageUrl(cardId))}
                        onpointerleave={() => gameSession.clearCardPreview()}
                        class="block overflow-hidden rounded border-2 disabled:opacity-40 {gameSession.swapPickSlot === slotIndex
                            ? 'border-[#7fd1ff] ring-4 ring-[#7fd1ff]'
                            : 'border-[#3f7fb8]'}"
                        style="cursor: pointer;"
                    >
                        <img src={cardImageUrl(cardId)} alt={cardId} class="block h-[200px] w-auto" draggable="false" />
                    </button>
                    {#if mode === 'swap'}
                        <span class="text-xs font-semibold">{priceAt(cardId, slotIndex)}</span>
                    {/if}
                </div>
                {#if mode === 'swap' && slotIndex + 1 < gameState.market.slots.length}
                    {@const rightId = gameState.market.slots[slotIndex + 1]}
                    <button
                        type="button"
                        onclick={() => gameSession.spendGems('swap', slotIndex)}
                        class="rv-btn rv-gem flex-col py-2 font-bold"
                        title="After the swap: left card {priceAt(rightId, slotIndex)}, right card {priceAt(cardId, slotIndex + 1)}"
                    >
                        <span class="text-lg">⇄</span>
                        <span class="text-[10px] font-semibold text-[#ffd166]">{priceAt(rightId, slotIndex)} · {priceAt(cardId, slotIndex + 1)}</span>
                    </button>
                {/if}
            {/each}
        </div>
    {:else if mode === 'movePawn'}
        <div class="flex flex-wrap items-end gap-2">
            {#each player.tableau as cardId, index (cardId)}
                <button
                    type="button"
                    disabled={reason('movePawn', index) !== undefined}
                    onclick={() => gameSession.spendGems('movePawn', index)}
                    onpointerenter={(event) => gameSession.previewCard(event, cardId, tableauImage(cardId))}
                    onpointerleave={() => gameSession.clearCardPreview()}
                    class="block overflow-hidden rounded border-2 border-[#3f7fb8] disabled:opacity-40"
                >
                    <img src={tableauImage(cardId)} alt={cardId} class="block h-[160px] w-auto" draggable="false" />
                </button>
            {/each}
        </div>
    {/if}
{/if}
