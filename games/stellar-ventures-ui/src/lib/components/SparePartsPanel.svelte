<script lang="ts">
    import { ActionType, CorporatePowerId } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import { CorporatePowerBackImages, POWER_CARD_ASPECT } from '$lib/utils/corporatePowerImages.js'
    import { ShipLevelIcons, ShipAspect } from '$lib/utils/shipDisplay.js'
    import CorporationBadge from './CorporationBadge.svelte'

    // Spare Parts (Corporate Power Glossary, page 29): "Anytime, One-Time (limit 1 Ship). When a
    // Ship of this Corporation would be Scrapped, the President may move 1 of those Ships onto
    // this tile instead, delaying its Scrap (and the CARGO reduction) by one Dividend payment."
    // Offered right as a qualifying Scrap happens, to the President of whichever Corporation
    // holds it - state.pendingSparePartsCorporationId/pendingSparePartsShipLevel name the one
    // Corporation and Ship at risk directly (see actions/spareParts.ts), so unlike
    // DeepSpaceSmugglingPanel/FinePrintPanel this doesn't need to search for the holder by
    // hasActivePower - the state already says exactly who and what. Same "mounted for everyone
    // by ActionPanel.svelte but only actionable for that one President" treatment as those two.
    //
    // Per the co-designer, this Power has no separate "Apply" button - the President instead
    // clicks the at-risk Ship itself to move it onto the tile (moveOntoTile), with Decline as
    // the only plain button, for scrapping it for real right now instead.
    const gameSession = getGameSession()

    const corporationId = $derived(gameSession.gameState.pendingSparePartsCorporationId)
    const corporation = $derived(
        corporationId ? gameSession.gameState.getCorporation(corporationId) : undefined
    )
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    const shipLevel = $derived(gameSession.gameState.pendingSparePartsShipLevel)

    const canSpareParts = $derived(gameSession.validActionTypes.includes(ActionType.SpareParts))
    const canDecline = $derived(gameSession.validActionTypes.includes(ActionType.DeclineSpareParts))

    async function moveOntoTile() {
        await gameSession.spareParts()
    }

    async function decline() {
        await gameSession.declineSpareParts()
    }
</script>

<div class="flex h-full flex-col items-center justify-center gap-3 py-3 text-[#e6e9f5]">
    {#if corporation}
        <div class="flex w-[10.35rem] flex-col items-center gap-2">
            <CorporationBadge corporationId={corporation.id} />
            <img
                src={CorporatePowerBackImages[CorporatePowerId.SpareParts] ?? ''}
                alt={CorporatePowerDisplayNames[CorporatePowerId.SpareParts]}
                class="block w-full rounded-md shadow-lg"
                style="aspect-ratio: {POWER_CARD_ASPECT};"
            />
        </div>
    {/if}

    {#if shipLevel !== undefined}
        <!-- The one at-risk Ship - clicking it (isMe && canSpareParts only) is what actually uses
             the Power, moving it onto the tile above. Pulsing glow (same convention as
             ShipyardPanel's own .shipyard-orderable-ship) marks it as the clickable piece, same
             as everywhere else in this app a specific piece rather than a button is the control. -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <img
            src={ShipLevelIcons[shipLevel]}
            alt="Level {shipLevel} Ship{isMe && canSpareParts ? ' - click to move onto Spare Parts' : ''}"
            class="h-16 w-auto object-contain {isMe && canSpareParts
                ? 'spare-parts-ship cursor-pointer transition-transform hover:scale-110'
                : 'drop-shadow'}"
            style="aspect-ratio: {ShipAspect[shipLevel] ?? 1};"
            onclick={isMe && canSpareParts ? moveOntoTile : undefined}
        />
    {/if}

    {#if isMe && canDecline}
        <div class="flex justify-center gap-2">
            <button
                type="button"
                onclick={decline}
                class="rounded-md bg-[#5a6178] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6b7290]"
            >
                Decline
            </button>
        </div>
    {/if}

    {#if gameSession.lastActionError}
        <div class="px-4 text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
    {/if}
</div>

<style>
    /* Same green "this is the clickable piece" glow ShipyardPanel's own
       .shipyard-orderable-ship uses, scoped locally here. */
    .spare-parts-ship {
        animation: spare-parts-ship-pulse 1.8s ease-in-out infinite;
    }
    @keyframes spare-parts-ship-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(61, 220, 132, 0.95)) drop-shadow(0 0 5px rgba(61, 220, 132, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 3px rgba(61, 220, 132, 1)) drop-shadow(0 0 9px rgba(61, 220, 132, 0.85));
        }
    }
</style>
