<script lang="ts">
    import { getHabitat, occupantDiscs } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Color } from '@tabletop/common'
    import {
        HabitatRadius,
        habitatCenter,
        nymphPoint,
        quadrantPoint
    } from '$lib/utils/boardLayout.js'
    import Disc from './Disc.svelte'

    let { habitatId }: { habitatId: string } = $props()

    const session = getGameSession()
    const habitat = $derived(getHabitat(habitatId))
    const center = $derived(habitatCenter(habitat))
    const occupants = $derived(session.gameState.board.habitat(habitatId).occupants)
    const discs = $derived(occupants.reduce((sum, occupant) => sum + occupantDiscs(occupant), 0))
    const capacity = $derived(session.gameState.habitatCapacity(habitatId))
    const crowded = $derived(discs > capacity)
    const selectable = $derived(session.selectableHabitatIds.includes(habitatId))
    const isOrigin = $derived(session.hopOrigin === habitatId)
    const isSwarming = $derived(session.gameState.swarm?.habitatId === habitatId)

    function colorOf(color: Color) {
        return session.colors.getUiColor(color)
    }
</script>

<g>
    {#if selectable || isOrigin || isSwarming}
        <circle
            cx={center.x}
            cy={center.y}
            r={HabitatRadius + 18}
            fill="none"
            stroke={isOrigin ? '#ffffff' : isSwarming ? '#7a1d6b' : '#7165ad'}
            stroke-width="10"
            stroke-dasharray={selectable && !isOrigin ? '18 10' : undefined}
            class={selectable ? 'animate-pulse' : ''}
        />
    {/if}

    {#each occupants as occupant, quadrant (occupant.color)}
        {@const fill = colorOf(occupant.color)}
        {@const both = occupant.grasshopper > 0 && occupant.locust > 0}
        {#if occupant.grasshopper > 0}
            <Disc
                center={quadrantPoint(center, quadrant, both ? { x: -10, y: -8 } : undefined)}
                {fill}
                count={occupant.grasshopper}
            />
        {/if}
        {#if occupant.locust > 0}
            <Disc
                center={quadrantPoint(center, quadrant, both ? { x: 10, y: 8 } : undefined)}
                {fill}
                count={occupant.locust}
                locust
            />
        {/if}
        {#if occupant.nymph > 0}
            <Disc
                center={nymphPoint(center, quadrant)}
                {fill}
                count={occupant.nymph}
                nymph
                radius={20}
            />
        {/if}
    {/each}

    <g transform="translate({center.x} {center.y + HabitatRadius + 30})">
        <rect
            x="-34"
            y="-15"
            width="68"
            height="30"
            rx="8"
            fill={crowded ? '#b3261e' : '#2b2418'}
            opacity="0.82"
        />
        <text
            text-anchor="middle"
            dominant-baseline="central"
            font-size="20"
            font-weight="700"
            fill="#ffffff">{discs}/{capacity}</text
        >
    </g>

    <circle
        cx={center.x}
        cy={center.y}
        r={HabitatRadius + 18}
        fill="transparent"
        role="button"
        tabindex={selectable ? 0 : -1}
        aria-label="Habitat {habitatId}"
        class={selectable || isOrigin ? 'cursor-pointer' : 'pointer-events-none'}
        onclick={() => session.selectHabitat(habitatId)}
        onkeydown={(event) => event.key === 'Enter' && session.selectHabitat(habitatId)}
    >
        <title>{habitatId} · {habitat.color} · {discs} discs, room for {capacity}</title>
    </circle>
</g>
