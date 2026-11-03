<script lang="ts">
    import gemIcon from '$lib/images/icons/gem.png'

    // Fills the player mat's printed gem spaces (measured on the 414x644 mat image) with the
    // player's current gems. The parent must be positioned and sized to the image.
    let { gems }: { gems: number } = $props()

    const SlotLefts = [24.9, 46.4, 68.1]
</script>

{#each SlotLefts as left, index (index)}
    {#if index < gems}
        <img
            src={gemIcon}
            alt=""
            class="pointer-events-none absolute object-contain"
            style="left: {left}%; top: 84.3%; width: 17.4%; height: 8.7%; padding: 1.5%;"
            draggable="false"
        />
    {/if}
{/each}
