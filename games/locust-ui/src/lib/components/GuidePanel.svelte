<script lang="ts">
    import {
        ActionKind,
        RegionLabels,
        breedingZone,
        killingZone,
        levelBoostRegion,
        majorityRegion,
        scoringZone,
        swarmingZone
    } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ActionBlurbs, ActionNames } from '$lib/utils/describe.js'
    import ActionBadge from './ActionBadge.svelte'

    const session = getGameSession()
    const active = $derived(session.gameState.activeRegion)
    const regions = (list: number[]) =>
        list.length ? list.map((region) => RegionLabels[region]).join(', ') : '—'
    const region = (index: number) => RegionLabels[index] ?? '—'

    const zones = $derived([
        {
            name: 'Killing',
            where: regions(killingZone(active)),
            what: 'Everything here dies after the next ruler move.'
        },
        {
            name: 'Swarming',
            where: regions(swarmingZone(active)),
            what: 'Crowded habitats here can be SWARMed.'
        },
        {
            name: 'Scoring',
            where: regions(scoringZone(active)),
            what: 'Insects here score at the next scoring.'
        },
        {
            name: 'Majority',
            where: region(majorityRegion(active)),
            what: 'Habitat majorities are awarded here.'
        },
        {
            name: 'Level +1',
            where: region(levelBoostRegion(active)),
            what: 'Actions taken here gain +1 level.'
        },
        {
            name: 'Breeding',
            where: regions(breedingZone(active)),
            what: 'BREED is only allowed here.'
        }
    ])

    const actionKinds = [
        ActionKind.JumpOrBreed,
        ActionKind.Hatch,
        ActionKind.Cannibalize,
        ActionKind.Swarm
    ]
</script>

<div class="grid gap-4 p-4 text-sm text-[#f1e6cf] lg:grid-cols-2">
    <section class="rounded-lg border border-[#4a3620] bg-[#22170e] p-4">
        <h3 class="mb-2 text-[11px] uppercase tracking-[0.3em] text-[#c9a961]">Zone Ruler now</h3>
        <table class="w-full">
            <tbody>
                {#each zones as zone (zone.name)}
                    <tr class="border-t border-[#3d2c1a] first:border-t-0">
                        <td class="py-1.5 pr-3 font-semibold">{zone.name}</td>
                        <td class="py-1.5 pr-3 font-mono text-[#ffd166]">{zone.where}</td>
                        <td class="py-1.5 text-[#e0cfae]">{zone.what}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </section>

    <section class="rounded-lg border border-[#4a3620] bg-[#22170e] p-4">
        <h3 class="mb-2 text-[11px] uppercase tracking-[0.3em] text-[#c9a961]">Actions</h3>
        <ul class="space-y-2">
            {#each actionKinds as kind (kind)}
                <li class="flex items-start gap-3">
                    <ActionBadge
                        {kind}
                        level={kind === ActionKind.Hatch
                            ? 3
                            : kind === ActionKind.JumpOrBreed
                              ? 2
                              : 1}
                        size={30}
                    />
                    <div>
                        <div class="font-semibold">{ActionNames[kind]}</div>
                        <div class="text-[#e0cfae]">{ActionBlurbs[kind]}</div>
                    </div>
                </li>
            {/each}
        </ul>
    </section>

    <section class="rounded-lg border border-[#4a3620] bg-[#22170e] p-4">
        <h3 class="mb-2 text-[11px] uppercase tracking-[0.3em] text-[#c9a961]">
            Rain &amp; crowding
        </h3>
        <p class="text-[#e0cfae]">
            A habitat holds as many discs as there are cubes in its region (nymphs count). One more
            and it is
            <span class="font-semibold text-[#ff8a7a]">Crowded</span>. The counter under each
            habitat shows
            <span class="font-mono">discs/room</span>.
        </p>
    </section>

    <section class="rounded-lg border border-[#4a3620] bg-[#22170e] p-4">
        <h3 class="mb-2 text-[11px] uppercase tracking-[0.3em] text-[#c9a961]">Scoring</h3>
        <ul class="space-y-1 text-[#e0cfae]">
            <li>
                Grasshopper <b class="text-[#ffd166]">2</b> · Locust <b class="text-[#ffd166]">1</b> ·
                Nymph 0 · Island locust +1
            </li>
            <li>
                Majority: habitat-colour token; runner-up hatches one disc. Region F majorities +3
                VP at the last scoring.
            </li>
            <li>
                End: sets of different tokens 1/3/6/10/15/21/28; most discs in supply +4, second +2
                (tied most +3).
            </li>
        </ul>
    </section>
</div>
