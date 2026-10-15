<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        BonusTokensToSummonDragon,
        DragonLevel,
        MachineState,
        endTriggers,
        gemTriggerThreshold
    } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const triggers = $derived(endTriggers(gameSession.gameState))
    const gemThreshold = $derived(gemTriggerThreshold(gameSession.gameState.players.length))
    // Cards still to come before the face-up Game Over card at the bottom of the draw pile.
    const deckCardsLeft = $derived(
        Math.max(0, gameSession.gameState.market.drawPile.length - (triggers.deckExhausted ? gameSession.gameState.market.drawPile.length : 1))
    )
    const dragon = $derived(gameSession.gameState.dragon)
    const dragonActive = $derived(dragon.summoned && !dragon.killed)
    const gemsSpent = $derived(Math.min(gameSession.gameState.gemsSpent, gemThreshold))

    // Green while far off, yellow once close, red when the trigger is met.
    const DeckWarnCardsLeft = 6
    const GemsWarnLeft = 4
    const DragonWarnHitsLeft = 3
    type ChipLevel = 'far' | 'close' | 'met'
    const ChipColors: Record<ChipLevel, { border: string; text: string; background: string }> = {
        far: { border: '#2f8f57', text: '#7ee2a2', background: 'rgba(47, 143, 87, 0.15)' },
        close: { border: '#e0b02a', text: '#ffd166', background: 'rgba(224, 176, 42, 0.18)' },
        met: { border: '#e0574a', text: '#ffffff', background: '#a3241a' }
    }

    type TriggerChip = { key: string; label: string; tip: string; level: ChipLevel; pulse?: boolean }
    const triggerChips: TriggerChip[] = $derived([
        {
            key: 'deck',
            label: `DECK ${deckCardsLeft}`,
            level: triggers.deckExhausted ? 'met' : deckCardsLeft <= DeckWarnCardsLeft ? 'close' : 'far',
            tip: triggers.deckExhausted
                ? 'The Game Over card is next: this end trigger is met'
                : `${deckCardsLeft} ${deckCardsLeft === 1 ? 'card' : 'cards'} left before the Game Over card`
        },
        dragon.killed
            ? {
                  key: 'dragon',
                  label: `DRAGON ${DragonLevel}/${DragonLevel}`,
                  level: 'met',
                  tip: 'The dragon has been killed: this end trigger is met'
              }
            : dragonActive
              ? {
                    key: 'dragon',
                    label: `DRAGON ${dragon.hits}/${DragonLevel}`,
                    level: DragonLevel - dragon.hits <= DragonWarnHitsLeft ? 'close' : 'far',
                    pulse: true,
                    tip: `The dragon is out: ${dragon.hits} of ${DragonLevel} hits landed. Killing it meets this end trigger`
                }
              : {
                    key: 'dragon',
                    label: `DRAGON ${Math.min(dragon.trackerTokens.length, BonusTokensToSummonDragon)}/${BonusTokensToSummonDragon}`,
                    level: 'far',
                    tip: `${Math.min(dragon.trackerTokens.length, BonusTokensToSummonDragon)} of ${BonusTokensToSummonDragon} bonus tokens drawn. At ${BonusTokensToSummonDragon} the dragon comes out`
                },
        {
            key: 'gems',
            label: `GEMS ${gemsSpent}/${gemThreshold}`,
            level: triggers.gemsSpent ? 'met' : gemThreshold - gemsSpent <= GemsWarnLeft ? 'close' : 'far',
            tip: `${gemsSpent} of ${gemThreshold} gems spent on gem actions`
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
    class="relative z-30 flex min-h-[44px] items-center justify-between gap-x-2 border-b border-[#4a3620] px-4 py-1.5 max-sm:flex-wrap max-sm:gap-y-1 max-sm:px-2 text-[#f1e6cf] tracking-[0.06em]"
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
        <div class="flex items-center gap-1 text-[10px] font-semibold sm:gap-2 sm:text-[13px]">
            {#each triggerChips as chip (chip.key)}
                <!-- Small hover (or tap) box with the details, rather than a slow native tooltip. -->
                <button
                    type="button"
                    class="trigger-chip relative cursor-default rounded border px-1.5 py-0.5 sm:rounded-md sm:border-2 sm:px-2.5 sm:py-1"
                    class:dragon-alert={chip.pulse}
                    style="border-color: {ChipColors[chip.level].border}; color: {ChipColors[chip.level].text}; background-color: {ChipColors[chip.level].background};"
                    aria-label={chip.tip}
                    >{chip.label}<span class="chip-tip" role="tooltip">{chip.tip}</span></button
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

<style>
    .chip-tip {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 50;
        display: none;
        width: max-content;
        max-width: 220px;
        padding: 4px 8px;
        border: 1px solid #8a6d3b;
        border-radius: 6px;
        background: #1a120b;
        color: #f1e6cf;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: normal;
        line-height: 1.3;
        white-space: normal;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        pointer-events: none;
    }
    .trigger-chip:hover .chip-tip,
    .trigger-chip:focus .chip-tip {
        display: block;
    }
    .trigger-chip:focus {
        outline: none;
    }
    .dragon-alert {
        animation: dragon-alert-pulse 1.6s ease-in-out infinite;
    }
    @keyframes dragon-alert-pulse {
        0%,
        100% {
            box-shadow: 0 0 0 0 currentColor;
        }
        50% {
            box-shadow: 0 0 0 4px transparent;
        }
    }
</style>
