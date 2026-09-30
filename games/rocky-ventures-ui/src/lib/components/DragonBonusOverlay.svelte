<script lang="ts">
    import { BonusTokensToSummonDragon, type WeaponTokenKind } from '@tabletop/rocky-ventures'
    import {
        DragonTrackerImageUrl,
        DragonTrackerSize,
        DragonTrackerSlots,
        weaponTokenImageUrl
    } from '$lib/utils/dragonImages.js'

    let { tokens, onclose }: { tokens: WeaponTokenKind[]; onclose: () => void } = $props()

    const Titles = ['Something stirs', 'A distant rumble', 'Smoke on the peaks', 'The mountain trembles', 'It is almost awake']

    const level = $derived(Math.min(tokens.length, BonusTokensToSummonDragon - 1))
    const intensity = $derived(level / (BonusTokensToSummonDragon - 1))
    const embers = $derived(
        Array.from({ length: level * 6 }, (_, index) => ({
            left: (index * 37) % 100,
            delay: ((index * 53) % 20) / 10,
            duration: 2.6 - intensity + ((index * 17) % 16) / 10,
            size: 3 + ((index * 11) % 7)
        }))
    )

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            onclose()
        }
    }
</script>

<svelte:window {onkeydown} />

<div
    class="bonus-stage fixed inset-0 z-[55] flex flex-col items-center justify-center overflow-hidden"
    style="--intensity: {intensity}; --shake: {Math.round(intensity * intensity * 9)}px; animation-iteration-count: {1 + Math.round(intensity * 3)};"
    role="presentation"
    onclick={onclose}
>
    <div class="bonus-backdrop absolute inset-0"></div>
    {#each embers as ember, index (index)}
        <span
            class="ember absolute bottom-0 rounded-full"
            style="left: {ember.left}%; width: {ember.size}px; height: {ember.size}px; animation-delay: {ember.delay}s; animation-duration: {ember.duration}s;"
        ></span>
    {/each}
    <div class="relative flex flex-col items-center gap-4">
        {#if DragonTrackerImageUrl}
            <svg
                viewBox="0 0 {DragonTrackerSize.width} {DragonTrackerSize.height}"
                class="tracker h-[45vh] w-auto"
            >
                <image href={DragonTrackerImageUrl} width={DragonTrackerSize.width} height={DragonTrackerSize.height} />
                {#each tokens as kind, index (index)}
                    {@const slot = DragonTrackerSlots[index]}
                    {@const url = weaponTokenImageUrl(kind)}
                    {#if slot && url}
                        <image
                            href={url}
                            x={slot.x - 62}
                            y={slot.y - 62}
                            width="124"
                            height="124"
                            class={index === tokens.length - 1 ? 'new-token' : ''}
                        />
                    {/if}
                {/each}
            </svg>
        {/if}
        <div class="bonus-title text-center text-3xl font-black uppercase sm:text-5xl">{Titles[level - 1] ?? Titles[0]}</div>
        <div class="bonus-count text-sm font-semibold uppercase tracking-[0.4em]">
            {tokens.length} / {BonusTokensToSummonDragon}
        </div>
    </div>
</div>

<style>
    .bonus-stage {
        animation: bonus-shake 0.5s ease-in-out 0.9s;
    }
    .bonus-backdrop {
        background: radial-gradient(
            circle at 50% 50%,
            rgba(120, 20, 10, calc(0.25 + var(--intensity) * 0.6)),
            rgba(8, 0, 0, calc(0.7 + var(--intensity) * 0.25)) 70%
        );
        animation: fade-in 0.4s ease-out both;
    }
    .tracker {
        filter: drop-shadow(0 0 calc(10px + var(--intensity) * 50px) rgba(255, 80, 30, calc(0.3 + var(--intensity) * 0.6)));
        animation: tracker-in 0.6s cubic-bezier(0.2, 0.8, 0.3, 1) both;
    }
    .new-token {
        transform-box: fill-box;
        transform-origin: center;
        animation: token-drop 0.55s cubic-bezier(0.3, 0, 0.3, 1.4) 0.45s both;
    }
    .bonus-title {
        color: rgb(255, calc(230 - var(--intensity) * 120), calc(190 - var(--intensity) * 150));
        letter-spacing: 0.1em;
        text-shadow: 0 0 calc(8px + var(--intensity) * 24px) rgba(255, 80, 30, 0.9);
        animation: title-in 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.7s both;
    }
    .bonus-count {
        color: #ff8a5c;
        animation: fade-in 0.6s ease-out 1s both;
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
    @keyframes tracker-in {
        from {
            opacity: 0;
            transform: scale(0.7);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    @keyframes token-drop {
        0% {
            opacity: 0;
            transform: scale(2.6);
        }
        70% {
            opacity: 1;
            transform: scale(0.9);
        }
        100% {
            opacity: 1;
            transform: scale(1);
        }
    }
    @keyframes title-in {
        from {
            opacity: 0;
            transform: scale(1.3);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    @keyframes bonus-shake {
        0%,
        100% {
            transform: translate(0, 0);
        }
        25% {
            transform: translate(calc(var(--shake) * -1), calc(var(--shake) * 0.6));
        }
        50% {
            transform: translate(var(--shake), calc(var(--shake) * -0.5));
        }
        75% {
            transform: translate(calc(var(--shake) * -0.6), calc(var(--shake) * -0.3));
        }
    }
    @keyframes ember-rise {
        0% {
            opacity: 0;
            transform: translateY(0);
        }
        15% {
            opacity: 1;
        }
        100% {
            opacity: 0;
            transform: translateY(-100vh);
        }
    }
</style>
