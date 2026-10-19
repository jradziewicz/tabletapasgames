<script lang="ts">
    let {
        cx,
        cy,
        r,
        tone = 'go'
    }: { cx: number; cy: number; r: number; tone?: 'go' | 'gold' | 'swarm' } = $props()

    const Colors = {
        go: { stroke: '#3ddc84', outline: '#06371b', fill: '#3ddc84' },
        gold: { stroke: '#ffd66e', outline: '#4a3200', fill: '#ffd66e' },
        swarm: { stroke: '#d07cf0', outline: '#3a0f4a', fill: '#b45bd6' }
    }
    const color = $derived(Colors[tone])
</script>

<!-- A legal target: dark outline for contrast on pale board art, thick bright ring, light tint,
     stacked glow and a gentle pulse, so it reads on yellow, salmon and blue habitats alike. -->
<g class="lc-target lc-target-{tone}" pointer-events="none">
    <circle
        {cx}
        {cy}
        {r}
        fill={color.fill}
        fill-opacity="0.22"
        stroke={color.outline}
        stroke-width="13"
    />
    <circle {cx} {cy} {r} fill="none" stroke={color.stroke} stroke-width="7" />
</g>
