<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeGamePhase, formatGamePhase } from '$lib/utils/phaseLabel.js'

    const gameSession = getGameSession()

    const phaseText = $derived(formatGamePhase(describeGamePhase(gameSession.gameState)))
</script>

<div
    id="stellar-ventures-header"
    class="flex min-h-[44px] items-center justify-between gap-x-2 border-b border-[#2a2f45] px-4 py-1.5 text-[#e6e9f5] tracking-[0.06em]"
>
    <div class="header-grid grid min-w-0 text-[13px] sm:text-[15px]">
        {#if gameSession.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>HISTORY</div>
        {:else if gameSession.gameState.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>END OF GAME</div>
        {:else if gameSession.activePlayers.length === 0}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>
                {phaseText}
            </div>
        {:else if gameSession.isMyTurn}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }} class="inline-flex gap-x-1">
                <span>YOUR TURN</span>
                <span class="text-[#7f88ad]">- {phaseText}</span>
            </div>
        {:else}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }} class="inline-flex gap-x-1">
                {#each gameSession.activePlayers as player, index (player.id)}
                    {#if index > 0}<span>,</span>{/if}
                    <PlayerName playerId={player.id} capitalization="uppercase" />
                {/each}
                <span class="text-[#7f88ad]">- {phaseText}</span>
            </div>
        {/if}
    </div>

    <div class="header-grid grid shrink-0 text-[15px]">
        <div class="flex items-center gap-2">
            {#if gameSession.undoableAction}
                <button
                    type="button"
                    onclick={() => gameSession.undo()}
                    class="rounded-lg px-2 py-1 text-[#e6e9f5] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d6979]/60"
                >
                    UNDO
                </button>
            {/if}
            <!-- TESTING ONLY - see StellarVenturesGameSession.testingRedoLiquidation. Only ever
                 appears right after Undo Liquidation (testing only) was used on GameEndPanel, to
                 resubmit that same Backroom Deal/Decline decision and land back at the same
                 EndOfGame outcome - lives here rather than on GameEndPanel itself because that
                 panel disappears the instant the undo reverts gameState.result, taking any button
                 on it down too. Remove once Backroom Deal/Accounting Gimmick testing is done. -->
            {#if gameSession.testingLiquidationRedoAction}
                <button
                    type="button"
                    onclick={() => gameSession.testingRedoLiquidation()}
                    class="rounded-lg border border-dashed border-[#5a6178] px-2 py-1 text-[11px] text-[#9aa2c0] hover:bg-white/5"
                >
                    Redo Liquidation (testing only)
                </button>
            {/if}
            <!-- TESTING ONLY - see StellarVenturesGameSession.testingForceLiquidate. Covers the
                 dead-end case Redo Liquidation above can't: a bare auto-Liquidate undone with no
                 Backroom Deal decision to resubmit, which otherwise leaves the game permanently
                 stuck in Liquidation with nothing else able to move it forward. Remove once
                 Backroom Deal/Accounting Gimmick testing is done. -->
            {#if gameSession.stuckInLiquidation}
                <button
                    type="button"
                    onclick={() => gameSession.testingForceLiquidate()}
                    class="rounded-lg border border-dashed border-[#5a6178] px-2 py-1 text-[11px] text-[#9aa2c0] hover:bg-white/5"
                >
                    Force Liquidate (testing only)
                </button>
            {/if}
        </div>
    </div>
</div>

<style>
    .header-grid > * {
        grid-area: 1 / 1;
    }
</style>
