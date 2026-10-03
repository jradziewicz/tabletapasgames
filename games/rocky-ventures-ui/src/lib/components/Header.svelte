<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState, endTriggers, gemTriggerThreshold } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const triggers = $derived(endTriggers(gameSession.gameState))
    const gemThreshold = $derived(gemTriggerThreshold(gameSession.gameState.players.length))
    const triggerChips = $derived([
        { label: 'DECK', met: triggers.deckExhausted, title: 'Development deck reached the End of Era 3 card' },
        { label: 'DRAGON', met: triggers.dragonKilled, title: 'The dragon has been summoned and killed' },
        {
            label: `GEMS ${Math.min(gameSession.gameState.gemsSpent, gemThreshold)}/${gemThreshold}`,
            met: triggers.gemsSpent,
            title: 'Gems spent on gem actions'
        }
    ])
    const phaseText = $derived.by(() => {
        switch (gameSession.gameState.machineState) {
            case MachineState.MovePawn:
                return 'MOVE ACTION PAWN'
            case MachineState.TakeActions:
                return gameSession.gameState.immediateCardId ? 'BONUS ACTION' : 'TAKE ACTIONS'
            case MachineState.ChooseShare:
                return 'CHOOSE A SHARE'
            case MachineState.PointBuy:
                return 'BUY VICTORY POINTS'
            case MachineState.Hunt:
                return 'HUNT'
            case MachineState.BonusInvest:
                return 'BONUS INVEST'
            case MachineState.AgreementPointBuy:
                return 'AGREEMENT: BUY POINTS'
            case MachineState.FreeTrack:
                return 'FREE TRACK'
            case MachineState.EndOfGame:
                return 'END OF GAME'
            default:
                return String(gameSession.gameState.machineState).toUpperCase()
        }
    })
</script>

<div
    id="rocky-ventures-header"
    class="flex min-h-[44px] items-center justify-between gap-x-2 border-b border-[#4a3620] px-4 py-1.5 max-sm:flex-wrap max-sm:gap-y-1 max-sm:px-2 text-[#f1e6cf] tracking-[0.06em]"
>
    <div class="grid min-w-0 text-[13px] max-sm:basis-full sm:text-[15px]">
        {#if gameSession.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>HISTORY</div>
        {:else if gameSession.gameState.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>END OF GAME</div>
        {:else if gameSession.activePlayers.length === 0}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>{phaseText}</div>
        {:else if gameSession.isMyTurn}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }} class="leading-tight">
                <span>YOUR TURN</span>
                <span class="text-[#c9a961]">- {phaseText}</span>
            </div>
        {:else}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }} class="inline-flex flex-wrap gap-x-1 leading-tight">
                {#each gameSession.activePlayers as player, index (player.id)}
                    {#if index > 0}<span>,</span>{/if}
                    <PlayerName playerId={player.id} capitalization="uppercase" />
                {/each}
                <span class="text-[#c9a961]">- {phaseText}</span>
            </div>
        {/if}
    </div>

    <div class="flex shrink-0 items-center gap-2 text-[15px] max-sm:ml-auto">
        <div class="flex items-center gap-1 text-[10px] font-semibold" title="Game ends when 2 of 3 triggers are met">
            {#each triggerChips as chip (chip.label)}
                <span
                    class="rounded border px-1.5 py-0.5"
                    style="border-color: {chip.met ? '#ffd166' : '#4a3620'}; color: {chip.met ? '#ffd166' : '#8a7a5c'}; background-color: {chip.met ? '#3a2a17' : 'transparent'};"
                    title={chip.title}>{chip.label}</span
                >
            {/each}
        </div>
        {#if gameSession.undoableAction}
            <button
                type="button"
                onclick={() => gameSession.undo()}
                class="rounded-lg px-2 py-1 text-[#f1e6cf] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a961]/60"
            >
                UNDO
            </button>
        {/if}
    </div>
</div>
