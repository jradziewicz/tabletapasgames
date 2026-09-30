<script lang="ts">
    // Hover any Corporate Power card anywhere in the game (Charter, Draft Power, Initial Auction
    // reference row, the Sign The Agreement walkthrough, ...) and a large copy pops out beside it
    // so the rules text is readable. Rather than every panel opting in, this is mounted once in
    // GameTable.svelte and recognizes a power card purely by its image src
    // (corporatePowerImages.ts's AllPowerCardImages). Purely visual: pointer-events none, never
    // blocks the click that flips or picks a card underneath. Mouse only - touch has no hover.
    import { AllPowerCardImages, POWER_CARD_ASPECT } from '$lib/utils/corporatePowerImages.js'

    // Don't bother zooming a card that's already shown about this big.
    const ZOOM_WIDTH_PX = 440
    const MIN_ZOOM_RATIO = 1.4
    const SHOW_DELAY_MS = 120
    const GAP_PX = 14
    const MARGIN_PX = 12

    let zoom: { src: string; left: number; top: number; width: number } | undefined = $state()
    let hovered: HTMLImageElement | undefined
    let showTimer: ReturnType<typeof setTimeout> | undefined

    function isPowerCard(el: EventTarget | null): el is HTMLImageElement {
        return el instanceof HTMLImageElement && AllPowerCardImages.has(el.getAttribute('src') ?? '')
    }

    function place(img: HTMLImageElement) {
        const rect = img.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight
        const width = Math.min(ZOOM_WIDTH_PX, vw - 2 * MARGIN_PX)
        if (width < rect.width * MIN_ZOOM_RATIO) {
            return undefined
        }
        const height = width / POWER_CARD_ASPECT

        // Prefer the side of the card with more room; fall back to above/below on narrow screens.
        const roomRight = vw - rect.right
        const roomLeft = rect.left
        let left: number
        let top: number
        if (Math.max(roomRight, roomLeft) >= width + GAP_PX + MARGIN_PX) {
            left = roomRight >= roomLeft ? rect.right + GAP_PX : rect.left - GAP_PX - width
            top = rect.top + rect.height / 2 - height / 2
        } else {
            left = rect.left + rect.width / 2 - width / 2
            top = rect.top >= vh - rect.bottom ? rect.top - GAP_PX - height : rect.bottom + GAP_PX
        }
        left = Math.min(Math.max(left, MARGIN_PX), vw - width - MARGIN_PX)
        top = Math.min(Math.max(top, MARGIN_PX), vh - height - MARGIN_PX)
        return { src: img.getAttribute('src')!, left, top, width }
    }

    function hide() {
        clearTimeout(showTimer)
        hovered = undefined
        zoom = undefined
    }

    function onPointerOver(event: PointerEvent) {
        if (event.pointerType !== 'mouse') {
            return
        }
        const target = event.target
        if (!isPowerCard(target)) {
            if (hovered) hide()
            return
        }
        if (target === hovered) {
            return
        }
        hide()
        hovered = target
        showTimer = setTimeout(() => {
            if (hovered === target && target.isConnected) {
                zoom = place(target)
            }
        }, SHOW_DELAY_MS)
    }

    function onPointerOut(event: PointerEvent) {
        if (hovered && event.target === hovered && event.relatedTarget !== hovered) {
            hide()
        }
    }

    // Any scroll (including inside a panel) moves the card out from under the zoom.
    $effect(() => {
        const onScroll = () => {
            if (hovered) hide()
        }
        document.addEventListener('scroll', onScroll, true)
        return () => document.removeEventListener('scroll', onScroll, true)
    })

    // A flip (Charter's front/back toggle) swaps the hovered img's src in place - keep the zoom in
    // step instead of showing the old face.
    $effect(() => {
        if (!zoom || !hovered) return
        const img = hovered
        const observer = new MutationObserver(() => {
            zoom = isPowerCard(img) ? place(img) : undefined
        })
        observer.observe(img, { attributes: true, attributeFilter: ['src'] })
        return () => observer.disconnect()
    })
</script>

<svelte:window
    onpointerover={onPointerOver}
    onpointerout={onPointerOut}
    onblur={hide}
/>

{#if zoom}
    <img
        src={zoom.src}
        alt=""
        aria-hidden="true"
        class="power-zoom rounded-xl"
        style="left: {zoom.left}px; top: {zoom.top}px; width: {zoom.width}px; aspect-ratio: {POWER_CARD_ASPECT};"
    />
{/if}

<style>
    .power-zoom {
        position: fixed;
        z-index: 70;
        pointer-events: none;
        object-fit: contain;
        filter: drop-shadow(0 18px 40px rgba(0, 0, 0, 0.75));
        animation: zoom-in 0.14s ease-out both;
    }
    @keyframes zoom-in {
        from {
            opacity: 0;
            transform: scale(0.92);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>
