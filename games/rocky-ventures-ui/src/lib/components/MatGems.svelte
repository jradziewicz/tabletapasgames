<script lang="ts">
    import gemIcon from '$lib/images/icons/gem.png'

    // Fills the player mat's printed gem spaces (measured on the 966x644 board image) with the
    // player's current gems. The parent must be positioned and sized to the image.
    let { gems }: { gems: number } = $props()

    const SlotLefts = [68.0, 77.2, 86.4]
</script>

{#each SlotLefts as left, index (index)}
    {#if index < gems}
        <img
            src={gemIcon}
            alt=""
            class="pointer-events-none absolute object-contain"
            style="left: {left}%; top: 84.3%; width: 7.5%; height: 8.7%; padding: 0.6%;"
            draggable="false"
        />
    {/if}
{/each}
