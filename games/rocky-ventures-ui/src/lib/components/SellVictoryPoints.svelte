<script lang="ts">
    import { ActionType, VictoryPointSalePrice } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const activeId = $derived(gameSession.gameState.activePlayerIds[0])
    const player = $derived(activeId ? gameSession.gameState.getPlayerState(activeId) : undefined)
    let amount = $state(1)
    const clamped = $derived(Math.max(1, Math.min(amount, player?.victoryPoints ?? 1)))
</script>

{#if player && gameSession.validActionTypes.includes(ActionType.SellVictoryPoints)}
    <div
        class="mb-2 inline-flex items-stretch overflow-hidden rounded-lg border-2 border-[#2f8f57] text-xs shadow-md"
        style="background: linear-gradient(160deg, #2f8f5733, #1a120b 70%);"
    >
        <button
            type="button"
            class="stepper w-7 text-base font-bold text-[#9fe0b8] disabled:opacity-30"
            disabled={clamped <= 1}
            onclick={() => (amount = clamped - 1)}
            aria-label="Sell fewer">−</button
        >
        <div class="flex items-center gap-1.5 border-x border-[#2f8f5766] px-2.5 py-1 font-mono">
            <span class="text-sm font-black text-[#ff8a80]">−{clamped}</span>
            <span class="text-[10px] font-semibold uppercase tracking-wider text-[#e0cfae]">VP</span>
            <span class="text-[#2f8f57]">→</span>
            <span class="text-sm font-black text-[#3ddc84]">+{`$${clamped * VictoryPointSalePrice}`}</span>
        </div>
        <button
            type="button"
            class="stepper w-7 text-base font-bold text-[#9fe0b8] disabled:opacity-30"
            disabled={clamped >= player.victoryPoints}
            onclick={() => (amount = clamped + 1)}
            aria-label="Sell more">+</button
        >
        <button
            type="button"
            onclick={() => gameSession.sellVictoryPoints(clamped)}
            class="bg-[#2f8f57] px-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-[#38a866]"
        >
            Sell
        </button>
    </div>
{/if}

<style>
    .stepper:not(:disabled):hover {
        background-color: rgba(61, 220, 132, 0.15);
    }
</style>
