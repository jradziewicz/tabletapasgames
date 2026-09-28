<script lang="ts">
    import { CorporationId } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationDisplayNames,
        CorporationCharterIcons,
        CorporationShareCertificateIcons,
        CorporationStatusIcons,
        SHARE_CERTIFICATE_ASPECT
    } from '$lib/utils/corporationDisplay.js'
    import { ShipLevelIcons } from '$lib/utils/shipDisplay.js'
    import alienTechCube from '$lib/images/investor/alienTechCube.png'
    import MoneyStack from './MoneyStack.svelte'

    // The Corporation Charter's own printed art, with a live overlay of that Corporation's
    // "Ordered Ships" tracker on top - shared by the Charter tab (CharterPanel.svelte, just
    // browsing a Corporation's Charter) and the Order Ships action bar (OrderShipPanel.svelte,
    // where `queuedLevels` also previews Ships the President has clicked but not yet submitted -
    // see that file for the queue/"Purchase Ships" flow). Fills 100% of whatever
    // width/height/aspect-ratio the caller's own wrapper gives it, the same "caller sizes it"
    // pattern ShipyardPanel's compact mode uses.
    // onSelectDeliveredShip, when given, turns the bottom-row (delivered) Ship slots into
    // clickable buttons instead of plain art - used by Insurance Fraud (InvestorActionPanel.svelte)
    // to let the President pick a specific Delivered Ship straight off the Charter rather than
    // from a separate list. Left undefined everywhere else (the Charter tab, Order Ships), so
    // those stay exactly as before - plain, non-interactive art.
    let {
        corporationId,
        queuedLevels = [],
        onSelectDeliveredShip
    }: {
        corporationId: CorporationId
        queuedLevels?: number[]
        onSelectDeliveredShip?: (level: number, deliveredIndex: number) => void
    } = $props()

    const gameSession = getGameSession()
    const corporation = $derived(gameSession.gameState.getCorporation(corporationId))

    // 3 columns (TOTAL_SHIP_COLUMNS), each holding at most one Ship at a time as it moves
    // through the Charter - first into that column's top (hatched outline - "ordered, awaiting
    // delivery") slot, later down into its bottom (solid silhouette - "delivered") slot, per the
    // printed Charter art. Neither array carries its own column index, and Ships are always
    // delivered as a single all-at-once batch (see operations/shipOrdering.ts), so filling
    // columns left-to-right (ordered first, then delivered, then queued-but-not-yet-submitted)
    // never actually reshuffles an individual Ship's column out from under it in practice.
    const orderedLevels = $derived(corporation.orderedShipLevels)
    const deliveredLevels = $derived(corporation.deliveredShipLevels)

    // Measured directly against the new Charter art's own printed "Ordered Ships" tracker
    // (identical position on every Corporation's Charter - only the color/portrait differs): 3
    // column centers, a top row (the hatched Ship outline - "ordered, awaiting delivery") and a
    // bottom row (the solid Ship silhouette - "delivered") - found via a connected-components
    // pass over the art's own near-white pixels (dilated first, since the hatching's diagonal
    // stripes are otherwise disconnected from each other), not eyeballed. The new renders are
    // clean upright vector icons (see shipDisplay.ts), so - unlike the old photographed wooden
    // pieces - no rotation correction is needed to sit them straight.
    const CHARTER_COLUMN_X = [66.17, 78.77, 91.37]
    const CHARTER_TOP_ROW_Y = 17.2
    const CHARTER_BOTTOM_ROW_Y = 41.15
    const CHARTER_SHIP_HEIGHT_PCT = 16

    // Shares not yet issued (Corporation.availableShareCount) - shown as a small fanned stack of
    // the real Share Certificate art (see corporationDisplay.ts) sitting directly over the
    // Charter's own printed "Shares" badge in its bottom-right corner (found the same way the
    // Ships tracker's own slots were - a connected-components pass over the art's own flat fill
    // colors - rather than eyeballed): the badge is exactly sized and placed to hold this stack,
    // same "physical piece parked on its printed reminder spot" idea as remainingOutposts
    // elsewhere. One card per remaining Share (capped visually at 5, the most any Corporation
    // ever has - see SHARES_FOR_CORPORATION), splayed down-and-right per card (no rotation) - a
    // small resting splay by default, spreading out further on click so a player can see each
    // card's own art clearly without that larger spread being the permanent resting state.
    const remainingShares = $derived(corporation.availableShareCount)
    const SHARE_STACK_BOX = { left: 64, top: 62, width: 30 }
    const SHARE_STACK_CARD_WIDTH_PCT = 101 // 505% of the original 20 (5.05x)
    const SHARE_STACK_FAN_OFFSET_RESTING = 3
    const SHARE_STACK_FAN_OFFSET_EXPANDED = 12
    // The vertical peek is done via `transform: translateY()` rather than a `top` percentage -
    // this container div has no explicit height of its own (only width), so a percentage `top`
    // resolves against that (effectively zero/auto) height and barely moves at all. translateY()'s
    // percentage is relative to the IMAGE's own height instead, so it reliably works regardless of
    // how big SHARE_STACK_CARD_WIDTH_PCT is.
    const SHARE_STACK_VERTICAL_OFFSET_RESTING = 3
    const SHARE_STACK_VERTICAL_OFFSET_EXPANDED = 12

    // Toggles between the resting and expanded splay above on click.
    let shareStackExpanded = $state(false)
    const shareStackFanOffset = $derived(
        shareStackExpanded ? SHARE_STACK_FAN_OFFSET_EXPANDED : SHARE_STACK_FAN_OFFSET_RESTING
    )
    const shareStackVerticalOffset = $derived(
        shareStackExpanded ? SHARE_STACK_VERTICAL_OFFSET_EXPANDED : SHARE_STACK_VERTICAL_OFFSET_RESTING
    )

    // Alien Technology cubes physically sit on the Charter itself once spent there (rulebook
    // page 19's Investor Shenanigans): Research Wormhole spends 1 cube to set
    // corporation.wormholeActive, and Cargo Boost spends 1-2 cubes into
    // corporation.cargoBoostCubesOnCharter (independent of the Charter's raw cargo number, which
    // also moves for other reasons - see that field's own doc comment in model/corporation.ts).
    // All three boxes - two "Cargo" cube slots plus one "Wormhole" slot - sit in an identical row
    // printed on every Corporation's own Charter art (confirmed via a connected-components pass
    // per Charter, matching each one's own box fill color, not eyeballed): same 129x129px boxes,
    // same pixel bbox y-range (1226-1355) on every 2127x1536 Charter, just each Corporation's own
    // theme color instead of Amethyst Agency's purple. So one shared set of centers below covers
    // all six Charters - no per-Corporation map needed. Centered via translate(-50%,-50%) exactly
    // like the Ship icons above rather than a padding-based inset (percentage padding resolves
    // against the wrong containing block here and would have overflowed the box).
    const CARGO_CUBE_CENTERS = [
        { left: (706.5 / 2127) * 100, top: (1290.5 / 1536) * 100 },
        { left: (862.5 / 2127) * 100, top: (1290.5 / 1536) * 100 }
    ]
    const WORMHOLE_CUBE_CENTER = { left: (1098.5 / 2127) * 100, top: (1290.5 / 1536) * 100 }
    const ALIEN_TECH_CUBE_HEIGHT_PCT = ((129 / 1536) * 100) * 0.85
    const cargoBoostCubeCount = $derived(Math.min(corporation.cargoBoostCubesOnCharter ?? 0, CARGO_CUBE_CENTERS.length))

    // Corporation Treasury, shown as an actual messy pile of physical Money tokens (see
    // MoneyStack.svelte) sitting on top of the Charter's own printed planet art in its
    // bottom-left corner, rather than the plain Credits-symbol/number pairing used for it
    // elsewhere (e.g. PlayersPanel's Corporations list). The planet bleeds off the card's own
    // left/bottom edges, so only its upper-right wedge is actually visible within the card
    // bounds - this box sits well inside that visible wedge (clear of both the card edge and the
    // dividend-track hexes to its right), found the same eyeballed-against-a-crop way as the
    // circle's own edges (no flat fill color or sharp edge to run connected-components against,
    // since it's photographic planet art). MoneyStack fills this box itself, so - same
    // requirement as its own doc comment - the box needs both left/top AND width/height set in
    // %, not just width.
    const TREASURY_BOX = { left: 5, top: 68, width: 18, height: 22 }

    // Corporate Status marker (Private/Minor/Major - see model/corporation.ts's
    // HydratedCorporationState.status) - the co-designer's own die-cut punchboard piece for the
    // Corporation's current status, shown one at a time pinned to the top-right corner of the
    // not-yet-issued Share stack above (per the co-designer: "place these on top of the shares
    // on the corporation charter", then later "move it to the top right corner of the share and
    // have it overlap the share more"), tilted like a tag stuck on at an angle - rotated so its
    // right end dips below its left end - rather than sitting flat. Anchored by its own top-right
    // corner (transform-origin 100% 0%, positioned with `right`/`top` instead of the usual
    // `left`+translate(-50%,-50%) centering) so the rotation pivots exactly around that corner
    // with no compounding translate math. A high z-index keeps it drawn on top of the fanned
    // Share-certificate stack. CorporationStatusIcons has no entry at all for every Corporation's
    // Private status except Amethyst Agency's own explicit "PRIVATE" piece (see that map's own
    // doc comment) - everyone else simply shows no marker yet at Private.
    //
    // Reuses the Share stack's own shareStackExpanded toggle below (rather than tracking its own
    // separate state) so it slides further up and out of the way in lockstep with the stack's own
    // wider expanded fan, instead of getting buried under it - per the co-designer, "have it move
    // out with the stack when it is clicked on." The marker is made clickable too (mirroring the
    // stack container's own onclick/onkeydown) since it visually overlaps part of that stack's
    // clickable area - without its own handler, a click landing on the marker itself would be a
    // dead zone that does nothing instead of toggling the expansion like the card underneath it
    // would.
    const STATUS_MARKER_RESTING = { right: 8, top: 80 }
    const STATUS_MARKER_EXPANDED = { right: 3, top: 72 }
    const STATUS_MARKER_ROTATION_DEG = 30
    const STATUS_MARKER_HEIGHT_PCT = (115 / 1536) * 100
    const statusMarkerIcon = $derived(CorporationStatusIcons[corporationId]?.[corporation.status])
    const statusMarkerPosition = $derived(
        shareStackExpanded ? STATUS_MARKER_EXPANDED : STATUS_MARKER_RESTING
    )
</script>

<div class="relative h-full w-full">
    <img
        src={CorporationCharterIcons[corporationId]}
        alt="{CorporationDisplayNames[corporationId]} Charter"
        class="absolute inset-0 h-full w-full object-contain"
    />
    {#each CHARTER_COLUMN_X as columnX, columnIndex (columnIndex)}
        {#if columnIndex < orderedLevels.length}
            <img
                src={ShipLevelIcons[orderedLevels[columnIndex]]}
                alt="Level {orderedLevels[columnIndex]} Ship (ordered)"
                class="absolute drop-shadow"
                style="left: {columnX}%; top: {CHARTER_TOP_ROW_Y}%; height: {CHARTER_SHIP_HEIGHT_PCT}%; width: auto; transform: translate(-50%, -50%);"
            />
        {:else if columnIndex < orderedLevels.length + deliveredLevels.length}
            {@const deliveredIndex = columnIndex - orderedLevels.length}
            {@const deliveredLevel = deliveredLevels[deliveredIndex]}
            {#if onSelectDeliveredShip}
                <button
                    type="button"
                    onclick={() => onSelectDeliveredShip?.(deliveredLevel, deliveredIndex)}
                    class="absolute cursor-pointer rounded-full border-0 bg-transparent p-0 transition hover:brightness-125 hover:drop-shadow-[0_0_6px_#3ddc84]"
                    style="left: {columnX}%; top: {CHARTER_BOTTOM_ROW_Y}%; height: {CHARTER_SHIP_HEIGHT_PCT}%; width: auto; transform: translate(-50%, -50%);"
                    aria-label="Scrap Level {deliveredLevel} Ship"
                >
                    <img
                        src={ShipLevelIcons[deliveredLevel]}
                        alt="Level {deliveredLevel} Ship (delivered)"
                        class="pointer-events-none block h-full w-auto drop-shadow"
                    />
                </button>
            {:else}
                <img
                    src={ShipLevelIcons[deliveredLevel]}
                    alt="Level {deliveredLevel} Ship (delivered)"
                    class="absolute drop-shadow"
                    style="left: {columnX}%; top: {CHARTER_BOTTOM_ROW_Y}%; height: {CHARTER_SHIP_HEIGHT_PCT}%; width: auto; transform: translate(-50%, -50%);"
                />
            {/if}
        {:else}
            {@const stagedIndex = columnIndex - orderedLevels.length - deliveredLevels.length}
            {#if stagedIndex < queuedLevels.length}
                <!-- Same pulsing "not yet actually submitted" glow ShipyardPanel's own
                     next-to-buy Ship gets (see .charter-queued-ship below) - a plain ring would
                     draw a rectangle around this icon's bounding box instead of hugging its
                     actual silhouette, so this uses the same drop-shadow-based technique
                     instead. -->
                <img
                    src={ShipLevelIcons[queuedLevels[stagedIndex]]}
                    alt="Level {queuedLevels[stagedIndex]} Ship (queued)"
                    class="absolute charter-queued-ship"
                    style="left: {columnX}%; top: {CHARTER_TOP_ROW_Y}%; height: {CHARTER_SHIP_HEIGHT_PCT}%; width: auto; transform: translate(-50%, -50%);"
                />
            {/if}
        {/if}
    {/each}

    {#each { length: cargoBoostCubeCount } as _, index (index)}
        <img
            src={alienTechCube}
            alt="Alien Technology cube (Cargo Boost)"
            class="absolute drop-shadow"
            style="left: {CARGO_CUBE_CENTERS[index].left}%; top: {CARGO_CUBE_CENTERS[index].top}%; height: {ALIEN_TECH_CUBE_HEIGHT_PCT}%; width: auto; transform: translate(-50%, -50%);"
        />
    {/each}

    {#if corporation.wormholeActive}
        <img
            src={alienTechCube}
            alt="Alien Technology cube (Wormhole active)"
            class="absolute drop-shadow"
            style="left: {WORMHOLE_CUBE_CENTER.left}%; top: {WORMHOLE_CUBE_CENTER.top}%; height: {ALIEN_TECH_CUBE_HEIGHT_PCT}%; width: auto; transform: translate(-50%, -50%);"
        />
    {/if}

    {#if remainingShares > 0}
        <div
            class="absolute cursor-pointer"
            role="button"
            tabindex="0"
            onclick={() => (shareStackExpanded = !shareStackExpanded)}
            onkeydown={(e) => e.key === 'Enter' && (shareStackExpanded = !shareStackExpanded)}
            style="left: {SHARE_STACK_BOX.left}%; top: {SHARE_STACK_BOX.top}%; width: {SHARE_STACK_BOX.width}%;"
        >
            {#each { length: remainingShares } as _, index (index)}
                <img
                    src={CorporationShareCertificateIcons[corporationId]}
                    alt="{CorporationDisplayNames[corporationId]} Share Certificate"
                    class="absolute rounded-sm shadow-lg transition-all duration-150"
                    style="
                        width: {SHARE_STACK_CARD_WIDTH_PCT}%;
                        aspect-ratio: {SHARE_CERTIFICATE_ASPECT};
                        left: {index * shareStackFanOffset}%;
                        top: 0;
                        transform: translateY({index * shareStackVerticalOffset}%);
                        z-index: {index};
                    "
                />
            {/each}
        </div>
    {/if}

    <div
        class="absolute"
        style="left: {TREASURY_BOX.left}%; top: {TREASURY_BOX.top}%; width: {TREASURY_BOX.width}%; height: {TREASURY_BOX.height}%;"
    >
        <MoneyStack amount={corporation.treasury} seed={corporationId} />
    </div>

    {#if statusMarkerIcon}
        <div
            class="absolute cursor-pointer transition-all duration-150"
            role="button"
            tabindex="0"
            onclick={() => (shareStackExpanded = !shareStackExpanded)}
            onkeydown={(e) => e.key === 'Enter' && (shareStackExpanded = !shareStackExpanded)}
            style="right: {statusMarkerPosition.right}%; top: {statusMarkerPosition.top}%; height: {STATUS_MARKER_HEIGHT_PCT}%; transform: rotate({STATUS_MARKER_ROTATION_DEG}deg); transform-origin: 100% 0%; z-index: 10;"
        >
            <img
                src={statusMarkerIcon}
                alt="{CorporationDisplayNames[corporationId]} status: {corporation.status}"
                class="pointer-events-none block h-full w-auto drop-shadow"
            />
        </div>
    {/if}
</div>

<style>
    /* Mirrors ShipyardPanel.svelte's own .shipyard-orderable-ship exactly (same colors, same
       timing) - duplicated here rather than shared/imported since Svelte component styles are
       scoped per-file, but kept identical so a queued Ship reads as the same "not yet
       submitted" glow whether it's still shown in the Shipyard or already previewed here on the
       Charter. drop-shadow (rather than box-shadow/ring) follows this icon's own alpha channel -
       its actual silhouette - instead of drawing a generic rectangle around its bounding box. */
    .charter-queued-ship {
        animation: charter-queued-ship-pulse 1.8s ease-in-out infinite;
    }
    @keyframes charter-queued-ship-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(61, 220, 132, 0.95)) drop-shadow(0 0 5px rgba(61, 220, 132, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 3px rgba(61, 220, 132, 1)) drop-shadow(0 0 9px rgba(61, 220, 132, 0.85));
        }
    }
</style>
