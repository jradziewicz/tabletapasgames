<script lang="ts">
    import creditsWhite from '$lib/images/currency/creditsWhite.png'
    import creditsBlack from '$lib/images/currency/creditsBlack.png'
    import creditsGreen from '$lib/images/currency/creditsGreen.png'

    // The Credits currency symbol, as a real icon (extracted from the game's own Credits art)
    // rather than the "₮" placeholder character it replaces everywhere in this UI. Sized in em
    // units so it scales with whatever text it sits next to, and using the source art's own
    // aspect ratio (344x395) so it's never stretched or squashed. 'green' is the game's own
    // brand-green Credits art (not a tint of the white one) - use it wherever a Credits amount
    // sits inside green-colored text (e.g. a "(+X)" gain), so the icon matches its text instead
    // of showing up white against it.
    let { color = 'white' }: { color?: 'white' | 'black' | 'green' } = $props()

    const sources = { white: creditsWhite, black: creditsBlack, green: creditsGreen }
</script>

<img
    src={sources[color]}
    alt="Credits"
    class="inline-block shrink-0 align-[-0.15em]"
    style="height: 0.95em; width: calc(0.95em * 344 / 395);"
/>
