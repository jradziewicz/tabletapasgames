<script lang="ts">
    import { ActionSpaces, Habitats } from '@tabletop/locust'
    import boardImg from '$lib/images/board.jpg'
    import { BoardHeight, BoardWidth, RegionBounds } from '$lib/utils/boardLayout.js'
    import HabitatView from './HabitatView.svelte'
    import SpaceView from './SpaceView.svelte'
    import DraftOverlay from './DraftOverlay.svelte'
    import FallingNymphs from './FallingNymphs.svelte'
    import FlyingGrasshoppers from './FlyingGrasshoppers.svelte'
    import ZoneRuler from './ZoneRuler.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()
    const DisplayWidth = 1400
</script>

<div class="select-none" style:width="{DisplayWidth}px">
    <ZoneRuler />
    <div
        class="relative"
        style:width="{DisplayWidth}px"
        style:height="{(DisplayWidth * BoardHeight) / BoardWidth}px"
    >
        <img
            src={boardImg}
            alt="Locust board"
            class="absolute inset-0 h-full w-full"
            draggable="false"
        />
        <svg viewBox="0 0 {BoardWidth} {BoardHeight}" class="absolute inset-0 h-full w-full">
            <defs>
                <radialGradient id="disc-shine" cx="35%" cy="30%" r="75%">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55" />
                    <stop offset="45%" stop-color="#ffffff" stop-opacity="0.08" />
                    <stop offset="100%" stop-color="#000000" stop-opacity="0.25" />
                </radialGradient>
            </defs>
            {#each ActionSpaces as space (space.id)}
                <SpaceView spaceId={space.id} />
            {/each}
            {#each RegionBounds as [left, right], region (region)}
                {@const active = session.gameState.activeRegion}
                <rect
                    x={left}
                    y="0"
                    width={right - left}
                    height={BoardHeight}
                    pointer-events="none"
                    class="zone-wash"
                    fill={region < active - 2
                        ? '#2b2418'
                        : region === active - 2
                          ? '#b3261e'
                          : '#ffffff'}
                    fill-opacity={region < active - 2
                        ? 0.45
                        : region === active - 2
                          ? 0.16
                          : region === active
                            ? 0.06
                            : 0}
                />
            {/each}
            {#if session.gameState.hasWhiteCubeIn(0)}
                <rect
                    x="104"
                    y="201"
                    width="28"
                    height="28"
                    rx="4"
                    fill="#f7f4ea"
                    stroke="#1a1a1a"
                    stroke-width="2.5"
                >
                    <title>White 4-player cube: +1 rain in Region I</title>
                </rect>
            {/if}
            {#each Habitats as habitat (habitat.id)}
                <HabitatView habitatId={habitat.id} />
            {/each}
            <FallingNymphs />
            <FlyingGrasshoppers />
            <DraftOverlay />
        </svg>
    </div>
</div>

<style>
    .zone-wash {
        transition:
            fill-opacity 900ms ease,
            fill 900ms ease;
    }
</style>
