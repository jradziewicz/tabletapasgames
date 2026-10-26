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
    //
    // The default white icon turns red on its own whenever the text around it is red (a loss, a
    // tax, a negative value), drawn in that exact text color through a mask of the white art.
    // The tiny color transition below makes the browser fire transitionend whenever the
    // inherited text color changes, so an amount that turns red later is picked up too.
    let { color = 'white' }: { color?: 'white' | 'black' | 'green' } = $props()

    const sources = { white: creditsWhite, black: creditsBlack, green: creditsGreen }

    let element: HTMLSpanElement | undefined = $state()
    let inRedText = $state(false)

    function isRed(cssColor: string): boolean {
        const match = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (!match) return false
        const [r, g, b] = match.slice(1, 4).map(Number)
        return r >= 180 && r - g >= 60 && r - b >= 60 && Math.abs(g - b) < 50
    }

    function checkColor() {
        if (element) inRedText = color === 'white' && isRed(getComputedStyle(element).color)
    }

    $effect(() => {
        void color
        checkColor()
    })
</script>

<span
    bind:this={element}
    ontransitionend={checkColor}
    class="credits-icon inline-block shrink-0 align-[-0.15em]"
    style="height: 0.95em; width: calc(0.95em * 344 / 395);"
>
    {#if inRedText}
        <span
            role="img"
            aria-label="Credits"
            class="block h-full w-full"
            style="background-color: currentColor; -webkit-mask: url({creditsWhite}) center / contain no-repeat; mask: url({creditsWhite}) center / contain no-repeat;"
        ></span>
    {:else}
        <img src={sources[color]} alt="Credits" class="block h-full w-full" />
    {/if}
</span>

<style>
    .credits-icon {
        transition: color 1ms;
    }
</style>
