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
    // orderableLevel names the one section that can actually be ADDED TO right now (Ships can
    // only ever be Ordered from the Shipyard's current lowest available level - the "Lowest Level
    // First" restriction - recomputed client-side as picks are staged, since more than one can be
    // queued before anything is actually submitted), whose Ships become clickable; onSelectShip
    // fires when the player clicks any of them. Clicking only STAGES that choice - see
    // OrderShipPanel.svelte's own queue-then-"Purchase Ships" flow, which is what actually
    // submits the real OrderShip actions - because a real Order Ship is real money and, for a
    // section's first-ever Ship, an irreversible Alien Tile flip revealing secret information,
    // neither of which should happen before the President has finished picking everything they
    // want and explicitly pulled the trigger. `stagedCountByLevel` gives, per Ship level, how
    // many are currently queued but not yet submitted - draws that many fewer Ships here (they
    // read as having moved to the Charter instead). Rather than ringing the WHOLE orderable
    // section's box (which used to include a lot of empty box padding, its cost ribbon, and the
    // Alien Tile corner - none of which is actually what's being bought), only the single
    // topmost-leftmost remaining Ship icon in that section - the one that would actually move to
    // the Charter next - gets a pulsing green glow shaped to its own silhouette (see
    // .shipyard-orderable-ship below), per the co-designer's own preference.
    // `sectionsOverride`, when given, is drawn instead of the live Shipyard - used to freeze this
    // view during Purchase Ships' own multi-action submission (see OrderShipPanel.svelte) so nothing
    // here appears to change - in particular no Alien Tile flips - until the whole purchase
    // finishes and the real (by-then-matching) state takes back over. compact drops the tab's own
    // heading/scroll chrome and renders at 100% of whatever width its own container gives it
    // (rather than a fixed fraction of its own root), since OrderShipPanel places it in a sized
    // wrapper alongside the Charter rather than as its own full-size tab.
    let {
        orderableLevel,
        stagedCountByLevel = {},
        onSelectShip,
        compact = false,
        sectionsOverride
    }: {
        orderableLevel?: number
        stagedCountByLevel?: Record<number, number>
        onSelectShip?: () => void
        compact?: boolean
        sectionsOverride?: ShipyardSection[]
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

    const shipIndices = (n: number) => Array.from({ length: n }, (_, i) => i)

    const sections = $derived(sectionsOverride ?? gameSession.gameState.shipyard.sections)
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
    <div class="relative mb-3" style="aspect-ratio: 4409 / 741; width: 100%;">
        <img
            src={shipyardBanner}
            alt="The Shipyard track, as printed on the board"
            class="absolute inset-0 h-full w-full rounded-lg border border-[#3a4166]"
        />

        {#each sections as section (section.level)}
            {@const box = SectionBoxLayout[section.level]}
            {#if box}
                {@const isOrderable = onSelectShip !== undefined && section.level === orderableLevel}
                {@const stagedCount = stagedCountByLevel[section.level] ?? 0}
                {@const rawCount = section.unlimited ? UNLIMITED_DISPLAY_COUNT : section.remainingShips}
                <!-- Every Ship from this section that's currently staged (queued but not yet
                     submitted - see OrderShipPanel.svelte) draws one fewer here, so it visually
                     reads as having moved out to the Corporation Charter's Ordered Ships tracker
                     rather than still sitting in the Shipyard twice at once. -->
                {@const displayCount = Math.max(0, rawCount - stagedCount)}
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
                        class="absolute flex flex-col items-start justify-end px-[3%] pb-[6%]"
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
                                {#each shipIndices(rowCount) as shipIndex (shipIndex)}
                                    <!-- The very first remaining Ship overall in this section (top
                                         row, leftmost - the one a player would naturally reach
                                         for first) is the one that would actually move to the
                                         Charter next - only it gets the pulsing highlight, not
                                         the whole box (see this component's own top comment). A
                                         plain ring would draw a rectangle around this
                                         Ship icon's bounding box, leaving an obviously generic
                                         gap in its transparent corners - drop-shadow instead
                                         follows the icon's own alpha silhouette exactly, so the
                                         glow actually hugs the Ship's shape (see
                                         .shipyard-orderable-ship below). -->
                                    {@const isNextToBuy = isOrderable && rowStart + shipIndex === 0}
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                                    <img
                                        src={ShipLevelIcons[section.level]}
                                        alt="Level {section.level} Ship"
                                        class="{isNextToBuy ? '' : 'drop-shadow'} {isOrderable
                                            ? 'origin-bottom cursor-pointer transition-transform hover:scale-110'
                                            : ''} {isNextToBuy ? 'shipyard-orderable-ship' : ''}"
                                        style="height: 100%; width: auto;"
                                        onclick={isOrderable ? () => onSelectShip?.() : undefined}
                                    />
                                {/each}
                            </div>
                        {/each}
                    </div>

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
                </div>
            {/if}
        {/each}
    </div>

</div>

<style>
    /* A gentle pulse on the currently-orderable section's highlight ring during the Order Ships
       picker (see the orderableLevel prop) - just enough motion to draw the eye to it without
       being distracting while the player is deciding. */
    /* A pulsing glow around the single next-to-buy Ship icon (see isNextToBuy above) - using
       drop-shadow rather than box-shadow/ring specifically because drop-shadow follows an
       image's own alpha channel (its actual silhouette) rather than its rectangular bounding
       box, so this hugs the Ship's real outline instead of drawing a generic rectangle around
       it. Layering two drop-shadows (a tight one plus a softer, wider one) reads as a solid
       outline with a glow behind it, rather than just a blurry halo. Replaces this icon's
       ordinary drop-shadow (see the drop-shadow/shipyard-orderable-ship class toggle above) so
       the two effects never stack redundantly. */
    .shipyard-orderable-ship {
        animation: shipyard-orderable-ship-pulse 1.8s ease-in-out infinite;
    }
    @keyframes shipyard-orderable-ship-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(61, 220, 132, 0.95)) drop-shadow(0 0 5px rgba(61, 220, 132, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 3px rgba(61, 220, 132, 1)) drop-shadow(0 0 9px rgba(61, 220, 132, 0.85));
        }
    }
</style>

