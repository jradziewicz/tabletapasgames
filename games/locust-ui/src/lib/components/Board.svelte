<script lang="ts">
    import { ActionSpaces, Habitats } from '@tabletop/locust'
    import boardImg from '$lib/images/board.jpg'
    import { BoardHeight, BoardWidth } from '$lib/utils/boardLayout.js'
    import HabitatView from './HabitatView.svelte'
    import SpaceView from './SpaceView.svelte'
    import DraftOverlay from './DraftOverlay.svelte'
    import ZoneRuler from './ZoneRuler.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()
    const DisplayWidth = 1400
</script>

<div class="select-none" style:width="{DisplayWidth}px">
    <ZoneRuler />
    <div class="relative" style:width="{DisplayWidth}px" style:height="{(DisplayWidth * BoardHeight) / BoardWidth}px">
        <img src={boardImg} alt="Locust board" class="absolute inset-0 h-full w-full" draggable="false" />
        <svg viewBox="0 0 {BoardWidth} {BoardHeight}" class="absolute inset-0 h-full w-full">
            {#each ActionSpaces as space (space.id)}
                <SpaceView spaceId={space.id} />
            {/each}
            {#if session.gameState.hasWhiteCubeIn(0)}
                <rect x="104" y="201" width="28" height="28" rx="4" fill="#f7f4ea" stroke="#1a1a1a" stroke-width="2.5">
                    <title>White 4-player cube: +1 rain in Region I</title>
                </rect>
            {/if}
            {#each Habitats as habitat (habitat.id)}
                <HabitatView habitatId={habitat.id} />
            {/each}
            <DraftOverlay />
        </svg>
    </div>
</div>
