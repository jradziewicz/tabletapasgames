<script lang="ts">
    // A chess pawn in the player's colour with a radial highlight and shadow so it reads as a
    // solid piece. Sized by its height.
    let {
        fill,
        height = 84,
        title = 'Action pawn'
    }: { fill: string; height?: number; title?: string } = $props()

    const width = $derived((height * 40) / 60)
    const gradientId = $props.id()
</script>

<svg viewBox="0 0 40 60" {width} {height} xmlns="http://www.w3.org/2000/svg" aria-label={title} role="img">
    <title>{title}</title>
    <defs>
        <radialGradient id="{gradientId}-body" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55" />
            <stop offset="45%" stop-color={fill} stop-opacity="1" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0.45" />
        </radialGradient>
        <linearGradient id="{gradientId}-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0.5" />
        </linearGradient>
        <filter id="{gradientId}-shadow" x="-30%" y="-10%" width="160%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity="0.55" />
        </filter>
    </defs>
    <g filter="url(#{gradientId}-shadow)">
        <ellipse cx="20" cy="56" rx="15" ry="3" fill="#000" opacity="0.35" />
        <rect x="4" y="46" width="32" height="9" rx="3" fill={fill} stroke="#111" stroke-width="1.5" />
        <rect x="4" y="46" width="32" height="9" rx="3" fill="url(#{gradientId}-base)" />
        <path
            d="M13 21 h14 l-2.5 6 c1.5 0.5 2.5 1.5 2.5 3 c0 6 2.5 11 6 16 h-26 c3.5 -5 6 -10 6 -16 c0 -1.5 1 -2.5 2.5 -3 Z"
            fill={fill}
            stroke="#111"
            stroke-width="1.5"
            stroke-linejoin="round"
        />
        <path
            d="M13 21 h14 l-2.5 6 c1.5 0.5 2.5 1.5 2.5 3 c0 6 2.5 11 6 16 h-26 c3.5 -5 6 -10 6 -16 c0 -1.5 1 -2.5 2.5 -3 Z"
            fill="url(#{gradientId}-body)"
        />
        <circle cx="20" cy="12" r="9" fill={fill} stroke="#111" stroke-width="1.5" />
        <circle cx="20" cy="12" r="9" fill="url(#{gradientId}-body)" />
        <ellipse cx="16.5" cy="8.5" rx="2.6" ry="1.8" fill="#fff" opacity="0.6" />
    </g>
</svg>
