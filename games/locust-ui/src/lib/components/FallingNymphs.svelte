<script lang="ts">
    import { getHabitat } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import { NymphDropAnimator, animateFallingNymph, type FallingNymph } from '$lib/animators/nymphDropAnimator.js'
    import { habitatCenter, nymphPoint } from '$lib/utils/boardLayout.js'
    import Disc from './Disc.svelte'

    const session = getGameSession()
    let falling: FallingNymph[] = $state([])
    const animator = new NymphDropAnimator(session, (nymphs) => (falling = nymphs))
</script>

<g pointer-events="none" data-falling-nymphs {@attach attachAnimator(animator)}>
    {#each falling as nymph (nymph.key)}
        {@const point = nymphPoint(habitatCenter(getHabitat(nymph.habitatId)), nymph.quadrant)}
        <g transform="translate({point.x} {point.y})">
            <g use:animateFallingNymph={{ animator, key: nymph.key }}>
                <Disc center={{ x: 0, y: 0 }} fill={session.colors.getUiColor(nymph.color)} count={1} nymph radius={20} />
            </g>
        </g>
    {/each}
</g>
