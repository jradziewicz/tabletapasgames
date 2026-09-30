<script lang="ts">
    import {
        BoardMap,
        CorporationId,
        CorporationStatus,
        dividendRowForCargo,
        dividendRowForMiningCapacity,
        effectiveMiningCapacityForCorporation,
        MAX_DIVIDEND_ROW
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    // Two printed-chart variants: the original Alpha map art, and the Borders & Taxes map's own
    // copy (same numbers/layout, re-rendered by the co-designer from source with three added
    // rings circling the 10/20/30 Mining Capacity values where a Border activates - see
    // BorderZoneColors in borderZoneDisplay.ts for those same three colors). The two images
    // aren't pixel-identical re-crops of each other (their aspect ratios differ by about 0.8%),
    // so which one is showing also picks which grid-geometry constants below apply.
    import dividendChartAlpha from '$lib/images/shipyard/dividendChart.png'
    import dividendChartBordersAndTaxes from '$lib/images/shipyard/dividendChartBordersAndTaxes.png'
    import gambogeGuildMarker from '$lib/images/markers/gambogeGuild.png'
    import pinkIncMarker from '$lib/images/markers/pinkInc.png'
    import scarletSyndicateMarker from '$lib/images/markers/scarletSyndicate.png'
    import ceruleanCouncilMarker from '$lib/images/markers/ceruleanCouncil.png'
    import frostFederatedMarker from '$lib/images/markers/frostFederated.png'
    import amethystAgencyMarker from '$lib/images/markers/amethystAgency.png'
    import alienMarker from '$lib/images/markers/alien.png'
    import gambogeGuild40Plus from '$lib/images/markers/gambogeGuild40Plus.png'
    import pinkInc40Plus from '$lib/images/markers/pinkInc40Plus.png'
    import scarletSyndicate40Plus from '$lib/images/markers/scarletSyndicate40Plus.png'
    import ceruleanCouncil40Plus from '$lib/images/markers/ceruleanCouncil40Plus.png'
    import frostFederated40Plus from '$lib/images/markers/frostFederated40Plus.png'
    import amethystAgency40Plus from '$lib/images/markers/amethystAgency40Plus.png'
    import alien40Plus from '$lib/images/markers/alien40Plus.png'

    const gameSession = getGameSession()

    // Optional "pin to a before snapshot, then release" overrides for
    // FirstShipOrderedRevealOverlay.svelte's dramatic reveal (session.svelte.ts's
    // firstShipOrderedReveal) - when passed, rawMarkers below uses these instead of the live
    // corporation.cargo / alienCorporation.miningCapacity figures. Every other caller (the plain
    // Dividend Chart tab) leaves both undefined and this renders exactly as it always has.
    let {
        cargoOverrides,
        alienMiningCapacityOverride,
        highlightAlienMiningMarker = false,
        alienMiningMarkerClickable = false,
        onAlienMiningMarkerClick,
        backroomDealTargetCapacities,
        onSelectBackroomDealTarget,
        deepSpaceSmugglingClickableCorporationIds,
        onSelectDeepSpaceSmugglingTarget,
        deepSpacePiratesClickableCorporationIds,
        onSelectDeepSpacePiratesTarget,
        payoutHighlight,
        onlyCorporationId
    }: {
        cargoOverrides?: Partial<Record<CorporationId, number>>
        alienMiningCapacityOverride?: number
        // Hostile Takeover's own reveal (HostileTakeoverRevealOverlay.svelte) draws attention to
        // the Alien Corporation's Mining Capacity marker - it's the number every signed
        // Corporation gets compared against - with a pulsing green glow, same technique as
        // ShipyardPanel's orderable-Ship highlight. Every other caller leaves this false and
        // this renders exactly as it always has.
        highlightAlienMiningMarker?: boolean
        // Backroom Deal's own interactive chart (BackroomDealPanel.svelte): true while the
        // deciding President hasn't yet clicked the glowing Alien Mining Capacity marker to
        // reveal where it could move. Every other caller leaves this false, and the marker keeps
        // its normal splay-a-stacked-pile click behavior instead.
        alienMiningMarkerClickable?: boolean
        onAlienMiningMarkerClick?: () => void
        // The 1-2 Mining Capacity values (already +/-BACKROOM_DEAL_MINING_CAPACITY_DELTA and
        // floor-clamped by the caller) to draw as clickable "could move here" ghost markers,
        // once the President has clicked the glowing Alien marker above. Always the Alien
        // Corporation's own candidate destinations - never a live game marker.
        backroomDealTargetCapacities?: number[]
        onSelectBackroomDealTarget?: (targetMiningCapacity: number) => void
        // Deep Space Smuggling's own interactive chart (DeepSpaceSmugglingPanel.svelte): once
        // the deciding President has hit Apply, the OTHER active Corporations' own real CARGO
        // markers (not ghost markers - Smuggling copies a genuinely live value, so there's
        // nothing to fabricate a position for) pulse and become clickable, letting the President
        // pick which one to copy directly off the chart. Every other caller leaves this
        // undefined/empty and Cargo markers keep their normal (non-interactive) look.
        deepSpaceSmugglingClickableCorporationIds?: CorporationId[]
        onSelectDeepSpaceSmugglingTarget?: (corporationId: CorporationId) => void
        // Deep Space Pirates' own interactive chart (DeepSpacePiratesPanel.svelte) - same idea
        // as Deep Space Smuggling above, just pulsing/clicking the OTHER active Corporations'
        // own real Mining Capacity markers instead of their Cargo markers (Pirates copies Mining
        // Capacity rather than Cargo when determining Dividends). Every other caller leaves this
        // undefined/empty and Mining Capacity markers keep their normal (non-interactive) look.
        deepSpacePiratesClickableCorporationIds?: CorporationId[]
        onSelectDeepSpacePiratesTarget?: (corporationId: CorporationId) => void
        // Deep Space Smuggling's own "what would this actually pay?" callout
        // (DeepSpaceSmugglingPanel.svelte): pulses the printed payout figure itself, in the
        // chart's own right-hand payout table (Private/Minor/Major columns), for whichever
        // row/status the President is currently looking at - the live current payout before
        // Applying, then the previewed new payout once a target Corporation is picked. Every
        // other caller leaves this undefined and the payout table renders exactly as it always
        // has.
        payoutHighlight?: { row: number; status: CorporationStatus }
        // The End Operations confirmation preview (ExpandNetworkPanel.svelte): shows just this
        // one Corporation's own Cargo/Mining Capacity markers, dropping every other
        // Corporation's markers AND the Alien Corporation's own marker (not this Corporation's
        // token, and not part of comparing its own two rows for payoutHighlight above) - a
        // focused "here's what YOUR turn is about to pay" view rather than the full board-state
        // chart every other caller shows. Every other caller leaves this undefined.
        onlyCorporationId?: CorporationId
    } = $props()

    // Real wooden-piece renders (SV_WOODEN_01, pages 12-17 for the Corporations, page 18 for the
    // Alien Corporation), one marker design per Corporation - the same design is used for both
    // its Cargo and Mining Capacity token, since the physical pieces are identical.
    const CorporationMarkerIcons: Record<CorporationId, string> = {
        [CorporationId.GambogeGuild]: gambogeGuildMarker,
        [CorporationId.PinkInc]: pinkIncMarker,
        [CorporationId.ScarletSyndicate]: scarletSyndicateMarker,
        [CorporationId.CeruleanCouncil]: ceruleanCouncilMarker,
        [CorporationId.FrostFederated]: frostFederatedMarker,
        [CorporationId.AmethystAgency]: amethystAgencyMarker
    }

    // "40+" overflow flags - the real physical punchboard tokens (cut from the same die-cut
    // shape as the power cards, one per Corporation plus the Alien Corporation), placed in the
    // chart's bottom row once a Corporation's Mining Capacity has wrapped around at least once
    // (lapCountForDisplay > 0, see below). These sit alongside whatever marker is currently
    // occupying that row - they're a standing "this company has gone around at least once" flag,
    // not the moving marker itself.
    const Corporation40PlusIcons: Record<string, string> = {
        [CorporationId.GambogeGuild]: gambogeGuild40Plus,
        [CorporationId.PinkInc]: pinkInc40Plus,
        [CorporationId.ScarletSyndicate]: scarletSyndicate40Plus,
        [CorporationId.CeruleanCouncil]: ceruleanCouncil40Plus,
        [CorporationId.FrostFederated]: frostFederated40Plus,
        [CorporationId.AmethystAgency]: amethystAgency40Plus,
        alien: alien40Plus
    }
    // All 7 physical "40+" tokens share the same die-cut size (284x206 as cut from the
    // punchboard).
    const FORTY_PLUS_ASPECT = 284 / 206
    // Width/height of each marker's own trimmed art, so a marker sized by height alone still
    // renders at its real proportions instead of being stretched or squashed.
    const MarkerAspect: Record<string, number> = {
        gambogeGuild: 390 / 341,
        pinkInc: 320 / 398,
        scarletSyndicate: 356 / 362,
        ceruleanCouncil: 275 / 386,
        frostFederated: 355 / 372,
        amethystAgency: 420 / 363,
        alien: 308 / 386
    }

    // Which printed chart is showing - the Alpha map's original art, or the Borders & Taxes
    // map's own copy with the added 10/20/30 rings (see the import comment above). Everything
    // below that depends on the chart's own pixel dimensions branches on this.
    const boardMap = $derived(gameSession.gameState.boardMap ?? BoardMap.Alpha)
    const isBordersAndTaxes = $derived(boardMap === BoardMap.BordersAndTaxes)
    const dividendChart = $derived(
        isBordersAndTaxes ? dividendChartBordersAndTaxes : dividendChartAlpha
    )

    // Grid geometry measured directly against each chart image, via pixel-level detection of
    // every horizontal divider line - 14 uniform rows, "13+" at the top down to "0" at the
    // bottom, plus a CARGO column and a 3-wide Mining Capacity zone (mining values are banded in
    // groups of 3 per row, one value per sub-column). All 14 rows are the same height, including
    // "13+" - a linear fit through all 14 divider positions comes out accurate to well under a
    // pixel per row. The Alpha chart is 1774x2652; the Borders & Taxes chart is 1820x2698 - not
    // quite the same aspect ratio (about 0.8% off), which is why HEADER_BOTTOM/ROW_HEIGHT need
    // their own measurement per image while every horizontal constant below held steady across
    // the re-render and is left as originally measured.
    const CHART_WIDTH = $derived(isBordersAndTaxes ? 1820 : 1774)
    const CHART_HEIGHT = $derived(isBordersAndTaxes ? 2698 : 2652)
    const HEADER_BOTTOM = $derived(isBordersAndTaxes ? 9.4313 : 8.847)
    const ROW_HEIGHT = $derived(isBordersAndTaxes ? 6.402 : 6.5146)
    const CARGO_COL = { left: 0, width: 16.57 }
    const MINING_ZONE = { left: 16.57, width: 38.95 }
    const MINING_SUBCOLS = [
        { left: 16.57, width: 13.05 },
        { left: 29.62, width: 12.88 },
        { left: 42.5, width: 13.02 }
    ]
    const MARKER_HEIGHT_PCT = 5.44 // of the chart image's own height
    const FORTY_PLUS_HEIGHT_PCT = MARKER_HEIGHT_PCT * 0.744

    // The payout table's own 3 columns (to the right of the arrow column), measured the same
    // way as CARGO_COL/MINING_ZONE above - grid divider lines detected directly off
    // dividendChart.png. Rows share the same HEADER_BOTTOM/ROW_HEIGHT as the rest of the chart.
    const PAYOUT_COLS: Record<CorporationStatus, { left: number; width: number }> = {
        [CorporationStatus.Private]: { left: 61.33, width: 12.85 },
        [CorporationStatus.Minor]: { left: 74.18, width: 12.97 },
        [CorporationStatus.Major]: { left: 87.15, width: 12.85 }
    }
    // A generous inset around wherever the printed "$X" figure actually sits within its cell
    // (measured across both 1- and 2-digit values so it comfortably covers either) - tighter
    // than the full cell so the pulse reads as "this number" rather than "this whole row".
    const PAYOUT_HIGHLIGHT_INSET_X_PCT = 12
    const PAYOUT_HIGHLIGHT_INSET_Y_PCT = 18

    // The printed chart only has room for Mining Capacity 0-39 (13 rows of 3, plus row 0 itself)
    // - Mining Capacity itself is never capped anywhere in the engine (Corporate Share Value and
    // the Dividend row lookup both use the real, uncapped number - see operations/liquidation.ts
    // and operations/dividends.ts), it just has nowhere further to go on this one printed board.
    // Per the co-designer: once a token would go past the top of the chart, it wraps back around
    // to the bottom and keeps climbing from there - so 40 sits where 0 does, 43 sits where 3
    // does, 46 sits where 6 does, and so on every 40. wrapMiningCapacityForDisplay is ONLY for
    // choosing where to draw the marker; every payout formula keeps using the real value
    // untouched. lapCountForDisplay (0 = hasn't wrapped yet, 1 = wrapped once, i.e. the real
    // value is 40-79, etc.) is exposed on each marker so a future "wrapped around" badge/marker
    // (the co-designer is supplying dedicated art for this) has something to key off without
    // recomputing it - not rendered yet.
    const MINING_CAPACITY_TRACK_LENGTH = 40

    function wrapMiningCapacityForDisplay(miningCapacity: number): number {
        return miningCapacity % MINING_CAPACITY_TRACK_LENGTH
    }

    function lapCountForDisplay(miningCapacity: number): number {
        return Math.floor(miningCapacity / MINING_CAPACITY_TRACK_LENGTH)
    }

    function rowTop(row: number) {
        return HEADER_BOTTOM + (MAX_DIVIDEND_ROW - row) * ROW_HEIGHT
    }

    // Where a bare Mining Capacity value lands on the printed chart, as a %/% center point -
    // the same row/sub-column math rawMarkers below already does for every live Corporation and
    // Alien marker, factored out so Backroom Deal's own two candidate-destination ghost markers
    // (backroomDealTargetMarkers below) can reuse it for a value that isn't any marker's real,
    // current position.
    function miningCellPosition(miningCapacity: number): { left: number; top: number } {
        const wrapped = wrapMiningCapacityForDisplay(miningCapacity)
        const row = dividendRowForMiningCapacity(wrapped)
        const subIndex = wrapped > 0 ? (wrapped - 1) % 3 : undefined
        const subCol = subIndex === undefined ? MINING_ZONE : MINING_SUBCOLS[subIndex]!
        return {
            left: subCol.left + subCol.width / 2,
            top: rowTop(row) + ROW_HEIGHT / 2
        }
    }

    type Track = 'cargo' | 'mining'
    type RawMarker = {
        key: string
        label: string
        iconKey: string
        icon: string
        track: Track
        cellKey: string
        cellLeft: number
        cellWidth: number
        row: number
        // Mining Capacity only - how many full laps of the chart this marker's real value
        // represents (0 = not wrapped). Always 0 for Cargo, which never wraps. See
        // MINING_CAPACITY_TRACK_LENGTH above.
        lap: number
    }
    type PlacedMarker = RawMarker & {
        left: number
        top: number
        aspect: number
        zIndex: number
        groupSize: number
    }

    // Markers that land on the same cell are grouped and arranged per-track:
    //   - Mining Capacity: they stack directly on top of one another (a small cascade offset so
    //     it reads as a pile rather than one marker), with the most recently added one on top.
    //     Hovering any marker in a stacked pile splays them apart so all are visible and they
    //     restack when the pointer leaves (hover-only, no click, like every other splay in the
    //     game). "Most recently added" has no real timestamp in the game state, so
    //     this uses each marker's position in `raw` (Corporations in turn order, Alien last) as
    //     a stand-in - the last one built is treated as the newest and drawn on top.
    //   - Cargo: the first two Corporations to land on a cell sit side by side; a third (or
    //     later) stacks on top of that pair, in the middle, rather than splitting into a 3-wide
    //     row.
    function place(raw: RawMarker[], splayedCellKey: string | undefined): PlacedMarker[] {
        const groups = new Map<string, RawMarker[]>()
        for (const m of raw) {
            const arr = groups.get(m.cellKey) ?? []
            arr.push(m)
            groups.set(m.cellKey, arr)
        }
        const result: PlacedMarker[] = []
        for (const [cellKey, group] of groups) {
            const n = group.length
            const centerLeft = group[0]!.cellLeft + group[0]!.cellWidth / 2
            const centerTop = rowTop(group[0]!.row) + ROW_HEIGHT / 2
            const cellWidth = group[0]!.cellWidth

            group.forEach((m, i) => {
                let left = centerLeft
                let top = centerTop
                let zIndex = i

                if (m.track === 'cargo') {
                    if (n >= 2 && i === 0) {
                        left = centerLeft - cellWidth * 0.24
                    } else if (n >= 2 && i === 1) {
                        left = centerLeft + cellWidth * 0.24
                    }
                    if (i >= 2) {
                        // Stacks on top of the side-by-side pair, in the middle, with a small
                        // cascade so a third/fourth marker is still distinguishable.
                        top = centerTop - (i - 1) * 0.5
                        zIndex = 10 + i
                    }
                } else if (n > 1) {
                    if (splayedCellKey === cellKey) {
                        const spread = (i - (n - 1) / 2) * 0.55
                        const jitter = i % 2 === 0 ? -0.55 : 0.55
                        left = centerLeft + spread * cellWidth
                        top = centerTop + jitter
                    } else {
                        // Stacked pile - a small cascade toward the upper-right per item, newest
                        // (highest index) on top and closest to dead-center.
                        left = centerLeft + i * cellWidth * 0.035
                        top = centerTop - i * 0.4
                        zIndex = i
                    }
                }

                result.push({
                    ...m,
                    left,
                    top,
                    zIndex,
                    groupSize: n,
                    aspect: MarkerAspect[m.iconKey] ?? 1
                })
            })
        }
        return result
    }

    const activeCorporations = $derived(
        gameSession.gameState.corporations.filter(
            (corporation) =>
                corporation.active && (!onlyCorporationId || corporation.id === onlyCorporationId)
        )
    )

    const rawMarkers = $derived.by(() => {
        const raw: RawMarker[] = []
        for (const corporation of activeCorporations) {
            const name = CorporationDisplayNames[corporation.id]
            const icon = CorporationMarkerIcons[corporation.id]
            const cargo = cargoOverrides?.[corporation.id] ?? corporation.cargo
            const cargoRow = dividendRowForCargo(cargo)
            raw.push({
                key: `${corporation.id}-cargo`,
                label: `${name} - Cargo ${cargo}`,
                iconKey: corporation.id,
                icon,
                track: 'cargo',
                cellKey: `cargo-${cargoRow}`,
                cellLeft: CARGO_COL.left,
                cellWidth: CARGO_COL.width,
                row: cargoRow,
                lap: 0
            })

            const miningCapacity = effectiveMiningCapacityForCorporation(
                gameSession.gameState,
                corporation.id
            )
            const wrappedMiningCapacity = wrapMiningCapacityForDisplay(miningCapacity)
            const miningRow = dividendRowForMiningCapacity(wrappedMiningCapacity)
            const subIndex =
                wrappedMiningCapacity > 0 ? (wrappedMiningCapacity - 1) % 3 : undefined
            const subCol = subIndex === undefined ? MINING_ZONE : MINING_SUBCOLS[subIndex]!
            raw.push({
                key: `${corporation.id}-mining`,
                label: `${name} - Mining Capacity ${miningCapacity}`,
                iconKey: corporation.id,
                icon,
                track: 'mining',
                cellKey: `mining-${miningRow}-${subIndex ?? 'zero'}`,
                cellLeft: subCol.left,
                cellWidth: subCol.width,
                row: miningRow,
                lap: lapCountForDisplay(miningCapacity)
            })
        }

        if (!onlyCorporationId) {
            const alienMiningCapacity =
                alienMiningCapacityOverride ??
                gameSession.gameState.alienCorporation.miningCapacity
            const wrappedAlienMiningCapacity = wrapMiningCapacityForDisplay(alienMiningCapacity)
            const alienRow = dividendRowForMiningCapacity(wrappedAlienMiningCapacity)
            const alienSubIndex =
                wrappedAlienMiningCapacity > 0 ? (wrappedAlienMiningCapacity - 1) % 3 : undefined
            const alienSubCol =
                alienSubIndex === undefined ? MINING_ZONE : MINING_SUBCOLS[alienSubIndex]!
            raw.push({
                key: 'alien-mining',
                label: `Alien Corporation - Mining Capacity ${alienMiningCapacity}`,
                iconKey: 'alien',
                icon: alienMarker,
                track: 'mining',
                cellKey: `mining-${alienRow}-${alienSubIndex ?? 'zero'}`,
                cellLeft: alienSubCol.left,
                cellWidth: alienSubCol.width,
                row: alienRow,
                lap: lapCountForDisplay(alienMiningCapacity)
            })
        }

        return raw
    })

    // Which Mining Capacity pile (if any) is currently splayed open - hovering any marker in a
    // stacked pile opens it and leaving closes it, matching MoneyStack.svelte's behavior.
    let splayedCellKey: string | undefined = $state()

    function isSplayablePile(marker: PlacedMarker) {
        return marker.track === 'mining' && marker.groupSize > 1
    }

    function onMarkerPointerEnter(marker: PlacedMarker) {
        if (!isSplayablePile(marker)) return
        splayedCellKey = marker.cellKey
    }

    // Splaying moves the markers out from under the cursor, so the marker just hovered fires a
    // leave the instant it slides away. Only restack when the pointer really left the pile, i.e.
    // it is not now over another marker of this same cell.
    function onMarkerPointerLeave(marker: PlacedMarker, e: PointerEvent) {
        if (!isSplayablePile(marker)) return
        const next = e.relatedTarget
        if (next instanceof HTMLElement && next.dataset['cellKey'] === marker.cellKey) return
        if (splayedCellKey === marker.cellKey) splayedCellKey = undefined
    }

    const markers = $derived(place(rawMarkers, splayedCellKey))

    // Standing "40+" flags for the bottom row (row 0, the printed chart's one full-width box) -
    // one physical token per Corporation/Alien Corporation that has wrapped the chart at least
    // once (lap > 0), regardless of where their own moving marker currently sits. Laid out as a
    // small evenly-spaced strip along the lower portion of that row so it doesn't collide with
    // whichever marker(s) are also centered in that same box.
    type FortyPlusBadge = {
        key: string
        label: string
        icon: string
        left: number
        top: number
    }

    const fortyPlusBadges = $derived.by(() => {
        const wrapped = rawMarkers.filter((m) => m.track === 'mining' && m.lap > 0)
        const n = wrapped.length
        if (n === 0) return []
        const top = rowTop(0) + ROW_HEIGHT * 0.6
        return wrapped.map((m, i) => ({
            key: `${m.key}-40plus`,
            label: `${m.label} - wrapped the chart ${m.lap} time${m.lap === 1 ? '' : 's'}`,
            icon: Corporation40PlusIcons[m.iconKey] ?? m.icon,
            left: MINING_ZONE.left + (MINING_ZONE.width * (i + 0.5)) / n,
            top
        }))
    })

    // Backroom Deal's own two candidate-destination ghost markers (BackroomDealPanel.svelte) -
    // only ever populated once the President has clicked the glowing Alien marker
    // (backroomDealTargetCapacities is empty/undefined until then), and always exactly the
    // Alien's own icon, positioned at each candidate Mining Capacity value rather than any
    // marker's real, current position.
    type BackroomDealTargetMarker = {
        key: string
        label: string
        miningCapacity: number
        left: number
        top: number
    }

    const backroomDealTargetMarkers = $derived.by((): BackroomDealTargetMarker[] => {
        if (!backroomDealTargetCapacities || backroomDealTargetCapacities.length === 0) return []
        return backroomDealTargetCapacities.map((capacity) => {
            const pos = miningCellPosition(capacity)
            return {
                key: `backroom-deal-target-${capacity}`,
                label: `Move the Alien Mining Capacity to ${capacity}`,
                miningCapacity: capacity,
                left: pos.left,
                top: pos.top
            }
        })
    })

    // Geometry for payoutHighlight (see its own prop comment) - the inset box around that
    // row/status cell's printed payout figure.
    const payoutHighlightBox = $derived.by(() => {
        if (!payoutHighlight) return undefined
        const col = PAYOUT_COLS[payoutHighlight.status]
        const cellTop = rowTop(payoutHighlight.row)
        const insetX = (col.width * PAYOUT_HIGHLIGHT_INSET_X_PCT) / 100
        const insetY = (ROW_HEIGHT * PAYOUT_HIGHLIGHT_INSET_Y_PCT) / 100
        return {
            left: col.left + insetX,
            width: col.width - insetX * 2,
            top: cellTop + insetY,
            height: ROW_HEIGHT - insetY * 2
        }
    })

    function onMarkerClick(marker: PlacedMarker) {
        if (alienMiningMarkerClickable && marker.key === 'alien-mining') {
            onAlienMiningMarkerClick?.()
            return
        }
        if (
            marker.track === 'cargo' &&
            deepSpaceSmugglingClickableCorporationIds?.includes(marker.iconKey as CorporationId)
        ) {
            onSelectDeepSpaceSmugglingTarget?.(marker.iconKey as CorporationId)
            return
        }
        if (
            marker.track === 'mining' &&
            deepSpacePiratesClickableCorporationIds?.includes(marker.iconKey as CorporationId)
        ) {
            onSelectDeepSpacePiratesTarget?.(marker.iconKey as CorporationId)
            return
        }
    }

    // Per the co-designer: frame the chart on whichever payout cell payoutHighlight is currently
    // pointing at, rather than leaving the President to scroll this tall, scrollable chart
    // (h-full overflow-y-auto above) to go find it themselves - runs on mount (the initial
    // reveal) and again every time payoutHighlight moves to a different cell (Deep Space
    // Smuggling picking a different target, End Operations' own live preview as Outposts are
    // built). scrollIntoView's nearest-scrollable-ancestor behavior naturally targets this
    // panel's own overflow-y-auto div without needing to compute scroll offsets by hand.
    let payoutHighlightEl: HTMLDivElement | undefined = $state()
    $effect(() => {
        if (payoutHighlight) {
            payoutHighlightEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    })
</script>

<div class="h-full overflow-y-auto p-4 text-[#e6e9f5]">
    <div class="relative mx-auto w-full max-w-md" style="aspect-ratio: {CHART_WIDTH} / {CHART_HEIGHT};">
        <img
            src={dividendChart}
            alt="Mining Capacity and Dividend Payout chart, as printed on the board"
            class="absolute inset-0 h-full w-full rounded-lg border border-[#3a4166]"
        />

        {#each markers as marker (marker.key)}
            {@const heightPct = MARKER_HEIGHT_PCT}
            {@const widthPct = heightPct * marker.aspect * (CHART_HEIGHT / CHART_WIDTH)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            {@const isDeepSpaceSmugglingTarget =
                marker.track === 'cargo' &&
                !!deepSpaceSmugglingClickableCorporationIds?.includes(marker.iconKey as CorporationId)}
            {@const isDeepSpacePiratesTarget =
                marker.track === 'mining' &&
                !!deepSpacePiratesClickableCorporationIds?.includes(marker.iconKey as CorporationId)}
            <img
                src={marker.icon}
                alt={marker.label}
                class="absolute {(alienMiningMarkerClickable && marker.key === 'alien-mining') ||
                isDeepSpaceSmugglingTarget ||
                isDeepSpacePiratesTarget
                    ? 'cursor-pointer'
                    : ''} {highlightAlienMiningMarker && marker.key === 'alien-mining'
                    ? 'hostile-takeover-alien-pulse'
                    : isDeepSpaceSmugglingTarget
                      ? 'deep-space-smuggling-target-pulse'
                      : isDeepSpacePiratesTarget
                        ? 'deep-space-pirates-target-pulse'
                        : 'drop-shadow-md'}"
                style="left: {marker.left}%; top: {marker.top}%; height: {heightPct}%; width: {widthPct}%; z-index: {marker.zIndex}; transform: translate(-50%, -50%); transition: left 150ms ease, top 150ms ease;"
                data-cell-key={marker.cellKey}
                onclick={() => onMarkerClick(marker)}
                onpointerenter={() => onMarkerPointerEnter(marker)}
                onpointerleave={(e) => onMarkerPointerLeave(marker, e)}
            />
        {/each}

        {#each fortyPlusBadges as badge (badge.key)}
            {@const heightPct = FORTY_PLUS_HEIGHT_PCT}
            {@const widthPct = heightPct * FORTY_PLUS_ASPECT * (CHART_HEIGHT / CHART_WIDTH)}
            <img
                src={badge.icon}
                alt={badge.label}
                title={badge.label}
                class="absolute drop-shadow-md"
                style="left: {badge.left}%; top: {badge.top}%; height: {heightPct}%; width: {widthPct}%; z-index: 200; transform: translate(-50%, -50%);"
            />
        {/each}

        {#each backroomDealTargetMarkers as target (target.key)}
            {@const heightPct = MARKER_HEIGHT_PCT}
            {@const widthPct = heightPct * (MarkerAspect.alien ?? 1) * (CHART_HEIGHT / CHART_WIDTH)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <img
                src={alienMarker}
                alt={target.label}
                title={target.label}
                class="absolute cursor-pointer backroom-deal-target-pulse"
                style="left: {target.left}%; top: {target.top}%; height: {heightPct}%; width: {widthPct}%; z-index: 300; transform: translate(-50%, -50%); opacity: 0.6;"
                onclick={() => onSelectBackroomDealTarget?.(target.miningCapacity)}
            />
        {/each}

        {#if payoutHighlightBox}
            <!-- Deep Space Smuggling's payout callout (see payoutHighlight's own comment) - a
                 pulsing box inset around the printed "$X" payout figure itself, not the whole
                 cell/row, so it reads as "this is the number" rather than "this whole row". -->
            <div
                bind:this={payoutHighlightEl}
                class="pointer-events-none absolute rounded-md payout-highlight-pulse"
                style="left: {payoutHighlightBox.left}%; top: {payoutHighlightBox.top}%; width: {payoutHighlightBox.width}%; height: {payoutHighlightBox.height}%; z-index: 250;"
            ></div>
        {/if}
    </div>
</div>

<style>
    /* Draws the eye to the Alien Corporation's own Mining Capacity marker during the Hostile
       Takeover reveal - every signed Corporation's fate hinges on this one number. Same
       drop-shadow-hugs-the-silhouette technique as ShipyardPanel's orderable-Ship glow. */
    .hostile-takeover-alien-pulse {
        animation: hostile-takeover-alien-pulse 1.8s ease-in-out infinite;
    }
    @keyframes hostile-takeover-alien-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(61, 220, 132, 0.95)) drop-shadow(0 0 5px rgba(61, 220, 132, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 4px rgba(61, 220, 132, 1)) drop-shadow(0 0 11px rgba(61, 220, 132, 0.9));
        }
    }

    /* Backroom Deal's own two candidate-destination ghost markers (BackroomDealPanel.svelte) -
       a cooler, gold/blue pulse so the two clickable "could move here" positions read as clearly
       different from the warm green "this is the real, current marker" glow above. */
    .backroom-deal-target-pulse {
        animation: backroom-deal-target-pulse 1.4s ease-in-out infinite;
    }
    @keyframes backroom-deal-target-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(240, 200, 80, 0.95)) drop-shadow(0 0 5px rgba(240, 200, 80, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 4px rgba(240, 200, 80, 1)) drop-shadow(0 0 11px rgba(240, 200, 80, 0.9));
        }
    }

    /* Deep Space Smuggling's own clickable-target markers (DeepSpaceSmugglingPanel.svelte) -
       these are REAL, live Cargo markers (not ghost candidates like Backroom Deal's), so a
       distinct cool blue pulse (matching this app's own accent color, #2f6fed) keeps it visually
       different from Backroom Deal's gold "candidate destination" convention and Hostile
       Takeover's warm green "this is what matters" convention above. */
    .deep-space-smuggling-target-pulse {
        animation: deep-space-smuggling-target-pulse 1.4s ease-in-out infinite;
    }
    @keyframes deep-space-smuggling-target-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(47, 111, 237, 0.95)) drop-shadow(0 0 5px rgba(47, 111, 237, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 4px rgba(47, 111, 237, 1)) drop-shadow(0 0 11px rgba(47, 111, 237, 0.9));
        }
    }

    /* Deep Space Pirates' own clickable-target markers (DeepSpacePiratesPanel.svelte) - the
       Mining Capacity counterpart of Deep Space Smuggling's Cargo pulse just above. A distinct
       burnt-orange pulse keeps it visually different from Smuggling's blue, Backroom Deal's gold
       and Hostile Takeover's green conventions elsewhere on this same chart. */
    .deep-space-pirates-target-pulse {
        animation: deep-space-pirates-target-pulse 1.4s ease-in-out infinite;
    }
    @keyframes deep-space-pirates-target-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(230, 90, 40, 0.95)) drop-shadow(0 0 5px rgba(230, 90, 40, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 4px rgba(230, 90, 40, 1)) drop-shadow(0 0 11px rgba(230, 90, 40, 0.9));
        }
    }

    /* Deep Space Smuggling's payout callout (payoutHighlight prop) - a pulsing box around the
       printed payout figure itself, in the chart's own dark payout table, so a subtle
       green-tinted fill/border reads clearly against that dark background (unlike the marker
       pulses above, which glow around a real token image sitting on a lighter part of the
       chart). Same warm green as this app's other "here's the number that matters" pulses. */
    .payout-highlight-pulse {
        background: rgba(61, 220, 132, 0.12);
        border: 2px solid rgba(61, 220, 132, 0.9);
        animation: payout-highlight-pulse 1.4s ease-in-out infinite;
    }
    @keyframes payout-highlight-pulse {
        0%,
        100% {
            box-shadow: 0 0 6px 1px rgba(61, 220, 132, 0.5);
        }
        50% {
            box-shadow: 0 0 14px 4px rgba(61, 220, 132, 0.95);
        }
    }
</style>
