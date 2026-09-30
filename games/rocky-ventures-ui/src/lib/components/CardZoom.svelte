<script lang="ts">
    let { imageUrl, alt, onclose }: { imageUrl: string; alt: string; onclose: () => void } = $props()

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            onclose()
        }
    }
</script>

<svelte:window {onkeydown} />

<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 card-zoom-backdrop"
    role="presentation"
    onclick={onclose}
>
    <div class="card-zoom-stage">
        <img src={imageUrl} {alt} class="card-zoom-card rounded-xl shadow-2xl border-2 border-[#c9a961]" draggable="false" />
    </div>
    <div class="absolute bottom-6 text-[#f1e6cf] text-sm opacity-80">Click anywhere or press Esc to close</div>
</div>

<style>
    .card-zoom-backdrop {
        animation: backdrop-in 180ms ease-out;
    }
    .card-zoom-stage {
        perspective: 1400px;
    }
    .card-zoom-card {
        max-height: min(85vh, 900px);
        max-width: 90vw;
        width: auto;
        height: auto;
        transform-origin: center;
        animation: card-turn 420ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
        backface-visibility: hidden;
    }
    @keyframes backdrop-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    @keyframes card-turn {
        0% {
            transform: rotateY(90deg) scale(0.6);
            opacity: 0;
        }
        60% {
            opacity: 1;
        }
        100% {
            transform: rotateY(0deg) scale(1);
            opacity: 1;
        }
    }
</style>
