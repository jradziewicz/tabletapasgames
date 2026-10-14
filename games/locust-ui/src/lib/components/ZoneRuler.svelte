<script lang="ts">
    import {
        RegionLabels,
        breedingZone,
        killingZone,
        levelBoostRegion,
        majorityRegion,
        scoringZone,
        swarmingZone
    } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BoardWidth, RegionBounds } from '$lib/utils/boardLayout.js'

    const session = getGameSession()
    const active = $derived(session.gameState.activeRegion)

    type Zone = { label: string; fill: string; text: string }

    const zonesFor = (region: number): Zone[] => {
        const zones: Zone[] = []
        if (region === active) zones.push({ label: 'Active', fill: '#ffffff', text: '#2b2418' })
        if (killingZone(active).includes(region)) zones.push({ label: 'Killing', fill: '#3a3a3a', text: '#ffffff' })
        if (swarmingZone(active).includes(region)) zones.push({ label: 'Swarming', fill: '#7a1d6b', text: '#ffffff' })
        if (scoringZone(active).includes(region)) zones.push({ label: 'Scoring', fill: '#2f6b2f', text: '#ffffff' })
        if (majorityRegion(active) === region) zones.push({ label: 'Majority', fill: '#d98a10', text: '#1a1a1a' })
        if (levelBoostRegion(active) === region) zones.push({ label: 'Level +1', fill: '#1c4fb8', text: '#ffffff' })
        if (breedingZone(active).includes(region)) zones.push({ label: 'Breeding', fill: '#c9b98a', text: '#1a1a1a' })
        return zones
    }
</script>

<svg viewBox="0 0 {BoardWidth} 104" class="block w-full" aria-label="Zone Ruler">
    <rect x="0" y="0" width={BoardWidth} height="104" fill="#2b2418" />
    {#each RegionBounds as [left, right], region}
        <g>
            <text x={left + 12} y="62" font-size="34" font-weight="700" fill={region === active ? '#ffffff' : '#a99f8c'}
                >{RegionLabels[region]}</text
            >
            {#each zonesFor(region) as zone, index}
                {@const column = index % 2}
                {@const row = Math.floor(index / 2)}
                <g transform="translate({left + 66 + column * 118} {8 + row * 47})">
                    <rect width="112" height="41" rx="8" fill={zone.fill} />
                    <text x="56" y="21" text-anchor="middle" dominant-baseline="central" font-size="21" font-weight="700" fill={zone.text}
                        >{zone.label}</text
                    >
                </g>
            {/each}
            {#if region > 0}
                <line x1={left} y1="0" x2={left} y2="104" stroke="#5a4c38" stroke-width="2" />
            {/if}
        </g>
    {/each}
</svg>
