<script lang="ts">
    import rulerArt from '$lib/images/zone-ruler.svg'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BoardWidth, RegionBounds } from '$lib/utils/boardLayout.js'

    const session = getGameSession()
    const active = $derived(session.gameState.activeRegion)

    // The printed Zone Ruler (v31, 1606.4 x 190 pt) spans five regions: Killing (A-2) through
    // Level +1 (A+2). It is placed so its middle region sits over the Active Region and slides
    // one region right after each scoring.
    const RegionWidth = 310
    const RulerRegions = 5
    const RulerWidth = RegionWidth * RulerRegions
    const RulerHeight = (RulerWidth * 190) / 1606.4
    const rulerX = $derived((RegionBounds[active]?.[0] ?? 0) - 2 * RegionWidth)
</script>

<svg viewBox="0 0 {BoardWidth} {RulerHeight}" class="block w-full" aria-label="Zone Ruler">
    <rect x="0" y="0" width={BoardWidth} height={RulerHeight} fill="#2b2418" />
    <g class="ruler-slide" style="transform: translateX({rulerX}px)">
        <rect
            x={-3 * RulerWidth}
            y="0"
            width={3 * RulerWidth}
            height={RulerHeight}
            fill="#f1ec8f"
        />
        <rect x={RulerWidth} y="0" width={3 * RulerWidth} height={RulerHeight} fill="#94cde5" />
        <image
            href={rulerArt}
            x="0"
            y="0"
            width={RulerWidth}
            height={RulerHeight}
            preserveAspectRatio="none"
        />
    </g>
</svg>

<style>
    .ruler-slide {
        transition: transform 900ms cubic-bezier(0.45, 0, 0.2, 1);
    }
</style>
