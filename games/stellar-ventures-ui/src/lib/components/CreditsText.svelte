<script lang="ts">
    import CreditsIcon from './CreditsIcon.svelte'

    // For the handful of places a Credits amount is embedded in a larger plain-text string
    // (e.g. a Corporate Power's description, "...for ₮1, rebuildable immediately.") rather than
    // interpolated directly into a template - splits on the "₮" placeholder character and drops
    // a real CreditsIcon into each gap, so those strings don't need to become raw HTML.
    let { text, color = 'white' }: { text: string; color?: 'white' | 'black' } = $props()

    const parts = $derived(text.split('₮'))
</script>

{#each parts as part, i (i)}{#if i > 0}<CreditsIcon {color} />{/if}{part}{/each}
