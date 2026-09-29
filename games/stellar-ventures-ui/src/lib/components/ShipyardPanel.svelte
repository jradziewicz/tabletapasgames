<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { ShipyardSection } from '@tabletop/stellar-ventures'
    import { ShipLevelIcons, ShipAspect } from '$lib/utils/shipDisplay.js'
    import shipyardBanner from '$lib/images/shipyard/shipyardPanel.png'
    import alienTile0 from '$lib/images/shipyard/alienTile0.png'
    import alienTile1 from '$lib/images/shipyard/alienTile1.png'
    import alienTile2 from '$lib/images/shipyard/alienTile2.png'
    import alienTile3 from '$lib/images/shipyard/alienTile3.png'
    import alienTileHidden from '$lib/images/shipyard/alienTileHidden.png'

    const gameSession = getGameSession()

    // When set, this Shipyard render is being used as the interactive picker for the Order Ships
    // step (see OrderShipPanel.svelte) rather than as the plain reference tab in the workspace:
    // orderableLevel names the one section that can actually be ORDERED FROM right now (Ships can
    // only ever be Ordered from the Shipyard's current lowest available level - the "Lowest Level
    // First" restriction). That whole section is highlighted as one group (a pulsing green frame,
    // .shipyard-orderable-group below) and a click ANYWHERE in it orders one Ship immediately -
    // onSelectShip is what actually submits the order (see OrderShipPanel.svelte). The one
    // exception is a click that would flip a still-hidden Alien Shipyard tile (an irreversible
    // reveal Undo can't take back): needsConfirmation says so for a level, and then this only
    // calls onSelectShip (which asks the player to confirm) without removing any Ship yet.
    // The Ship that visibly leaves is the one nearest the click (the one actually clicked when the
    // click lands on a Ship), it fades out, and the rest glide into their new places (a FLIP
    // animation - see the layout effects below). compact drops the tab's own heading/scroll
    // chrome and renders at 100% of whatever width its own container gives it (rather than a
    // fixed fraction of its own root), since OrderShipPanel places it in a sized wrapper alongside
    // the Charter rather than as its own full-size tab.
    let {
        orderableLevel,
        onSelectShip,
        needsConfirmation,
        compact = false
    }: {
        orderableLevel?: number
        onSelectShip?: () => void | Promise<void>
        needsConfirmation?: (level: number) => boolean
        compact?: boolean
    } = $props()

    // Each level's box on the printed Shipyard track, as a percentage of the banner image's own
    // width/height - measured directly against shipyardPanel.png (4409x741) so the ship icons
    // overlay the actual printed boxes regardless of how large the banner is rendered. `top`/
    // `height` describe the open interior of a box (below its cost ribbon, above its bottom
    // border); `left`/`width` describe that box's own horizontal slice of the banner.
    const CONTENT_TOP = 6.38
    const CONTENT_HEIGHT = 91.18
    const SectionBoxLayout: Record<number, { left: number; width: number }> = {
        1: { left: 0.19, width: 20.05 },
        2: { left: 20.24, width: 19.86 },
        3: { left: 40.1, width: 19.88 },
        5: { left: 59.98, width: 19.88 },
        8: { left: 79.85, width: 19.89 }
    }

    // Ship icons stack in exactly two rows per box (rather than one tall overlapping row, or
    // overflowing into a third when a section is full) so they stay clear of the green
    // round-track hex/Alien Tile at the bottom of each box, and never spill past the box's own
    // top edge. ICON_HEIGHT_PCT is a CAP on their height (as a % of the box's own content
    // height), not a fixed size - sectionIconHeightPct below shrinks a section's Ships below it
    // only as far as actually needed to keep its fuller row from overflowing its own width; a
    // lightly-stocked section still draws its Ships at the full cap.
    const ICON_HEIGHT_PCT = 40
    const ROW_GAP_PCT = 6
    const ICON_GAP_PCT = 2

    // Real punchboard hex renders (SV_PUNCHBOARD_FINAL, page 5 - the actual Alien Shipyard
    // Tiles' chevron side, distinct from the Alien Agreement Tiles on pages 1/3) for the Alien
    // Shipyard Tile's four revealed faces (3, 2, 1, or 0 chevrons - the 0 tile prints a plain
    // red X rather than a chevron) plus its face-down back (page 6, a plain rocket silhouette).
    const AlienTileRevealedIcons: Record<number, string> = {
        0: alienTile0,
        1: alienTile1,
        2: alienTile2,
        3: alienTile3
    }

    // Where the Alien Shipyard Tile sits on the banner art - the 2nd-generation render (per the
    // game's co-designer) drops the old pre-printed green hex placeholder entirely, so this is no
    // longer snapped onto a printed slot; it keeps the same bottom-right corner the tile always
    // occupied, just at 67% of its old width/height (a 33% reduction), which also frees up real
    // width for splitRows/bottomRowWidthPct's own math below - previously the deciding factor in
    // why Level 3's Ships had to draw smaller than Level 2's just to clear the Tile's corner.
    const AlienTileBox = { left: 75.35, width: 24.05, top: 63.94, height: 32.96 }

    // The Level 8 section is unlimited - there's no real "remaining count" to draw - but an
    // empty box reads as broken, so it always shows a practical stand-in stack of Ships rather
    // than the true (infinite) supply.
    const UNLIMITED_DISPLAY_COUNT = 10

    // The box's own content-area aspect ratio (width/height, in real rendered pixels) - fixed at
    // compile time, since the whole banner scales as one rigid `aspect-ratio: 4409/741` block, so
    // a box's content width/height ratio never actually depends on how large the banner is
    // rendered - it only depends on that fixed banner aspect and this section's own box width.
    const BANNER_ASPECT = 4409 / 741
    function contentAspect(boxWidthPct: number): number {
        return ((boxWidthPct / 100) * BANNER_ASPECT) / (CONTENT_HEIGHT / 100)
    }

    // How much of a Ship row's own width the Alien Tile leaves free, for the bottom row of a
    // section that has one - the Tile sits in the bottom-right corner (see AlienTileBox),
    // starting at AlienTileBox.left (a % of the BOX's own width); converted here into a % of the
    // ship row's own width (which excludes the box's left/right padding - see the px-[3%] on its
    // container below) minus a small gap, so Ships never render flush against the Tile's edge.
    const CONTENT_SIDE_PADDING_PCT = 3
    const TILE_GAP_PCT = 2
    function bottomRowWidthPct(hasTile: boolean): number {
        if (!hasTile) return 100
        const contentWidthPct = 100 - CONTENT_SIDE_PADDING_PCT * 2
        const usableBoxPct = Math.max(0, AlienTileBox.left - CONTENT_SIDE_PADDING_PCT - TILE_GAP_PCT)
        return (usableBoxPct / contentWidthPct) * 100
    }

    // Splits a pile of Ships into exactly two rows - a fuller row on top, a lighter one on the
    // bottom. A section with an Alien Shipyard Tile gives its bottom row (which has less width
    // to work with - see bottomRowWidthPct) proportionally fewer Ships, so both rows end up
    // drawing their Ships at a similar size rather than the bottom row having to shrink hard just
    // to cram half the pile into its narrower space. A section with no Tile keeps a plain, even
    // top/bottom split since there's nothing back there to avoid.
    function splitRows(count: number, hasTile: boolean): number[] {
        if (!hasTile) {
            const top = Math.floor(count / 2)
            return [top, count - top].filter((n) => n > 0)
        }
        const widthRatio = bottomRowWidthPct(true) / 100
        const bottom = Math.min(count, Math.round((count * widthRatio) / (1 + widthRatio)))
        return [count - bottom, bottom].filter((n) => n > 0)
    }

    // The tallest a row's Ship icons can be drawn (as a % of the box's content height, same units
    // as ICON_HEIGHT_PCT) without that row's total width - n icons plus (n-1) gaps - overflowing
    // the width it actually has available, capped at ICON_HEIGHT_PCT so a lightly-stocked row
    // never draws oversized Ships just because it has the room.
    function rowIconHeightPct(shipCount: number, level: number, availableWidthPct: number): number {
        if (shipCount <= 0) return ICON_HEIGHT_PCT
        const aspect = ShipAspect[level] ?? 0.55
        const ratio = contentAspect(SectionBoxLayout[level]?.width ?? 20)
        const widthBudget = availableWidthPct - (shipCount - 1) * ICON_GAP_PCT
        const fitHeightPct = (widthBudget * ratio) / (shipCount * aspect)
        return Math.max(8, Math.min(ICON_HEIGHT_PCT, fitHeightPct))
    }

    // Both rows in a section share one Ship size (whichever of the two rows needs to be
    // smaller), rather than each row sizing independently - a uniform Ship size within a section
    // reads far better than a big top row over a visibly shrunken bottom row.
    function sectionIconHeightPct(counts: number[], level: number, hasTile: boolean): number {
        if (counts.length === 0) return ICON_HEIGHT_PCT
        const fits = counts.map((n, i) => {
            const isBottomRow = hasTile && i === counts.length - 1
            return rowIconHeightPct(n, level, isBottomRow ? bottomRowWidthPct(true) : 100)
        })
        return Math.min(...fits)
    }

    // ---- Which specific Ship leaves when one is ordered ----
    // Each section's Ships have stable ids (shipIds, in layout order), so clicking one removes
    // THAT Ship rather than always the last one in the layout. A clicked Ship is hidden at once
    // (pendingIds) while its order goes through; when the real supply then drops, the hidden Ship
    // is the one that gets dropped from shipIds, so nothing visibly jumps. When the supply changes
    // some other way (another player's order, an Undo), Ships are dropped from / added to the end.
    // If an order fails, the hidden Ship comes back once the attempt has settled.
    let shipIds = $state<Record<number, number[]>>({})
    let pendingIds = $state<Record<number, number[]>>({})

    function reconciledIds(level: number, supply: number): number[] {
        const current = shipIds[level] ?? Array.from({ length: supply }, (_, index) => index)
        if (current.length === supply) return current
        const ids = [...current]
        if (ids.length > supply) {
            const pending = [...(pendingIds[level] ?? [])].reverse()
            while (ids.length > supply) {
                const pendingIndex = pending.findIndex((id) => ids.includes(id))
                const removeId = pendingIndex >= 0 ? pending.splice(pendingIndex, 1)[0]! : ids[ids.length - 1]!
                ids.splice(ids.indexOf(removeId), 1)
            }
        } else {
            let next = Math.max(-1, ...ids) + 1
            while (ids.length < supply) ids.push(next++)
        }
        return ids
    }

    function visibleIdsFor(level: number, supply: number): number[] {
        const pending = new Set(pendingIds[level] ?? [])
        return reconciledIds(level, supply).filter((id) => !pending.has(id))
    }

    let bannerEl: HTMLDivElement | undefined = $state()
    const prefersReducedMotion = () =>
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    // The Ship that leaves: the one whose box is nearest the click (distance 0 when the click is
    // on a Ship), falling back to the last remaining Ship when none is on screen to measure (e.g.
    // the phone's "N [icon]" view).
    function orderFromGroup(
        event: MouseEvent | KeyboardEvent,
        level: number,
        visibleIds: number[]
    ) {
        if (visibleIds.length === 0) return
        if (needsConfirmation?.(level)) {
            void onSelectShip?.()
            return
        }
        let id = visibleIds[visibleIds.length - 1]!
        let element: Element | undefined
        if (bannerEl && 'clientX' in event) {
            let best = Infinity
            for (const candidate of bannerEl.querySelectorAll(`[data-ship^="${level}:"]`)) {
                const rect = candidate.getBoundingClientRect()
                if (rect.width === 0) continue
                const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right)
                const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom)
                const distance = Math.hypot(dx, dy)
                if (distance < best) {
                    best = distance
                    element = candidate
                    id = Number((candidate as HTMLElement).dataset.ship!.split(':')[1])
                }
            }
        }
        if (element) spawnGhost(element)
        pendingIds[level] = [...(pendingIds[level] ?? []), id]
        void Promise.resolve(onSelectShip?.()).finally(() => {
            // Still hidden once the attempt has settled means the order didn't go through.
            if (pendingIds[level]?.includes(id)) {
                pendingIds[level] = pendingIds[level]!.filter((pendingId) => pendingId !== id)
            }
        })
    }

    // A fading copy of the Ship that was just ordered, left behind for a moment where it was.
    function spawnGhost(element: Element) {
        if (!bannerEl || prefersReducedMotion()) return
        const banner = bannerEl.getBoundingClientRect()
        const rect = element.getBoundingClientRect()
        const ghost = element.cloneNode(true) as HTMLElement
        ghost.removeAttribute('data-ship')
        Object.assign(ghost.style, {
            position: 'absolute',
            left: `${rect.left - banner.left}px`,
            top: `${rect.top - banner.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            margin: '0',
            pointerEvents: 'none',
            zIndex: '5'
        })
        bannerEl.appendChild(ghost)
        const animation = ghost.animate(
            [
                { opacity: 1, transform: 'translateY(0) scale(1)' },
                { opacity: 0, transform: 'translateY(-14px) scale(0.6)' }
            ],
            { duration: 260, easing: 'ease-out' }
        )
        animation.onfinish = () => ghost.remove()
    }

    const sections = $derived(gameSession.gameState.shipyard.sections)

    function supplyFor(section: ShipyardSection): number {
        return section.unlimited ? UNLIMITED_DISPLAY_COUNT : section.remainingShips
    }

    // Persist the reconciled lists (and forget pending ids that are gone) before the DOM updates.
    // ($effect.pre runs synchronously where it is declared, so this must sit below `sections`
    // and `supplyFor` - declaring it earlier threw "Cannot access before initialization".)
    $effect.pre(() => {
        for (const section of sections) {
            const ids = reconciledIds(section.level, supplyFor(section))
            const stored = shipIds[section.level]
            if (!stored || stored.length !== ids.length || stored.some((id, i) => id !== ids[i])) {
                shipIds[section.level] = ids
            }
            const pending = pendingIds[section.level]
            if (pending && pending.some((id) => !ids.includes(id))) {
                pendingIds[section.level] = pending.filter((id) => ids.includes(id))
            }
        }
    })

    // ---- Reflow animation (FLIP) ----
    // layoutKey changes whenever any section's set of visible Ships does. Just before the DOM
    // updates for that, remember where every Ship is on screen; right after, slide each Ship
    // that moved from its old spot to its new one.
    const layoutKey = $derived(
        sections
            .map((section) => visibleIdsFor(section.level, supplyFor(section)).join('.'))
            .join('|')
    )
    let previousRects = new Map<string, DOMRect>()

    $effect.pre(() => {
        void layoutKey
        const rects = new Map<string, DOMRect>()
        for (const element of bannerEl?.querySelectorAll<HTMLElement>('[data-ship]') ?? []) {
            rects.set(element.dataset.ship!, element.getBoundingClientRect())
        }
        previousRects = rects
    })

    $effect(() => {
        void layoutKey
        if (bannerEl && !prefersReducedMotion()) {
            for (const element of bannerEl.querySelectorAll<HTMLElement>('[data-ship]')) {
                const before = previousRects.get(element.dataset.ship!)
                if (!before) continue
                const now = element.getBoundingClientRect()
                const dx = before.left - now.left
                const dy = before.top - now.top
                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
                element.animate(
                    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
                    { duration: 280, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
                )
            }
        }
        previousRects = new Map()
    })
</script>

<div class={compact ? 'text-[#e6e9f5]' : 'h-full overflow-y-auto p-4 text-[#e6e9f5]'}>
    {#if !compact}
        <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">Shipyard</h2>
    {/if}

    <!-- aspect-ratio (matching shipyardPanel.png's own 4409x741) gives this wrapper a real,
         definite height derived from its width, rather than one that only exists once the image
         has loaded. Percentage heights on the absolutely-positioned overlays below only resolve
         reliably against a definite ancestor height - without this, browsers can treat their
         height as unresolved and fall back to each ship icon's native pixel size, which is what
         was actually pushing them outside their boxes. -->
    <!-- compact mode fills 100% of whatever width its own container gives it (the caller
         controls sizing via a wrapper - see OrderShipPanel.svelte) rather than sizing itself
         against its own root element's width, which is otherwise indeterminate once this
         component sits inside a flex layout alongside other content. -->
    <div
        bind:this={bannerEl}
        class="relative mb-3"
        style="aspect-ratio: 4409 / 741; width: 100%; container-type: inline-size;"
    >
        <img
            src={shipyardBanner}
            alt="The Shipyard track, as printed on the board"
            class="absolute inset-0 h-full w-full rounded-lg border border-[#3a4166]"
        />

        {#each sections as section (section.level)}
            {@const box = SectionBoxLayout[section.level]}
            {#if box}
                {@const isOrderable = onSelectShip !== undefined && section.level === orderableLevel}
                {@const rawCount = supplyFor(section)}
                {@const visibleIds = visibleIdsFor(section.level, rawCount)}
                {@const displayCount = visibleIds.length}
                {@const hasTile = section.alienTileChevrons !== undefined}
                {@const rowCounts = splitRows(displayCount, hasTile)}
                {@const iconHeightPct = sectionIconHeightPct(rowCounts, section.level, hasTile)}
                <div class="absolute" style="left: {box.left}%; width: {box.width}%; top: 0%; height: 100%;">
                    <!-- The ships themselves: one icon per remaining Ship (or, for the unlimited
                         Level 8 section, a practical stand-in count), stacked in exactly two rows
                         in the box's open interior, sized just small enough (iconHeightPct - see
                         sectionIconHeightPct) that the fuller row never overflows its own width
                         or reaches into the Alien Tile's corner. -->
                    <div
                        class="absolute flex flex-col items-start justify-end px-[3%] pb-[6%] max-sm:hidden"
                        style="top: {CONTENT_TOP}%; height: {CONTENT_HEIGHT}%; left: 0; width: 100%; row-gap: {ROW_GAP_PCT}%;"
                    >
                        {#each rowCounts as rowCount, rowIndex (rowIndex)}
                            {@const rowStart = rowCounts.slice(0, rowIndex).reduce((sum, n) => sum + n, 0)}
                            <!-- w-full (rather than shrink-to-fit) so the gap below has a
                                 well-defined width to resolve against - a percentage/column gap
                                 on an auto-width flex row is an underspecified case that some
                                 browsers render as a much larger gap than intended, pushing the
                                 Ships outside their own box. The row also needs its OWN explicit
                                 height (not just "sized by its content") - a percentage height on
                                 the <img> below has nothing definite to resolve against
                                 otherwise, which is what was actually causing every Ship to fall
                                 back to its full native pixel size regardless of this component's
                                 math. -->
                            <div
                                class="flex w-full items-end justify-start"
                                style="height: {iconHeightPct}%; column-gap: {ICON_GAP_PCT}%;"
                            >
                                {#each visibleIds.slice(rowStart, rowStart + rowCount) as slot (slot)}
                                    <!-- data-ship identifies this Ship for the reflow animation and
                                         for picking which one leaves; clicks are handled by the
                                         group overlay drawn over the whole section (below). -->
                                    <img
                                        data-ship="{section.level}:{slot}"
                                        src={ShipLevelIcons[section.level]}
                                        alt="Level {section.level} Ship"
                                        class="drop-shadow"
                                        style="height: 100%; width: auto;"
                                    />
                                {/each}
                            </div>
                        {/each}
                    </div>

                    <!-- Phones: the whole pile is too small to read as individual Ships, so each
                         section shows just "N [icon]" (the count, then one Ship icon; ∞ for the
                         unlimited Level 8 section) instead. Text is sized off the banner's own
                         width (cqw - see the container-type on the banner) so it scales with the
                         art. Still the orderable target during the Order Ships picker. -->
                    {#if displayCount > 0 || section.unlimited}
                        <div
                            class="absolute flex items-end justify-start gap-[3%] px-[3%] pb-[6%] sm:hidden"
                            style="top: {CONTENT_TOP}%; height: {CONTENT_HEIGHT}%; left: 0; width: 100%;"
                        >
                            <span
                                class="font-semibold leading-none text-[#e6e9f5]"
                                style="font-size: 4.2cqw; padding-bottom: 1%;"
                            >{section.unlimited ? '∞' : displayCount}</span>
                            <img
                                src={ShipLevelIcons[section.level]}
                                alt="Level {section.level} Ship"
                                class="drop-shadow"
                                style="height: 70%; width: auto;"
                            />
                        </div>
                    {/if}

                    <!-- The Alien Shipyard Tile, for the sections that have one - sized and
                         positioned to land exactly on the hex slot already printed on the board
                         art (see AlienTileBox), face-down until this section's first Ship is
                         ordered. Placed after (so rendered on top of) the Ships above - at a
                         section's full starting Ship count the last Ship or two in the bottom row
                         can reach into this same corner, and the Tile (the more important piece
                         of state to keep readable) stays fully visible in front of them rather
                         than the reverse. -->
                    {#if section.alienTileChevrons !== undefined}
                        <img
                            src={section.alienTileRevealed
                                ? (AlienTileRevealedIcons[section.alienTileChevrons] ?? alienTileHidden)
                                : alienTileHidden}
                            alt={section.alienTileRevealed
                                ? `Alien Shipyard Tile - ${section.alienTileChevrons} chevron${section.alienTileChevrons === 1 ? '' : 's'}`
                                : 'Alien Shipyard Tile - hidden'}
                            class="absolute drop-shadow"
                            style="left: {AlienTileBox.left}%; top: {AlienTileBox.top}%; width: {AlienTileBox.width}%; height: {AlienTileBox.height}%;"
                        />
                    {/if}

                    {#if isOrderable && displayCount > 0}
                        <!-- The orderable section is highlighted as one group, and a click
                             anywhere in it orders a Ship (see orderFromGroup). Drawn last so it
                             sits over the Ships and the Alien Tile. -->
                        <div
                            class="shipyard-orderable-group absolute inset-[2px] cursor-pointer rounded-md"
                            role="button"
                            tabindex="0"
                            aria-label="Order a Level {section.level} Ship"
                            onclick={(event) =>
                                orderFromGroup(event, section.level, visibleIds)}
                            onkeydown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    orderFromGroup(event, section.level, visibleIds)
                                }
                            }}
                        ></div>
                    {/if}
                </div>
            {/if}
        {/each}
    </div>

</div>

<style>
    /* A gentle pulse on the currently-orderable section's highlight ring during the Order Ships
       picker (see the orderableLevel prop) - just enough motion to draw the eye to it without
       being distracting while the player is deciding. */
    /* The orderable section as one highlighted group: a pulsing green frame with a faint fill
       (the whole group is the click target - see orderFromGroup). */
    .shipyard-orderable-group {
        border: 2px solid rgba(61, 220, 132, 0.95);
        background: rgba(61, 220, 132, 0.06);
        animation: shipyard-orderable-group-pulse 1.8s ease-in-out infinite;
        transition: background-color 150ms;
    }
    .shipyard-orderable-group:hover {
        background: rgba(61, 220, 132, 0.16);
    }
    .shipyard-orderable-group:focus-visible {
        outline: 2px solid #ffffff;
        outline-offset: 1px;
    }
    @keyframes shipyard-orderable-group-pulse {
        0%,
        100% {
            box-shadow:
                0 0 4px rgba(61, 220, 132, 0.55),
                inset 0 0 6px rgba(61, 220, 132, 0.25);
        }
        50% {
            box-shadow:
                0 0 12px rgba(61, 220, 132, 0.95),
                inset 0 0 12px rgba(61, 220, 132, 0.5);
        }
    }
</style>

