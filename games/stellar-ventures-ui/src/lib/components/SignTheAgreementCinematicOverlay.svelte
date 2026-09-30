<script lang="ts">
    // Full-screen cinematic that plays for EVERY player the moment any Corporation Signs The
    // Agreement (actions/signTheAgreement.ts) - the signer included, where it plays first and
    // then hands off to OfferSignTheAgreementPanel's own click-through reveal underneath. Purely
    // spectacle: nothing here is a decision.
    //
    // Same approach as FirstShipOrderedRevealOverlay: derived straight from permanent game state
    // (corporation.agreement is set once, forever, by signing) rather than from a live event, so
    // it reaches players who were watching live and players who open the game later alike. "Already
    // seen" is per viewer, in localStorage scoped per game. If several signings are unseen at
    // once they queue, one at a time. Suppressed while scrubbing history so stepping through old
    // turns never replays it.
    //
    // Skippable at any moment: Skip button, Escape, or a click anywhere once the title is up.
    import {
        ActionType,
        HexType,
        type CorporationId,
        agreementTrackEntryForPlanetCount
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationAgreementTokenIcons,
        CorporationColors,
        CorporationDisplayNames,
        CorporationLogoIcons
    } from '$lib/utils/corporationDisplay.js'
    import {
        AlienAgreementTileHiddenIcon,
        AlienAgreementTileRevealedIcons,
        findSignedAgreementHex
    } from '$lib/utils/agreementTileDisplay.js'
    import CreditsIcon from './CreditsIcon.svelte'

    const gameSession = getGameSession()

    const signedCorporations = $derived(
        gameSession.gameState.corporations.filter((corporation) => corporation.agreement !== undefined)
    )

    const storageKey = `stellar-ventures-seen-agreement-signings-${gameSession.gameState.gameId}`

    function loadSeen(): Set<CorporationId> {
        try {
            const raw = localStorage.getItem(storageKey)
            return raw ? new Set(JSON.parse(raw) as CorporationId[]) : new Set()
        } catch {
            return new Set()
        }
    }

    let seen: Set<CorporationId> = $state(loadSeen())

    function markSeen(corporationId: CorporationId) {
        const next = new Set(seen)
        next.add(corporationId)
        seen = next
        try {
            localStorage.setItem(storageKey, JSON.stringify([...next]))
        } catch {
            // Best-effort: worst case it plays again next load.
        }
    }

    const pendingCorporation = $derived(
        gameSession.isViewingHistory
            ? undefined
            : signedCorporations.find((corporation) => !seen.has(corporation.id))
    )

    const reveal = $derived.by(() => {
        const corporation = pendingCorporation
        if (!corporation?.agreement) {
            return undefined
        }
        const alienPlanetHexes = Object.values(gameSession.gameState.board.hexes).filter(
            (hex) => hex.type === HexType.AlienPlanet
        )
        const hex = findSignedAgreementHex(alienPlanetHexes, corporation.id)
        const chevrons = hex?.alienAgreementTileChevrons
        // Whoever actually submitted the signing (the President at that moment - the President
        // may have changed since, for a player catching up later).
        const signingAction = gameSession.actions.find(
            (action) =>
                action.type === ActionType.SignTheAgreement &&
                (hex === undefined || (action as { hexId?: string }).hexId === hex.id)
        )
        const signerId = signingAction?.playerId ?? corporation.getPresidentPlayerId()
        const planetCount = corporation.agreement.planetCountAtSigning
        return {
            corporationId: corporation.id,
            name: CorporationDisplayNames[corporation.id],
            color: CorporationColors[corporation.id],
            logo: CorporationLogoIcons[corporation.id],
            token: CorporationAgreementTokenIcons[corporation.id],
            signerName: signerId ? gameSession.getPlayerName(signerId) : undefined,
            tileIcon: chevrons !== undefined ? AlienAgreementTileRevealedIcons[chevrons] : undefined,
            miningCapacityGain: chevrons !== undefined ? chevrons * 3 : undefined,
            planetCount,
            bonusDividendPerShare: agreementTrackEntryForPlanetCount(planetCount).bonusDividendPerShare
        }
    })

    // Click-anywhere only becomes a skip once the title has landed, so a stray click from
    // whatever the player was doing a moment ago doesn't swallow the whole thing.
    const CLICK_TO_SKIP_AFTER_MS = 1800
    let clickSkipArmed = $state(false)

    $effect(() => {
        clickSkipArmed = false
        if (!reveal) {
            return
        }
        const timer = setTimeout(() => (clickSkipArmed = true), CLICK_TO_SKIP_AFTER_MS)
        return () => clearTimeout(timer)
    })

    function dismiss() {
        if (reveal) {
            markSeen(reveal.corporationId)
        }
    }

    function onBackdropClick() {
        if (clickSkipArmed) {
            dismiss()
        }
    }

    function onKeydown(event: KeyboardEvent) {
        if (reveal && event.key === 'Escape') {
            dismiss()
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

{#if reveal}
    {#key reveal.corporationId}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="cinematic fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
            style="--corp: {reveal.color};"
            role="dialog"
            aria-modal="true"
            aria-label="{reveal.name} signs The Agreement"
            tabindex="-1"
            onclick={onBackdropClick}
        >
            <div class="backdrop"></div>
            <div class="stars stars-a"></div>
            <div class="stars stars-b"></div>
            <div class="nebula"></div>
            <div class="flash"></div>
            <div class="ring ring-1"></div>
            <div class="ring ring-2"></div>
            <div class="ring ring-3"></div>

            <button
                type="button"
                class="skip absolute top-4 right-4 z-10 rounded-full border border-white/30 bg-black/40 px-4 py-1.5 text-xs font-semibold tracking-widest text-white/80 uppercase transition hover:bg-white/10 hover:text-white"
                onclick={(event) => {
                    event.stopPropagation()
                    dismiss()
                }}
            >
                Skip ›
            </button>

            <div class="relative z-[1] flex w-full max-w-3xl flex-col items-center gap-5 px-4 text-center">
                <div class="emblem relative flex items-center justify-center">
                    <div class="tile">
                        <div class="tile-inner">
                            <img class="tile-face tile-back" src={AlienAgreementTileHiddenIcon} alt="" />
                            {#if reveal.tileIcon}
                                <img class="tile-face tile-front" src={reveal.tileIcon} alt="Revealed Alien Agreement Tile" />
                            {/if}
                        </div>
                    </div>
                    <img class="logo" src={reveal.logo} alt="{reveal.name} logo" />
                    {#if reveal.token}
                        <img class="token" src={reveal.token} alt="{reveal.name} Agreement Token" />
                    {/if}
                </div>

                <div class="title-block">
                    <div class="kicker text-xs font-semibold tracking-[0.5em] uppercase sm:text-sm">
                        First Contact Protocol
                    </div>
                    <h1 class="title text-4xl font-black uppercase sm:text-6xl">The Agreement</h1>
                    <div class="subtitle text-2xl font-black tracking-[0.3em] uppercase sm:text-3xl">
                        is signed
                    </div>
                </div>

                <div class="byline text-base text-[#c7cce4] sm:text-lg">
                    <span class="font-bold" style="color: var(--corp);">{reveal.name}</span>
                    has signed with the Aliens{#if reveal.signerName}
                        <span class="text-[#8a90b0]">, by order of President</span>
                        <span class="font-semibold text-white">{reveal.signerName}</span>{/if}
                </div>

                <div class="stats grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                    {#if reveal.miningCapacityGain !== undefined}
                        <div class="stat" style="--i: 0;">
                            <div class="stat-value text-[#7dffb2]">+{reveal.miningCapacityGain}</div>
                            <div class="stat-label">Alien Mining Capacity</div>
                        </div>
                    {/if}
                    <div class="stat" style="--i: 1;">
                        <div class="stat-value flex items-center justify-center gap-1 text-[#ffd76a]">
                            <CreditsIcon />{reveal.bonusDividendPerShare}
                        </div>
                        <div class="stat-label">Bonus Dividend per Share</div>
                    </div>
                    <div class="stat" style="--i: 2;">
                        <div class="stat-value text-white">{reveal.planetCount}{reveal.planetCount >= 5 ? '+' : ''}</div>
                        <div class="stat-label">Alien Planets at Signing</div>
                    </div>
                    <div class="stat" style="--i: 3;">
                        <div class="stat-value text-[#c9a6ff]">1</div>
                        <div class="stat-label">Share Issued to the Aliens</div>
                    </div>
                </div>

                <button
                    type="button"
                    class="continue rounded-lg px-6 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    onclick={(event) => {
                        event.stopPropagation()
                        dismiss()
                    }}
                >
                    Continue
                </button>
            </div>
        </div>
    {/key}
{/if}

<style>
    .cinematic {
        color: #e6e9f5;
    }
    .backdrop {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at center, #0d1030 0%, #04050c 70%);
        animation: fade-in 0.5s ease-out both;
    }
    .nebula {
        position: absolute;
        inset: -20%;
        background:
            radial-gradient(circle at 30% 40%, color-mix(in srgb, var(--corp) 35%, transparent) 0%, transparent 40%),
            radial-gradient(circle at 70% 60%, rgba(80, 255, 170, 0.18) 0%, transparent 45%);
        filter: blur(40px);
        opacity: 0;
        animation:
            fade-in 1.6s ease-out 1.1s forwards,
            drift 18s linear 1.1s infinite alternate;
    }
    .stars {
        position: absolute;
        inset: -50%;
        background-repeat: repeat;
        opacity: 0;
        animation:
            fade-in 1s ease-out 0.2s forwards,
            warp 30s linear infinite;
    }
    .stars-a {
        background-image:
            radial-gradient(1px 1px at 20px 30px, white, transparent),
            radial-gradient(1px 1px at 120px 80px, white, transparent),
            radial-gradient(1.5px 1.5px at 60px 150px, #cfe3ff, transparent),
            radial-gradient(1px 1px at 180px 190px, white, transparent);
        background-size: 200px 200px;
    }
    .stars-b {
        background-image:
            radial-gradient(2px 2px at 50px 60px, #fff, transparent),
            radial-gradient(1.5px 1.5px at 260px 220px, #b8ffd8, transparent),
            radial-gradient(2px 2px at 330px 90px, #fff, transparent);
        background-size: 400px 400px;
        animation-duration: 1s, 50s;
    }
    .flash {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle, #ffffff 0%, color-mix(in srgb, var(--corp) 60%, white) 30%, transparent 70%);
        opacity: 0;
        animation: flash 0.9s ease-out 1.15s forwards;
        pointer-events: none;
    }
    .ring {
        position: absolute;
        left: 50%;
        top: 38%;
        width: 40px;
        height: 40px;
        margin: -20px 0 0 -20px;
        border-radius: 9999px;
        border: 3px solid var(--corp);
        box-shadow:
            0 0 30px var(--corp),
            inset 0 0 20px var(--corp);
        opacity: 0;
        pointer-events: none;
    }
    .ring-1 {
        animation: shockwave 1.6s cubic-bezier(0.1, 0.7, 0.3, 1) 1.2s forwards;
    }
    .ring-2 {
        border-color: #7dffb2;
        box-shadow: 0 0 30px #7dffb2;
        animation: shockwave 1.9s cubic-bezier(0.1, 0.7, 0.3, 1) 1.35s forwards;
    }
    .ring-3 {
        animation: shockwave 2.3s cubic-bezier(0.1, 0.7, 0.3, 1) 1.55s forwards;
    }

    .emblem {
        width: 11rem;
        height: 11rem;
    }
    .tile {
        position: absolute;
        width: 8rem;
        height: 8rem;
        perspective: 800px;
        animation:
            tile-arrive 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.25s both,
            tile-away 0.6s ease-in 2.2s forwards;
    }
    .tile-inner {
        position: relative;
        width: 100%;
        height: 100%;
        transform-style: preserve-3d;
        animation: tile-flip 0.7s ease-in-out 0.8s both;
    }
    .tile-face {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        backface-visibility: hidden;
        filter: drop-shadow(0 0 18px rgba(125, 255, 178, 0.7));
    }
    .tile-front {
        transform: rotateY(180deg);
    }
    .logo {
        position: absolute;
        max-width: 9rem;
        max-height: 9rem;
        object-fit: contain;
        filter: drop-shadow(0 0 24px var(--corp));
        animation: slam 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) 2.35s both;
    }
    .token {
        position: absolute;
        right: -1.5rem;
        bottom: -0.5rem;
        width: 4.5rem;
        height: 4.5rem;
        object-fit: contain;
        filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.8));
        animation: stamp 0.45s cubic-bezier(0.3, 1.6, 0.5, 1) 2.9s both;
    }

    .kicker {
        color: #7dffb2;
        animation: rise 0.6s ease-out 1.5s both;
    }
    .title {
        letter-spacing: 0.08em;
        background: linear-gradient(180deg, #ffffff 0%, #d7dcff 55%, color-mix(in srgb, var(--corp) 70%, white) 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        filter: drop-shadow(0 0 18px color-mix(in srgb, var(--corp) 70%, transparent));
        animation: title-in 1s cubic-bezier(0.2, 0.8, 0.2, 1) 1.6s both;
    }
    .subtitle {
        color: var(--corp);
        text-shadow: 0 0 20px var(--corp);
        animation: rise 0.6s ease-out 2.2s both;
    }
    .byline {
        animation: rise 0.6s ease-out 3.1s both;
    }
    .stat {
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(10, 13, 30, 0.7);
        border-radius: 0.75rem;
        padding: 0.6rem 0.9rem;
        backdrop-filter: blur(4px);
        animation: pop 0.45s cubic-bezier(0.2, 1.3, 0.4, 1) calc(3.5s + var(--i) * 0.18s) both;
    }
    .stat-value {
        font-size: 1.75rem;
        font-weight: 900;
        line-height: 1.1;
    }
    .stat-label {
        font-size: 0.65rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #8a90b0;
    }
    .continue {
        background: var(--corp);
        box-shadow: 0 0 24px color-mix(in srgb, var(--corp) 60%, transparent);
        animation: rise 0.5s ease-out 4.4s both;
    }
    .skip {
        animation: fade-in 0.4s ease-out 0.3s both;
    }

    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    @keyframes warp {
        from {
            transform: scale(1) rotate(0deg);
        }
        to {
            transform: scale(1.25) rotate(8deg);
        }
    }
    @keyframes drift {
        from {
            transform: translate(0, 0) rotate(0deg);
        }
        to {
            transform: translate(3%, -2%) rotate(6deg);
        }
    }
    @keyframes flash {
        0% {
            opacity: 0;
        }
        15% {
            opacity: 0.95;
        }
        100% {
            opacity: 0;
        }
    }
    @keyframes shockwave {
        0% {
            opacity: 1;
            transform: scale(0.5);
        }
        100% {
            opacity: 0;
            transform: scale(40);
        }
    }
    @keyframes tile-arrive {
        from {
            opacity: 0;
            transform: scale(0.3) rotate(-20deg);
        }
        to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
        }
    }
    @keyframes tile-flip {
        from {
            transform: rotateY(0deg);
        }
        to {
            transform: rotateY(180deg);
        }
    }
    @keyframes tile-away {
        to {
            opacity: 0;
            transform: scale(1.8);
            filter: blur(6px);
        }
    }
    @keyframes slam {
        0% {
            opacity: 0;
            transform: scale(3);
            filter: blur(8px) drop-shadow(0 0 24px var(--corp));
        }
        100% {
            opacity: 1;
            transform: scale(1);
        }
    }
    @keyframes stamp {
        0% {
            opacity: 0;
            transform: scale(2.5) rotate(-25deg);
        }
        100% {
            opacity: 1;
            transform: scale(1) rotate(-8deg);
        }
    }
    @keyframes title-in {
        0% {
            opacity: 0;
            letter-spacing: 0.6em;
            transform: scale(1.15);
            filter: blur(10px);
        }
        100% {
            opacity: 1;
            letter-spacing: 0.08em;
            transform: scale(1);
        }
    }
    @keyframes rise {
        from {
            opacity: 0;
            transform: translateY(12px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    @keyframes pop {
        from {
            opacity: 0;
            transform: scale(0.6);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .cinematic *,
        .cinematic *::before,
        .cinematic *::after {
            animation-duration: 0.01ms !important;
            animation-delay: 0ms !important;
            animation-iteration-count: 1 !important;
        }
        .ring,
        .flash,
        .tile {
            display: none;
        }
    }
</style>
