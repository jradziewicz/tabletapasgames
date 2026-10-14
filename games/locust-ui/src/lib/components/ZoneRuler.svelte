<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BoardWidth, RegionBounds } from '$lib/utils/boardLayout.js'

    const session = getGameSession()
    const active = $derived(session.gameState.activeRegion)

    // Laid out like the printed Zone Ruler (v31): every zone is drawn relative to the Active Region's
    // left edge, and the whole ruler slides one region right after each scoring.
    const RegionWidth = 310
    const Height = 216
    const originX = $derived(RegionBounds[active]?.[0] ?? 0)

    const W = RegionWidth
    const swarmLabelX = $derived((Math.max(-W, -originX) + W) / 2)
</script>

<svg viewBox="0 0 {BoardWidth} {Height}" class="block w-full" aria-label="Zone Ruler">
    <defs>
        <linearGradient id="ruler-sky" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="#f6eeb4" />
            <stop offset="55%" stop-color="#e3f0d4" />
            <stop offset="100%" stop-color="#9fd3ec" />
        </linearGradient>
        <marker id="ruler-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#3b3222" />
        </marker>
        <clipPath id="ruler-clip"><rect x="0" y="0" width={BoardWidth} height={Height} rx="14" /></clipPath>
    </defs>

    <g clip-path="url(#ruler-clip)">
        <rect x="0" y="0" width={BoardWidth} height={Height} fill="url(#ruler-sky)" />
        <text x="22" y="40" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="44" font-weight="700" fill="#4a3a22" opacity="0.85"
            >Locust</text
        >

        <g class="ruler-slide" style="transform: translateX({originX}px)">
            <!-- KILLING ZONE: bare gradient over A-2 -->
            <g transform="translate({-2 * W} 0)">
                <text x={W / 2} y="62" text-anchor="middle" font-size="28" font-weight="800" fill="#7a1f16" letter-spacing="2"
                    >KILLING ZONE</text
                >
                <line x1={W / 2} y1="90" x2={W / 2} y2="196" stroke="#7a1f16" stroke-width="5" marker-end="url(#ruler-arrow)" />
            </g>

            <!-- SCORING ZONE: large pale khaki band A-1 .. A+2 -->
            <rect x={-W + 8} y="10" width={4 * W - 16} height={Height - 20} rx="22" fill="#d8cf9e" stroke="#9c8f5a" stroke-width="3" />
            <text x={3 * W - 24} y="54" text-anchor="end" font-size="26" font-weight="800" fill="#5d5330" letter-spacing="2"
                >SCORING ZONE</text
            >

            <!-- SWARMING ZONE: amber tab A-1 .. A -->
            <rect x={-W + 20} y="24" width={2 * W - 40} height="50" rx="14" fill="#e3a43a" stroke="#a86b14" stroke-width="3" />
            <text x={swarmLabelX} y="56" text-anchor="middle" font-size="26" font-weight="800" fill="#3b2508" letter-spacing="2"
                >SWARMING ZONE</text
            >

            <!-- ACTIVE REGION: darker olive tab over A -->
            <rect x="18" y="86" width={W - 36} height="112" rx="14" fill="#8a8a4a" stroke="#5a5a2a" stroke-width="3" />
            <text x={W / 2} y="128" text-anchor="middle" font-size="30" font-weight="900" fill="#fffbe6" letter-spacing="2"
                >ACTIVE REGION</text
            >
            <text x={W / 2} y="166" text-anchor="middle" font-size="17" font-weight="700" fill="#f3eccb" letter-spacing="1"
                >INITIATE SCORING WHEN EMPTY</text
            >

            <!-- HABITAT MAJORITIES over A+1 -->
            <g transform="translate({W} 0)">
                <rect x="18" y="86" width={W - 36} height="112" rx="14" fill="#efe7c0" stroke="#9c8f5a" stroke-width="3" />
                <text x={W / 2} y="116" text-anchor="middle" font-size="20" font-weight="800" fill="#5d5330" letter-spacing="1"
                    >HABITAT MAJORITIES</text
                >
                <text x={W / 2} y="138" text-anchor="middle" font-size="16" font-weight="700" fill="#7d7346">DURING SCORING</text>
                {#each ['#58c3d4', '#f0907a', '#f2cf6b'] as color, index (color)}
                    <circle cx={W / 2 - 46 + index * 46} cy="170" r="18" fill={color} fill-opacity="0.35" stroke={color} stroke-width="4" stroke-dasharray="6 4" />
                {/each}
            </g>

            <!-- LEVEL +1 over A+2 -->
            <g transform="translate({2 * W} 0)">
                <text x={W / 2} y="124" text-anchor="middle" font-size="36" font-weight="900" fill="#1c4fb8">Level: +1</text>
                {#each [-60, 0, 60] as dx (dx)}
                    <line x1={W / 2 + dx} y1="140" x2={W / 2 + dx} y2="196" stroke="#1c4fb8" stroke-width="4" marker-end="url(#ruler-arrow)" />
                {/each}
            </g>

            <!-- BREEDING ZONE: dashed line at A's left edge, arrow to the right -->
            <line x1="4" y1="6" x2="4" y2={Height - 6} stroke="#2f6b2f" stroke-width="4" stroke-dasharray="10 7" />
            <g transform="translate({4 * W} 0)">
                <text x="16" y="62" font-size="26" font-weight="800" fill="#2f6b2f" letter-spacing="2">BREEDING ZONE</text>
                <line x1="16" y1="80" x2={W - 30} y2="80" stroke="#2f6b2f" stroke-width="5" marker-end="url(#ruler-arrow)" />
                <text x="16" y="138" font-size="17" font-weight="800" fill="#3b3222" letter-spacing="1">AFTER SCORING, MOVE</text>
                <text x="16" y="162" font-size="17" font-weight="800" fill="#3b3222" letter-spacing="1">ONE STEP TO THE RIGHT</text>
                <line x1="16" y1="186" x2={W - 30} y2="186" stroke="#3b3222" stroke-width="4" marker-end="url(#ruler-arrow)" />
            </g>
        </g>
    </g>
</svg>

<style>
    .ruler-slide {
        transition: transform 900ms cubic-bezier(0.45, 0, 0.2, 1);
    }
</style>
