<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType } from '@tabletop/stellar-ventures'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import {
        powerCardImageForSide,
        powerHasTwoSides,
        POWER_CARD_ASPECT,
        type PowerCardSide
    } from '$lib/utils/corporatePowerImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const corporationId = $derived(gameSession.gameState.draftPowerCorporationId)
    const corporation = $derived(corporationId ? gameSession.gameState.getCorporation(corporationId) : undefined)
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const availablePowerIds = $derived(gameSession.gameState.availableCorporatePowerIds)

    const canDraft = $derived(gameSession.validActionTypes.includes(ActionType.DraftPower))
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    async function choose(powerId: string) {
        await gameSession.draftPower(powerId)
    }

    // Which face of each card is currently showing - defaults to the back (full rules text),
    // same as before this was flippable. Flipping is a separate control from the card's main
    // click, which drafts that Power.
    let sideById = $state<Record<string, PowerCardSide>>({})
    function sideFor(powerId: string): PowerCardSide {
        return sideById[powerId] ?? 'back'
    }
    function flip(event: MouseEvent | KeyboardEvent, powerId: string) {
        event.stopPropagation()
        if (!powerHasTwoSides(powerId)) {
            return
        }
        sideById = { ...sideById, [powerId]: sideFor(powerId) === 'front' ? 'back' : 'front' }
    }
</script>

{#if corporationId}
    <div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
        <div class="text-sm">
            {#if presidentId}
                <PlayerName playerId={presidentId} /> drafts a Corporate Power for
                <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span>
            {:else}
                <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span> drafts a
                Corporate Power
            {/if}
        </div>

        {#if isMe && canDraft}
            <!-- Same fixed w-[10.5rem] card size as the Initial Auction's own draft step
                 (InitialAuctionPanel.svelte) - the co-designer wants Powers to read at the same
                 size everywhere they're drafted, not shrink to fit a grid here. -->
            <div class="flex flex-wrap gap-3">
                {#each availablePowerIds as powerId (powerId)}
                    <button
                        type="button"
                        onclick={() => choose(powerId)}
                        class="group relative w-[10.5rem] shrink-0 overflow-hidden rounded-md border-0 bg-transparent p-0"
                        aria-label={CorporatePowerDisplayNames[powerId] ?? powerId}
                    >
                        <img
                            src={powerCardImageForSide(powerId, sideFor(powerId)) ?? ''}
                            alt={CorporatePowerDisplayNames[powerId] ?? powerId}
                            class="block w-full"
                            style="aspect-ratio: {POWER_CARD_ASPECT};"
                        />
                        {#if powerHasTwoSides(powerId)}
                            <span
                                role="button"
                                tabindex="0"
                                onclick={(event) => flip(event, powerId)}
                                onkeydown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') flip(event, powerId)
                                }}
                                class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white opacity-0 transition group-hover:opacity-100"
                                aria-label="Flip card"
                                title="Flip card"
                            >⟲</span>
                        {/if}
                    </button>
                {/each}
                {#if availablePowerIds.length === 0}
                    <div class="text-xs text-[#7f88ad]">No Corporate Powers currently available.</div>
                {/if}
            </div>
        {:else}
            <div class="text-xs text-[#7f88ad]">
                Waiting on {#if presidentId}<PlayerName playerId={presidentId} />{:else}the President{/if}
                to draft a Power...
            </div>
        {/if}

        {#if gameSession.lastActionError}
            <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
        {/if}
    </div>
{/if}
