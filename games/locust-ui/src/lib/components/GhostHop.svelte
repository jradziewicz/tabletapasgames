<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { gsap } from 'gsap'
    import { onMount } from 'svelte'
    import { arcControl, arcPoint } from '$lib/utils/arc.js'
    import Disc from './Disc.svelte'

    let {
        from,
        to,
        fill,
        delay = 0
    }: { from: Point; to: Point; fill: string; delay?: number } = $props()

    let node: SVGGElement | undefined = $state()

    // A staged (not yet committed) jump: purely local preview motion, so it lives here rather than
    // in the shared AnimationContext.
    onMount(() => {
        if (!node) return
        const element = node
        const control = arcControl(from, to)
        const progress = { t: 0 }
        const place = () => {
            const point = arcPoint(from, control, to, progress.t)
            const lift = 1 + 0.3 * Math.sin(Math.PI * progress.t)
            element.setAttribute('transform', `translate(${point.x} ${point.y}) scale(${lift})`)
        }
        place()
        const tween = gsap.to(progress, {
            t: 1,
            duration: 0.55,
            delay,
            ease: 'power2.inOut',
            onUpdate: place
        })
        return () => tween.kill()
    })
</script>

<g bind:this={node} class="ghost-hop" pointer-events="none">
    <Disc center={{ x: 0, y: 0 }} {fill} count={1} />
</g>

<style>
    .ghost-hop {
        opacity: 0.6;
    }
</style>
