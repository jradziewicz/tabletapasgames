<script lang="ts">
    import type { Point } from '@tabletop/common'

    let {
        center,
        fill,
        count,
        locust = false,
        nymph = false,
        radius = 22
    }: {
        center: Point
        fill: string
        count: number
        locust?: boolean
        nymph?: boolean
        radius?: number
    } = $props()

    const textFill = $derived(fill === '#f5c400' ? '#1a1a1a' : '#ffffff')
</script>

<g transform="translate({center.x} {center.y})">
    {#if nymph}
        <circle r={radius} fill="none" stroke={fill} stroke-width="7" />
        <circle r={radius - 6} fill="#fff8e6" opacity="0.85" />
        <text
            text-anchor="middle"
            dominant-baseline="central"
            font-size="22"
            font-weight="700"
            fill="#2b2418">{count}</text
        >
    {:else}
        <ellipse
            cx="2"
            cy={radius * 0.35}
            rx={radius}
            ry={radius * 0.85}
            fill="#000"
            opacity="0.28"
        />
        <circle r={radius} {fill} stroke="#1a1a1a" stroke-width="3" />
        <circle r={radius - 2} fill="url(#disc-shine)" />
        {#if locust}
            <circle
                cx={radius * 0.55}
                cy={-radius * 0.55}
                r="5"
                fill="#ffffff"
                stroke="#1a1a1a"
                stroke-width="1.5"
            />
        {/if}
        {#if count > 1 || locust}
            <text
                text-anchor="middle"
                dominant-baseline="central"
                font-size="22"
                font-weight="700"
                fill={textFill}>{count}</text
            >
        {/if}
    {/if}
</g>
