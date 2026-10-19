<script lang="ts">
    import { getHabitat } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HabitatRadius, habitatCenter, quadrantPoint } from '$lib/utils/boardLayout.js'
    import { trimmedArc } from '$lib/utils/arc.js'
    import GhostHop from './GhostHop.svelte'

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

    const actingFill = $derived(
        session.actingColor ? session.colors.getUiColor(session.actingColor) : '#ffffff'
    )

    function actingQuadrant(habitatId: string): number {
        const occupants = session.gameState.board.habitat(habitatId).occupants
        const index = occupants.findIndex((occupant) => occupant.color === session.actingColor)
        return index === -1 ? occupants.length : index
    }

    function grasshopperSpot(habitatId: string) {
        return quadrantPoint(centerOf(habitatId), actingQuadrant(habitatId))
    }

    // Ghosts stack slightly so several jumps into one habitat read as several grasshoppers.
    function landingSpot(habitatId: string, index: number) {
        return quadrantPoint(centerOf(habitatId), actingQuadrant(habitatId), {
            x: index * 12,
            y: -index * 10
        })
    }

    const previewHop = $derived(
        session.hopOrigin &&
            session.hoverHabitatId &&
            session.selectableHabitatIds.includes(session.hoverHabitatId)
            ? { from: session.hopOrigin, to: session.hoverHabitatId }
            : undefined
    )

    const hopArcs = $derived(
        [
            ...session.hops.map((hop) => ({ hop, preview: false })),
            ...(previewHop ? [{ hop: previewHop, preview: true }] : [])
        ].map(({ hop, preview }) => ({
            preview,
            path: trimmedArc(grasshopperSpot(hop.from), centerOf(hop.to), 0.12, 0.22)
        }))
    )

    const ghosts = $derived.by(() => {
        const landed = new Map<string, number>()
        const staged = [...session.hops, ...(previewHop ? [previewHop] : [])]
        return staged.map((hop, index) => {
            const count = landed.get(hop.to) ?? 0
            landed.set(hop.to, count + 1)
            return {
                key: `${index}-${hop.from}-${hop.to}`,
                from: grasshopperSpot(hop.from),
                to: landingSpot(hop.to, count),
                fill: actingFill,
                delay: 0
            }
        })
    })

    const landingBadges = $derived(
        countBy(session.hops.map((hop) => hop.to)).map(([habitatId, count]) => ({
            habitatId,
            count,
            point: { x: centerOf(habitatId).x, y: centerOf(habitatId).y - HabitatRadius - 24 }
        }))
    )

    const leavingBadges = $derived(
        countBy(session.hops.map((hop) => hop.from)).map(([habitatId, count]) => {
            const spot = grasshopperSpot(habitatId)
            return { habitatId, count, point: { x: spot.x, y: spot.y + 44 } }
        })
    )
    const relocationCounts = $derived(countBy(session.relocationDestinations))
</script>

<defs>
    <marker
        id="hop-arrow"
        viewBox="0 0 12 12"
        refX="6"
        refY="6"
        markerWidth="4"
        markerHeight="4"
        orient="auto"
    >
        <path
            d="M1,1 L11,6 L1,11 Q4,6 1,1 z"
            fill="#ffffff"
            stroke="#1a140c"
            stroke-width="1.2"
            stroke-linejoin="round"
        />
    </marker>
</defs>

{#each hopArcs as arc, index (index)}
    <g pointer-events="none" class="hop-arc" class:hop-arc-preview={arc.preview}>
        <path
            d={arc.path}
            fill="none"
            stroke="#1a140c"
            stroke-width="15"
            stroke-linecap="round"
            opacity="0.55"
        />
        <path
            d={arc.path}
            fill="none"
            stroke="#ffffff"
            stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray={arc.preview ? '14 12' : undefined}
            marker-end="url(#hop-arrow)"
            class:hop-dash={arc.preview}
        />
    </g>
{/each}

{#each ghosts as ghost (ghost.key)}
    <GhostHop from={ghost.from} to={ghost.to} fill={ghost.fill} delay={ghost.delay} />
{/each}

{#each landingBadges as badge (badge.habitatId)}
    <g transform="translate({badge.point.x} {badge.point.y})" pointer-events="none">
        <rect
            x="-30"
            y="-17"
            width="60"
            height="34"
            rx="17"
            fill="#3ddc84"
            stroke="#06371b"
            stroke-width="3"
        />
        <text
            text-anchor="middle"
            dominant-baseline="central"
            font-size="20"
            font-weight="800"
            fill="#06371b">+{badge.count}</text
        >
    </g>
{/each}

{#each leavingBadges as badge (badge.habitatId)}
    <g transform="translate({badge.point.x} {badge.point.y})" pointer-events="none">
        <rect
            x="-30"
            y="-17"
            width="60"
            height="34"
            rx="17"
            fill="#2b2418"
            stroke="#ffd66e"
            stroke-width="3"
            opacity="0.92"
        />
        <text
            text-anchor="middle"
            dominant-baseline="central"
            font-size="20"
            font-weight="800"
            fill="#ffd66e">−{badge.count}</text
        >
    </g>
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
    {@const label = attack.victims.map((victim) => `−${victim.count} ${victim.color}`).join('  ')}
    <g pointer-events="none">
        <circle
            cx={center.x}
            cy={center.y}
            r={HabitatRadius + 10}
            fill="none"
            stroke="#e0574a"
            stroke-width="6"
            stroke-dasharray="16 10"
            opacity="0.9"
        />
        <g transform="translate({center.x} {center.y - HabitatRadius - 26})">
            <rect
                x={-(label.length * 7 + 26)}
                y="-20"
                width={label.length * 14 + 52}
                height="40"
                rx="10"
                fill="#7a1f16"
                stroke="#1a140c"
                stroke-width="2"
            />
            <text
                text-anchor="middle"
                dominant-baseline="central"
                font-size="22"
                font-weight="700"
                fill="#fff">{label}</text
            >
        </g>
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

<style>
    .hop-arc {
        filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.85))
            drop-shadow(0 0 10px rgba(255, 214, 110, 0.55));
    }
    .hop-arc-preview {
        opacity: 0.8;
    }
    .hop-dash {
        animation: hop-dash-flow 0.9s linear infinite;
    }
    @keyframes hop-dash-flow {
        to {
            stroke-dashoffset: -26;
        }
    }
</style>
