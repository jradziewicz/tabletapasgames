<script lang="ts">
    import { DragonTileImageUrl } from '$lib/utils/dragonImages.js'

    let { onclose }: { onclose: () => void } = $props()

    const embers = Array.from({ length: 28 }, (_, index) => ({
        left: (index * 37) % 100,
        delay: ((index * 53) % 30) / 10,
        duration: 2.4 + ((index * 17) % 20) / 10,
        size: 4 + ((index * 11) % 8)
    }))

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            onclose()
        }
    }
</script>

<svelte:window {onkeydown} />

<div class="dragon-stage fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden" role="presentation" onclick={onclose}>
    <div class="dragon-backdrop absolute inset-0"></div>
    <div class="dragon-flash absolute inset-0"></div>
    {#each embers as ember, index (index)}
        <span
            class="ember absolute bottom-0 rounded-full"
            style="left: {ember.left}%; width: {ember.size}px; height: {ember.size}px; animation-delay: {ember.delay}s; animation-duration: {ember.duration}s;"
        ></span>
    {/each}
    <div class="relative flex flex-col items-center gap-6">
        {#if DragonTileImageUrl}
            <img src={DragonTileImageUrl} alt="The Dragon" class="dragon-image max-h-[55vh] w-auto rounded-2xl" draggable="false" />
        {/if}
        <div class="dragon-title text-center text-4xl font-black uppercase text-[#ffd9a0] sm:text-6xl">The Dragon Awakens</div>
        <div class="dragon-subtitle text-sm uppercase tracking-[0.4em] text-[#ff8a5c]">Level 8 · every delivery is now more dangerous</div>
    </div>
</div>

<style>
    .dragon-stage {
        animation: dragon-shake 0.9s ease-in-out 0.35s 2;
    }
    .dragon-backdrop {
        background: radial-gradient(circle at 50% 55%, rgba(140, 20, 10, 0.85), rgba(10, 0, 0, 0.95) 70%);
        animation: fade-in 0.6s ease-out both;
    }
    .dragon-flash {
        background: #fff3d0;
        animation: flash 0.9s ease-out both;
        pointer-events: none;
    }
    .dragon-image {
        animation: dragon-rise 1.6s cubic-bezier(0.15, 0.85, 0.2, 1) 0.3s both;
        filter: drop-shadow(0 0 40px rgba(255, 90, 40, 0.9)) drop-shadow(0 0 90px rgba(255, 40, 0, 0.7));
    }
    .dragon-title {
        letter-spacing: 0.12em;
        text-shadow: 0 0 24px rgba(255, 90, 30, 0.95), 0 4px 0 rgba(90, 10, 0, 0.9);
        animation: title-in 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) 1.1s both;
    }
    .dragon-subtitle {
        animation: fade-in 1s ease-out 1.9s both;
    }
    .ember {
        background: radial-gradient(circle, #ffd27a, #ff5a1f);
        box-shadow: 0 0 10px 2px rgba(255, 110, 30, 0.9);
        opacity: 0;
        animation: ember-rise linear infinite;
    }
    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    @keyframes flash {
        0% {
            opacity: 0.95;
        }
        100% {
            opacity: 0;
        }
    }
    @keyframes dragon-rise {
        0% {
            opacity: 0;
            transform: scale(0.2) translateY(80px) rotate(-6deg);
        }
        60% {
            opacity: 1;
            transform: scale(1.12) translateY(-10px) rotate(1deg);
        }
        100% {
            opacity: 1;
            transform: scale(1) translateY(0) rotate(0);
        }
    }
    @keyframes title-in {
        from {
            opacity: 0;
            letter-spacing: 0.6em;
            transform: scale(1.4);
        }
        to {
            opacity: 1;
            letter-spacing: 0.12em;
            transform: scale(1);
        }
    }
    @keyframes dragon-shake {
        0%,
        100% {
            transform: translate(0, 0);
        }
        20% {
            transform: translate(-10px, 6px);
        }
        40% {
            transform: translate(9px, -7px);
        }
        60% {
            transform: translate(-7px, -5px);
        }
        80% {
            transform: translate(6px, 8px);
        }
    }
    @keyframes ember-rise {
        0% {
            opacity: 0;
            transform: translateY(0) scale(1);
        }
        15% {
            opacity: 1;
        }
        100% {
            opacity: 0;
            transform: translateY(-95vh) translateX(30px) scale(0.3);
        }
    }
</style>
