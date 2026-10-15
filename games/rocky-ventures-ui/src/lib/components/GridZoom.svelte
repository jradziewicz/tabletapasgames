<script lang="ts">
    import GridView from '$lib/components/GridView.svelte'

    // The weapon / tool grid popped out large, opened like a zoomed card.
    let { onclose }: { onclose: () => void } = $props()

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            onclose()
        }
    }
</script>

<svelte:window {onkeydown} />

<div
    class="grid-zoom-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    role="presentation"
    onclick={onclose}
>
    <div class="grid-zoom-panel overflow-hidden rounded-xl border-2 border-[#c9a961] shadow-2xl">
        <GridView idPrefix="grid-zoom" class="block h-auto w-[min(92vw,1100px)] max-h-[80vh]" />
    </div>
    <div class="absolute bottom-6 text-sm text-[#f1e6cf] opacity-80">Click anywhere or press Esc to close</div>
</div>

<style>
    .grid-zoom-backdrop {
        animation: backdrop-in 180ms ease-out;
    }
    .grid-zoom-panel {
        animation: pop-in 320ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
    }
    @keyframes backdrop-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    @keyframes pop-in {
        from {
            transform: scale(0.6);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }
</style>
