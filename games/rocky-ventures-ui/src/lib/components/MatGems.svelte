<script lang="ts">
    import gemIcon from '$lib/images/icons/gem.png'

    // Fills the player mat's printed gem spaces (measured on the 834x644 mat image) with the
    // player's current gems. The parent must be positioned and sized to the image.
    let { gems }: { gems: number } = $props()

    const SlotLefts = [64.5, 75.1, 85.8]
</script>

{#each SlotLefts as left, index (index)}
    {#if index < gems}
        <img
            src={gemIcon}
            alt=""
            class="pointer-events-none absolute object-contain"
            style="left: {left}%; top: 81.3%; width: 8.7%; height: 9.3%; padding: 0.7%;"
            draggable="false"
        />
    {/if}
{/each}
