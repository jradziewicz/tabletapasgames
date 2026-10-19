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
    import TargetRing from './TargetRing.svelte'

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
    const canJumpFrom = $derived(session.jumpOriginIds.includes(habitatId))
    const canBreedHere = $derived(session.breedTargetIds.includes(habitatId))

    const actingQuadrant = $derived.by(() => {
        const index = occupants.findIndex((occupant) => occupant.color === session.actingColor)
        return index === -1 ? occupants.length : index
    })
    const actingFill = $derived(
        session.actingColor ? session.colors.getUiColor(session.actingColor) : '#3ddc84'
    )

    function colorOf(color: Color) {
        return session.colors.getUiColor(color)
    }
</script>

<g>
    {#if isSwarming}
        <TargetRing cx={center.x} cy={center.y} r={HabitatRadius + 16} tone="swarm" />
    {/if}
    {#if selectable}
        <TargetRing
            cx={center.x}
            cy={center.y}
            r={HabitatRadius + 14}
            tone={session.performKind === 'Swarm' ? 'swarm' : 'go'}
        />
    {/if}

    {#each occupants as occupant, quadrant (occupant.color)}
        {@const fill = colorOf(occupant.color)}
        {@const both = occupant.grasshopper > 0 && occupant.locust > 0}
        {@const isActing = occupant.color === session.actingColor}
        {#if occupant.grasshopper > 0}
            {@const point = quadrantPoint(center, quadrant, both ? { x: -10, y: -8 } : undefined)}
            <g style:cursor={isActing && (canJumpFrom || isOrigin) ? 'pointer' : undefined}>
                {#if isActing && (canJumpFrom || isOrigin)}
                    <TargetRing cx={point.x} cy={point.y} r={31} tone={isOrigin ? 'gold' : 'go'} />
                {/if}
                <Disc center={point} {fill} count={occupant.grasshopper} />
                {#if isActing && (canJumpFrom || isOrigin)}
                    <circle
                        cx={point.x}
                        cy={point.y}
                        r="30"
                        fill="transparent"
                        role="button"
                        tabindex="0"
                        aria-label="Grasshopper in {habitatId}"
                        onclick={() => session.selectGrasshopper(habitatId)}
                        onkeydown={(event) =>
                            event.key === 'Enter' && session.selectGrasshopper(habitatId)}
                    />
                {/if}
            </g>
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

    {#if canBreedHere}
        {@const point = nymphPoint(center, actingQuadrant)}
        <g style:cursor="pointer">
            <TargetRing cx={point.x} cy={point.y} r={25} />
            <circle
                cx={point.x}
                cy={point.y}
                r="10"
                fill={actingFill}
                stroke="#1a1a1a"
                stroke-width="2"
                opacity="0.9"
            />
            <circle
                cx={point.x}
                cy={point.y}
                r="30"
                fill="transparent"
                role="button"
                tabindex="0"
                aria-label="Nymph circle in {habitatId}"
                onclick={() => session.selectNymphCircle(habitatId)}
                onkeydown={(event) => event.key === 'Enter' && session.selectNymphCircle(habitatId)}
            />
        </g>
    {/if}

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

    {#if selectable}
        <circle
            cx={center.x}
            cy={center.y}
            r={HabitatRadius + 18}
            fill="transparent"
            role="button"
            tabindex="0"
            aria-label="Habitat {habitatId}"
            class="cursor-pointer"
            onpointerenter={() => (session.hoverHabitatId = habitatId)}
            onpointerleave={() => {
                if (session.hoverHabitatId === habitatId) session.hoverHabitatId = undefined
            }}
            onclick={() => session.selectHabitat(habitatId)}
            onkeydown={(event) => event.key === 'Enter' && session.selectHabitat(habitatId)}
        >
            <title>{habitatId} · {habitat.color} · {discs} discs, room for {capacity}</title>
        </circle>
    {/if}
</g>
