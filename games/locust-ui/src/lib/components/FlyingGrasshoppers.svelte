<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import {
        JumpAnimator,
        animateFlyingGrasshopper,
        type FlyingGrasshopper
    } from '$lib/animators/jumpAnimator.js'
    import Disc from './Disc.svelte'

    const session = getGameSession()
    let flying: FlyingGrasshopper[] = $state([])
    const animator = new JumpAnimator(session, (grasshoppers) => (flying = grasshoppers))
</script>

<g pointer-events="none" data-flying-grasshoppers {@attach attachAnimator(animator)}>
    {#each flying as grasshopper (grasshopper.key)}
        <g
            class="lc-lift"
            transform="translate({grasshopper.from.x} {grasshopper.from.y})"
            use:animateFlyingGrasshopper={{ animator, key: grasshopper.key }}
        >
            <Disc
                center={{ x: 0, y: 0 }}
                fill={session.colors.getUiColor(grasshopper.color)}
                count={1}
            />
        </g>
    {/each}
</g>
