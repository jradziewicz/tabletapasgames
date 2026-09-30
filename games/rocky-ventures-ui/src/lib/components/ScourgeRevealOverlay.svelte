<script lang="ts">
    import { onMount } from 'svelte'
    import { ScourgeDefinitionsById } from '@tabletop/rocky-ventures'
    import { scourgeImageUrl } from '$lib/utils/scourgeImages.js'

    let { scourgeId, onclose }: { scourgeId: string; onclose: () => void } = $props()

    const RiseMs = 320
    const HoldMs = 650
    const DropMs = 560

    const url = $derived(scourgeImageUrl(scourgeId))
    const definition = $derived(ScourgeDefinitionsById[scourgeId])

    let cardEl: HTMLImageElement | undefined = $state()
    let leaving = $state(false)

    function dropTransform(card: HTMLImageElement): string | undefined {
        const target = document.querySelector(`[data-scourge-id="${scourgeId}"]`)
        const rect = target?.getBoundingClientRect()
        if (!rect || rect.width === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
            return undefined
        }
        const landscape = target?.getAttribute('data-landscape') === 'true'
        const cardRect = card.getBoundingClientRect()
        const dx = rect.left + rect.width / 2 - (cardRect.left + cardRect.width / 2)
        const dy = rect.top + rect.height / 2 - (cardRect.top + cardRect.height / 2)
        const scale = (landscape ? rect.height : rect.width) / card.offsetWidth
        return `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${landscape ? 90 : 0}deg)`
    }

    onMount(() => {
        const card = cardEl
        if (!card) {
            onclose()
            return
        }
        let cancelled = false
        const timers: ReturnType<typeof setTimeout>[] = []
        card.animate(
            [
                { opacity: 0, transform: 'translate(0px, 24px) scale(1) rotate(0deg)' },
                { opacity: 1, transform: 'translate(0px, 0px) scale(1) rotate(0deg)' }
            ],
            { duration: RiseMs, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' }
        )
        timers.push(
            setTimeout(() => {
                if (cancelled) {
                    return
                }
                leaving = true
                const landing = dropTransform(card)
                const drop = card.animate(
                    landing
                        ? [
                              { opacity: 1, transform: 'translate(0px, 0px) scale(1) rotate(0deg)' },
                              { opacity: 1, transform: landing }
                          ]
                        : [
                              { opacity: 1, transform: 'translate(0px, 0px) scale(1) rotate(0deg)' },
                              { opacity: 0, transform: 'translate(0px, 40px) scale(0.9) rotate(0deg)' }
                          ],
                    { duration: DropMs, easing: 'cubic-bezier(0.55, 0, 0.8, 0.4)', fill: 'forwards' }
                )
                drop.onfinish = () => {
                    if (!cancelled) {
                        onclose()
                    }
                }
            }, RiseMs + HoldMs)
        )
        timers.push(setTimeout(() => !cancelled && onclose(), RiseMs + HoldMs + DropMs + 600))
        return () => {
            cancelled = true
            timers.forEach(clearTimeout)
        }
    })
</script>

<div class="pointer-events-none fixed inset-0 z-50">
    <div class="reveal-backdrop absolute inset-0" class:leaving></div>
    <div class="absolute inset-0 flex items-center justify-center">
        {#if url}
            <img
                bind:this={cardEl}
                src={url}
                alt={definition?.name ?? scourgeId}
                class="h-[38vh] max-h-[400px] w-auto rounded-xl border-2 border-[#ff5a4f] opacity-0 shadow-2xl"
                style="box-shadow: 0 0 32px 10px rgba(255, 90, 79, 0.75);"
                draggable="false"
            />
        {/if}
    </div>
</div>

<style>
    .reveal-backdrop {
        background: rgba(0, 0, 0, 0.65);
        animation: backdrop-in 0.3s ease-out both;
        transition: opacity 0.5s ease-in;
    }
    .reveal-backdrop.leaving {
        opacity: 0;
    }
    @keyframes backdrop-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
</style>
