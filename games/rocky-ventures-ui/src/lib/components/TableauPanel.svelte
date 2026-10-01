<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { CardKind, OreCapacityByToolLevel, getCard, taxIncomeFor } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { agreementImageUrl, agreementTooltip } from '$lib/utils/agreementImages.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'
    import gemIcon from '$lib/images/icons/gem.png'
    import Pawn from '$lib/components/Pawn.svelte'
    import TuckedUnder from '$lib/components/TuckedUnder.svelte'

    const TUCK_STRIP = 9

    const gameSession = getGameSession()

    const playerIds = $derived(gameSession.gameState.turnManager.turnOrder)

    let selectedPlayerId: string | undefined = $state(
        gameSession.myPlayer?.id ?? gameSession.gameState.activePlayerIds[0]
    )

    const selectedPlayer = $derived(
        gameSession.gameState.findPlayerState(selectedPlayerId ?? '') ??
            gameSession.gameState.players[0]
    )

    function cycle(direction: 1 | -1) {
        const index = playerIds.indexOf(selectedPlayer.playerId)
        selectedPlayerId = playerIds[(index + direction + playerIds.length) % playerIds.length]
    }

    function imageFor(cardId: string): string | undefined {
        const card = getCard(cardId)
        if (card.kind === CardKind.Player) {
            return playerCardImageUrl(cardId, gameSession.colors.getPlayerColor(selectedPlayer.playerId))
        }
        return cardImageUrl(cardId)
    }
</script>

<div class="h-full overflow-y-auto p-4 text-[#f1e6cf]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#c9a961]">Player tableau</h2>

    <div class="mb-3 flex flex-wrap items-center gap-1.5">
        <button
            type="button"
            class="rv-quiet px-2 py-1 text-xs"
            onclick={() => cycle(-1)}
            title="Previous player">◀</button
        >
        {#each playerIds as playerId (playerId)}
            <button
                type="button"
                onclick={() => (selectedPlayerId = playerId)}
                class="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs {selectedPlayer.playerId === playerId
                    ? 'border-[#b8700a] bg-[#3a2a17] text-white'
                    : 'border-[#6b563a] bg-[#22170e] text-[#e0cfae] hover:bg-[#3a2a17]'}"
            >
                <span
                    class="inline-block h-3 w-3 rounded-full border border-black/50"
                    style="background-color: {gameSession.colors.getPlayerUiColor(playerId)}"
                ></span>
                <PlayerName {playerId} />
            </button>
        {/each}
        <button
            type="button"
            class="rv-quiet px-2 py-1 text-xs"
            onclick={() => cycle(1)}
            title="Next player">▶</button
        >
    </div>

    <div class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>{`$${selectedPlayer.money}`}</span>
        <span class="inline-flex items-center gap-1"><img src={gemIcon} alt="gems" class="h-4 w-auto" />{selectedPlayer.gems}</span>
        <span>⛏ {selectedPlayer.claimTokens} claim tokens</span>
        <span>🏆 {selectedPlayer.victoryPoints} VP</span>
        <span>
            Weapon {selectedPlayer.weaponLevel} / Tool {selectedPlayer.toolLevel}
            (up to {OreCapacityByToolLevel[selectedPlayer.toolLevel].gold} gold, {OreCapacityByToolLevel[selectedPlayer.toolLevel].silver} silver ore)
        </span>
        {#if selectedPlayer.tuckedCardIds.length > 0}
            <span>Tucked under I: {selectedPlayer.tuckedCardIds.length} (next tax {`$${taxIncomeFor(selectedPlayer.tuckedCardIds.length + 1)}`})</span>
        {/if}
    </div>

    <div class="flex flex-row items-end gap-2 overflow-x-auto pb-6 pt-2">
        {#each selectedPlayer.tableau as cardId, index (cardId)}
            {@const imageUrl = imageFor(cardId)}
            <div
                class="relative shrink-0 w-[150px]"
                style="margin-left: {index === 0 ? selectedPlayer.tuckedCardIds.length * TUCK_STRIP : 0}px;"
            >
                {#if index === 0}
                    <TuckedUnder ids={selectedPlayer.tuckedCardIds} strip={TUCK_STRIP} imageFor={imageFor} />
                {/if}
                {#if selectedPlayer.pawnIndex === index}
                    <div class="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                        <Pawn fill={gameSession.colors.getPlayerUiColor(selectedPlayer.playerId)} height={95} />
                    </div>
                {/if}
                {#if imageUrl}
                    <button
                        type="button"
                        class="relative z-10 block w-full overflow-hidden rounded-md border border-[#8a6d3b] shadow-md"
                        onclick={() => gameSession.zoomCard(cardId, imageUrl)}
                    >
                        <img src={imageUrl} alt={cardId} class="block h-auto w-full" draggable="false" />
                    </button>
                {:else}
                    <div class="aspect-[369/516] rounded-md border border-dashed border-[#8a6d3b] p-2 text-xs">{cardId}</div>
                {/if}
            </div>
        {/each}
        {#if selectedPlayer.pawnIndex === undefined}
            <div class="flex items-center gap-2 self-center text-xs text-[#c9a961]">
                <Pawn fill={gameSession.colors.getPlayerUiColor(selectedPlayer.playerId)} height={96} />
            </div>
        {/if}
    </div>

    {#if selectedPlayer.agreements.length > 0}
        <div class="flex flex-row gap-2 overflow-x-auto pb-4">
            {#each selectedPlayer.agreements as agreement (`${agreement.cityId}-${agreement.letter}`)}
                {@const agreementUrl = agreementImageUrl(agreement.cityId, agreement.letter)}
                {#if agreementUrl}
                    <button
                        type="button"
                        class="block w-[150px] shrink-0 overflow-hidden rounded-md border border-[#8a6d3b] shadow-md"
                        title={agreementTooltip(agreement.cityId, agreement.letter)}
                        onclick={() => gameSession.zoomCard(`${agreement.cityId}-${agreement.letter}`, agreementUrl)}
                        onpointerenter={(event) => gameSession.previewCard(event, `${agreement.cityId}-${agreement.letter}`, agreementUrl)}
                        onpointerleave={() => gameSession.clearCardPreview()}
                    >
                        <img src={agreementUrl} alt="{agreement.cityId} {agreement.letter}" class="block h-auto w-full" draggable="false" />
                    </button>
                {/if}
            {/each}
        </div>
    {/if}
</div>
