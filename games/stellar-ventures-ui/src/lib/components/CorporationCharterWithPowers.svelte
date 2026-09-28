<script lang="ts">
    import { CorporationId } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CorporationCharter from './CorporationCharter.svelte'
    import {
        activePowerCardImageForSide,
        powerHasTwoSides,
        POWER_CARD_ASPECT,
        type PowerCardSide
    } from '$lib/utils/corporatePowerImages.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import {
        CHARTER_EDGE_TOP_PCT,
        CHARTER_NOTCH_SLOTS,
        CHARTER_NOTCH_CARD_HEIGHT_PCT_OF_CHARTER
    } from '$lib/utils/charterLayout.js'

    // Wraps CorporationCharter with that Corporation's held Corporate Powers overlaid on top -
    // shared by every place in the app that shows a Charter (the Charter tab, the Order Ships
    // action bar, and the Sign The Agreement walkthrough overlays), per the co-designer:
    // "whenever you show the charter in the game, include the corporate power images." A bare
    // CorporationCharter with no Powers on it should never appear anywhere a Corporation has
    // actually drafted Powers. Fills 100% of whatever width/height/aspect-ratio the caller's own
    // wrapper gives it - the caller must size a `position: relative` box with
    // `aspect-ratio: {CHARTER_ASPECT}` around this component, exactly like CorporationCharter
    // itself (this component renders CorporationCharter plus sibling absolutely-positioned Power
    // cards, with no extra wrapper div of its own).
    let {
        corporationId,
        queuedLevels = [],
        interactive = true,
        onSelectDeliveredShip
    }: {
        corporationId: CorporationId
        queuedLevels?: number[]
        interactive?: boolean
        onSelectDeliveredShip?: (level: number, deliveredIndex: number) => void
    } = $props()

    const gameSession = getGameSession()
    const corporation = $derived(gameSession.gameState.getCorporation(corporationId))

    // Which face of each held Power is currently showing - a click on the card flips it in
    // place (disabled when `interactive` is false, e.g. inside a walkthrough overlay that's
    // driving the flip itself). Defaults to 'front' (the compact icon face).
    let sideById = $state<Record<string, PowerCardSide>>({})
    function sideFor(powerId: string): PowerCardSide {
        return sideById[powerId] ?? 'front'
    }
    function flip(powerId: string) {
        if (!interactive || !powerHasTwoSides(powerId)) {
            return
        }
        sideById = { ...sideById, [powerId]: sideFor(powerId) === 'front' ? 'back' : 'front' }
    }

    const activePowerCards = $derived(
        (corporation?.powers ?? [])
            .map((power) => ({
                id: power.id,
                image: activePowerCardImageForSide(corporationId, power.id, sideFor(power.id))
            }))
            .filter((power): power is { id: string; image: string } => !!power.image)
    )

    // The Charter art's own bottom edge is NOT the bottom of the 2127x1536 image file - most of
    // that edge sits at y=1484 (measured off the art's own alpha channel; identical across all 6
    // Corporations' Charters), with only the planet graphic's own round bulge (far left) actually
    // reaching the file's true bottom at y=1535. Everything from y=1484 down (across the rest of
    // the width) is fully transparent - including two shallow scalloped notches cut into that
    // edge, at x=[610,1148] and x=[1407,1945], where a held Power tile is meant to physically
    // rest. Because that space is transparent, a held Power's card art is drawn as an OVERLAY
    // inside the Charter's own box - positioned to start right at that y=1484 line and hang down
    // into (and past) the otherwise-empty bottom margin - rather than as a separate element
    // stacked below the Charter box, which would count the empty margin twice and leave a visible
    // gap (the co-designer: "put the power over the charter image... it's intended to fit there
    // so it won't obscure anything"). A Corporation holding more than 2 Powers at once falls back
    // to a second overlaid row further down, using the same two column positions. This geometry
    // is shared (charterLayout.ts) with the Sign The Agreement walkthrough's own Charter overlays
    // in Board.svelte, so both line up on the exact same slots.
    const notchSlots = CHARTER_NOTCH_SLOTS
    // Grouped 2-per-row (matching the physical Charter's own 2 notches), so a third+ held Power
    // starts a new row underneath using the same two column positions.
    const activePowerRows = $derived(
        activePowerCards.reduce<(typeof activePowerCards)[number][][]>((rows, power, index) => {
            const rowIndex = Math.floor(index / notchSlots.length)
            rows[rowIndex] ??= []
            rows[rowIndex]!.push(power)
            return rows
        }, [])
    )
</script>

<CorporationCharter {corporationId} {queuedLevels} {onSelectDeliveredShip} />

{#each activePowerRows as row, rowIndex (rowIndex)}
    {#each row as power, columnIndex (power.id)}
        {@const slot = notchSlots[columnIndex]!}
        {#if interactive}
            <button
                type="button"
                onclick={() => flip(power.id)}
                class="absolute border-0 bg-transparent p-0"
                style="left: {slot.left}%; width: {slot.width}%; top: {CHARTER_EDGE_TOP_PCT + rowIndex * CHARTER_NOTCH_CARD_HEIGHT_PCT_OF_CHARTER}%; aspect-ratio: {POWER_CARD_ASPECT};"
                aria-label="Flip {CorporatePowerDisplayNames[power.id] ?? power.id}"
            >
                <img
                    src={power.image}
                    alt={CorporatePowerDisplayNames[power.id] ?? power.id}
                    class="block h-full w-full"
                />
            </button>
        {:else}
            <div
                class="pointer-events-none absolute"
                style="left: {slot.left}%; width: {slot.width}%; top: {CHARTER_EDGE_TOP_PCT + rowIndex * CHARTER_NOTCH_CARD_HEIGHT_PCT_OF_CHARTER}%; aspect-ratio: {POWER_CARD_ASPECT};"
            >
                <img
                    src={power.image}
                    alt={CorporatePowerDisplayNames[power.id] ?? power.id}
                    class="block h-full w-full"
                />
            </div>
        {/if}
    {/each}
{/each}
