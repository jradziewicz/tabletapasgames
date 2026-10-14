<script lang="ts">
    import { getHabitat } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HabitatRadius, habitatCenter } from '$lib/utils/boardLayout.js'

    const session = getGameSession()

    const centerOf = (habitatId: string) => habitatCenter(getHabitat(habitatId))

    function countBy(habitatIds: string[]): [string, number][] {
        const counts = new Map<string, number>()
        for (const habitatId of habitatIds) {
            counts.set(habitatId, (counts.get(habitatId) ?? 0) + 1)
        }
        return [...counts]
    }

    const breedCounts = $derived(countBy(session.breedHabitatIds))
    const relocationCounts = $derived(countBy(session.relocationDestinations))
</script>

<defs>
    <marker
        id="hop-arrow"
        viewBox="0 0 10 10"
        refX="7"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto"
    >
        <path d="M0,0 L10,5 L0,10 z" fill="#ffffff" />
    </marker>
</defs>

{#each session.hops as hop, index (index)}
    {@const from = centerOf(hop.from)}
    {@const to = centerOf(hop.to)}
    <line
        x1={from.x}
        y1={from.y}
        x2={from.x + (to.x - from.x) * 0.8}
        y2={from.y + (to.y - from.y) * 0.8}
        stroke="#ffffff"
        stroke-width="12"
        stroke-linecap="round"
        marker-end="url(#hop-arrow)"
        opacity="0.9"
    />
{/each}

{#each breedCounts as [habitatId, count] (habitatId)}
    {@const center = centerOf(habitatId)}
    <g transform="translate({center.x} {center.y - HabitatRadius - 26})">
        <rect x="-42" y="-20" width="84" height="40" rx="10" fill="#2f6b2f" />
        <text
            text-anchor="middle"
            dominant-baseline="central"
            font-size="24"
            font-weight="700"
            fill="#fff">+{count} nymph</text
        >
    </g>
{/each}

{#each relocationCounts as [habitatId, count] (habitatId)}
    {@const center = centerOf(habitatId)}
    <g transform="translate({center.x} {center.y - HabitatRadius - 26})">
        <rect x="-46" y="-20" width="92" height="40" rx="10" fill="#7a1d6b" />
        <text
            text-anchor="middle"
            dominant-baseline="central"
            font-size="24"
            font-weight="700"
            fill="#fff">+{count} locust</text
        >
    </g>
{/each}

{#each session.attacks as attack (attack.habitatId)}
    {@const center = centerOf(attack.habitatId)}
    <g transform="translate({center.x} {center.y})" opacity="0.85" pointer-events="none">
        <line
            x1="-60"
            y1="-60"
            x2="60"
            y2="60"
            stroke="#b3261e"
            stroke-width="14"
            stroke-linecap="round"
        />
        <line
            x1="60"
            y1="-60"
            x2="-60"
            y2="60"
            stroke="#b3261e"
            stroke-width="14"
            stroke-linecap="round"
        />
    </g>
{/each}

{#each session.swarmHabitatIds as habitatId (habitatId)}
    {@const center = centerOf(habitatId)}
    <circle
        cx={center.x}
        cy={center.y}
        r={HabitatRadius + 6}
        fill="#7a1d6b"
        fill-opacity="0.35"
        stroke="#7a1d6b"
        stroke-width="8"
        pointer-events="none"
    />
{/each}
