<script lang="ts">
    import type { ActionKind, HabitatColor } from '@tabletop/locust'
    import { ActionBadgeFill, HabitatHex } from '$lib/utils/describe.js'

    let {
        kind,
        level,
        color,
        size = 36
    }: { kind: ActionKind; level: number; color?: HabitatColor; size?: number } = $props()

    const fill = $derived(color ? (HabitatHex[color] ?? ActionBadgeFill[kind]) : ActionBadgeFill[kind])
</script>

<svg width={size} height={size} viewBox="0 0 40 40" class="shrink-0" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill={fill} stroke="#1a140c" stroke-width="2" />
    <circle cx="20" cy="20" r="18" fill="url(#badge-shine)" />
    <defs>
        <radialGradient id="badge-shine" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
    </defs>
    <text x="20" y="21" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="800" fill="#2b2418"
        >{level}</text
    >
</svg>
