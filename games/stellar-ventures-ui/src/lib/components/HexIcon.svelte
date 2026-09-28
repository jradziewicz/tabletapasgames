<script lang="ts">
    // A plain, single-color pointy-top hex pictograph, matching Board.svelte's own hex
    // orientation - for places that need to show "a hex" as a generic concept (e.g. Create
    // Wormhole's cost legend: "1 Credit per hex skipped"), the same way OutpostIcon shows "an
    // Outpost" as a generic concept there. Inline SVG (stroke: currentColor) rather than a raster
    // image so it always matches whatever text color it sits next to.
    let { color = 'currentColor' }: { color?: string } = $props()
</script>

<svg
    viewBox="0 0 100 115.47"
    class="inline-block shrink-0 align-[-0.15em]"
    style="height: 0.95em; width: calc(0.95em * 100 / 115.47);"
>
    <polygon
        points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87"
        fill="none"
        stroke={color}
        stroke-width="9"
    />
</svg>
