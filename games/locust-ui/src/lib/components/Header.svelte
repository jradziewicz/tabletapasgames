<script lang="ts">
    import { MachineState, RegionLabels } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ColonyChip from './ColonyChip.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const canUndo = $derived(session.hasManualSelection || session.undoableAction !== undefined)
</script>

<div class="flex min-h-[44px] items-center justify-between gap-3 border-b border-[#5a4c38] bg-[#3a3022] px-4 text-[#f3ead6]">
    <div class="flex items-center gap-3 text-[17px] tracking-wide">
        {#if session.isViewingHistory}
            <span>HISTORY</span>
        {:else if state.result}
            <span>END OF GAME</span>
        {:else if state.machineState === MachineState.RelocateLocusts && session.actingColor}
            <ColonyChip color={session.actingColor} />
            <span>relocates locusts</span>
        {:else if state.machineState === MachineState.AssignDuelScoring}
            <span>Choose which colour counts for Vigor Points</span>
        {:else if session.actingColor}
            <ColonyChip color={session.actingColor} />
            <span>{session.isMyTurn ? '— your turn' : 'to play'}</span>
        {/if}
    </div>
    <div class="flex items-center gap-4 text-sm">
        <span class="opacity-80">Active Region {RegionLabels[state.activeRegion]} · Scoring {state.scoringsDone}/5</span>
        {#if canUndo && !session.isViewingHistory}
            <button
                type="button"
                onclick={() => session.undo()}
                class="rounded-lg px-2 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7165ad]"
            >
                UNDO
            </button>
        {/if}
    </div>
</div>
