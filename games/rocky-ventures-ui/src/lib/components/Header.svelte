<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        BonusTokensToSummonDragon,
        DragonLevel,
        MachineState,
        CardKind,
        endTriggers,
        getCard,
        gemTriggerThreshold,
        FeastBuyerBonuses,
        feastCategoryFor
    } from '@tabletop/rocky-ventures'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { feastName } from '$lib/utils/feastNames.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const triggers = $derived(endTriggers(gameSession.gameState))
    // Games that end on End of Era III show the deck and dragon as information only, and no gems.
    const eraThreeEnding = $derived(gameSession.gameState.eraThreeEndsGame === true)
    const gemThreshold = $derived(gemTriggerThreshold(gameSession.gameState.players.length))
    // Cards still to come. Older games keep a face-up Game Over card at the bottom, which doesn't count.
    const deckCardsLeft = $derived(
        gameSession.gameState.market.drawPile.filter((cardId) => getCard(cardId).kind !== CardKind.GameOver).length
    )
    const dragon = $derived(gameSession.gameState.dragon)
    const dragonActive = $derived(dragon.summoned && !dragon.killed)
    const gemsSpent = $derived(Math.min(gameSession.gameState.gemsSpent, gemThreshold))

    // Green while far off, yellow once close, red when the trigger is met.
    const DeckWarnCardsLeft = 6
    // Two players have a smaller gem total, so warn later there.
    const GemsWarnLeft = $derived(gameSession.gameState.players.length === 2 ? 3 : 4)
    const DragonWarnHitsLeft = 3
    type ChipLevel = 'far' | 'close' | 'met' | 'done'
    const ChipColors: Record<ChipLevel, { border: string; text: string; background: string }> = {
        far: { border: '#2f8f57', text: '#7ee2a2', background: 'rgba(47, 143, 87, 0.15)' },
        close: { border: '#e0b02a', text: '#ffd166', background: 'rgba(224, 176, 42, 0.18)' },
        met: { border: '#e0574a', text: '#ffffff', background: '#a3241a' },
        // A Feast that has already been bought and scored: greyed out.
        done: { border: '#4b4b4b', text: '#7d7d7d', background: 'rgba(110, 110, 110, 0.12)' }
    }

    // `struck` draws a line through the label's first word (the slain dragon).
    type TriggerChip = { key: string; label: string; tip: string; level: ChipLevel; pulse?: boolean; struck?: boolean; goldWord?: string; imageUrl?: string }
    const triggerChips: TriggerChip[] = $derived([
        {
            key: 'deck',
            label: `DECK ${deckCardsLeft}`,
            level: eraThreeEnding
                ? deckCardsLeft <= DeckWarnCardsLeft ? 'close' : 'far'
                : triggers.deckExhausted ? 'met' : deckCardsLeft <= DeckWarnCardsLeft ? 'close' : 'far',
            tip: eraThreeEnding
                ? `${deckCardsLeft} ${deckCardsLeft === 1 ? 'card' : 'cards'} left in the deck`
                : triggers.deckExhausted
                  ? 'The Game Over card is next: this end trigger is met'
                  : `${deckCardsLeft} ${deckCardsLeft === 1 ? 'card' : 'cards'} left before the Game Over card`
        },
        dragon.killed
            ? {
                  key: 'dragon',
                  label: `DRAGON ${DragonLevel}/${DragonLevel}`,
                  level: eraThreeEnding ? 'far' : 'met',
                  struck: true,
                  tip: eraThreeEnding ? 'The dragon has been killed' : 'The dragon has been killed: this end trigger is met'
              }
            : dragonActive
              ? {
                    key: 'dragon',
                    label: `DRAGON ${dragon.hits}/${DragonLevel}`,
                    level: DragonLevel - dragon.hits <= DragonWarnHitsLeft ? 'close' : 'far',
                    pulse: true,
                    tip: `The dragon is out: ${dragon.hits} of ${DragonLevel} hits landed.${eraThreeEnding ? '' : ' Killing it meets this end trigger'}`
                }
              : {
                    key: 'dragon',
                    label: `DRAGON ${Math.min(dragon.trackerTokens.length, BonusTokensToSummonDragon)}/${BonusTokensToSummonDragon}`,
                    level: 'far',
                    tip: `${Math.min(dragon.trackerTokens.length, BonusTokensToSummonDragon)} of ${BonusTokensToSummonDragon} bonus tokens drawn. At ${BonusTokensToSummonDragon} the dragon comes out`
                },
        // Where each Feast card is: still in the deck, in the market to buy, or gone. Only in games
        // with Feast buyer bonus scoring, since the chips name what each Feast scores.
        ...(gameSession.gameState.feastBuyerBonus ? ['era1', 'era2', 'era3'] : []).map((cardId, index): TriggerChip => {
            const state = gameSession.gameState
            const slot = state.market.slots.indexOf(cardId)
            const inDeck = state.market.drawPile.includes(cardId)
            const name = feastName(index + 1)
            const bonus = state.feastBuyerBonus ? FeastBuyerBonuses[cardId] : undefined
            // Newer games draw one of three Feasts per card; older ones keep the original three.
            const category = feastCategoryFor(state, cardId)
            const measure = category?.measureLabel ?? ['tool level', 'share multipliers', 'gold mines you hold a claim on'][index]
            const bonusText = bonus ? ` Buyer bonus: ${bonus.points.join('/')} VP for 1st/2nd/3rd in ${measure}.` : ''
            // Bought and its point buy over: the Feast is complete.
            const done = slot < 0 && !inDeck && state.pointBuy?.cardId !== cardId
            return {
                key: cardId,
                label: `FEAST ${index + 1}: ${category?.shortLabel ?? ['TOOL', 'SHARES', 'MINES'][index]}`,
                goldWord: !done ? (category ? (category.id === 'goldMines' ? 'GOLD' : undefined) : index === 2 ? 'MINES' : undefined) : undefined,
                level: done ? 'done' : slot >= 0 ? 'close' : 'far',
                struck: false,
                imageUrl: cardImageUrl(cardId),
                tip: `${name}: ${slot >= 0 ? 'in the market now' : inDeck ? 'still in the deck' : 'already taken'}.${bonusText}`
            }
        }),
        ...(eraThreeEnding
            ? []
            : [
                  {
                      key: 'gems',
                      label: `GEMS ${gemsSpent}/${gemThreshold}`,
                      level: (triggers.gemsSpent ? 'met' : gemThreshold - gemsSpent <= GemsWarnLeft ? 'close' : 'far') as ChipLevel,
                      tip: `${gemsSpent} of ${gemThreshold} gems spent on gem actions`
                  }
              ])
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

    <div class="flex min-w-0 shrink items-center gap-2 text-[15px] max-sm:ml-auto">
        <div class="flex flex-wrap items-center justify-end gap-1 text-[10px] font-semibold sm:gap-2.5 sm:text-sm 2xl:text-base">
            {#each triggerChips as chip (chip.key)}
                <!-- Small hover (or tap) box with the details, rather than a slow native tooltip. -->
                <button
                    type="button"
                    class="trigger-chip relative cursor-default rounded border px-1.5 py-0.5 sm:rounded-lg sm:border-2 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2"
                    class:dragon-alert={chip.pulse}
                    style="border-color: {ChipColors[chip.level].border}; color: {ChipColors[chip.level].text}; background-color: {ChipColors[chip.level].background};"
                    aria-label={chip.tip}
                    >{#if chip.goldWord}{chip.label.replace(chip.goldWord, '')}<span style="color: #f2c14e;">{chip.goldWord}</span>{:else if chip.struck}<span class="line-through decoration-2">{chip.label.split(' ')[0]}</span> {chip.label.split(' ').slice(1).join(' ')}{:else}{chip.label}{/if}<span class="chip-tip" class:chip-tip-art={chip.imageUrl} role="tooltip">{#if chip.imageUrl}<img src={chip.imageUrl} alt="" width="414" height="644" draggable="false" class="mb-1.5 block h-auto w-full rounded" />{/if}{chip.tip}</span></button
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
    .chip-tip-art {
        width: 260px;
        max-width: 260px;
    }
    /* Phones: the chips wrap, so a tip hung off one of them could run off the side. */
    @media (width < 640px) {
        .chip-tip-art {
            position: fixed;
            top: 232px;
            right: auto;
            left: 50%;
            transform: translateX(-50%);
        }
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
