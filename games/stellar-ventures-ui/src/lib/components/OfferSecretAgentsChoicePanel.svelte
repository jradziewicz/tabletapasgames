<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, CorporatePowerId } from '@tabletop/stellar-ventures'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import {
        activePowerCardImageForSide,
        POWER_CARD_ASPECT
    } from '$lib/utils/corporatePowerImages.js'
    import {
        AlienAgreementTileHiddenIcon,
        AlienAgreementTileRevealedIcons
    } from '$lib/utils/agreementTileDisplay.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import alienMarker from '$lib/images/markers/alien.png'

    // Secret Agents' Mining Capacity choice (Amethyst Agency's own Formation Power, Glossary
    // page 29) - offered immediately after a build lands Amethyst on an Alien Planet with a
    // still-hidden Alien Agreement Tile (state.secretAgentsCorporationId / secretAgentsHexId -
    // see stateHandlers/offerSecretAgentsChoice.ts). The choice always belongs to the
    // Corporation's President, who may not be whoever just built (e.g. a Shareholder's Jerry-Rig
    // during Investor Shenanigans), so this panel is visible to everyone but only actionable for
    // that President - same "detour outside the normal turn order" treatment as
    // OfferSignTheAgreementPanel.svelte.
    //
    // Choosing "Increase Alien" gets its own brief reveal (gameSession.secretAgentsReveal - see
    // session.svelte.ts's comment), same client-side pacing gate idea as
    // OfferSignTheAgreementPanel's own reveal: increaseAlienMiningCapacity.ts already flips the
    // tile and grants the Mining Capacity atomically the instant it's submitted, but that same
    // action also clears secretAgentsCorporationId/secretAgentsHexId and moves machineState on -
    // so without this, the President would never actually see the tile flip or the Mining
    // Capacity gain before the panel disappeared. Unlike Sign The Agreement's reveal, there's
    // nothing further to click through here - it just holds the revealed tile on screen for a
    // few seconds, then clears itself automatically. "Increase Amethyst" has no further reveal to
    // pace (nothing to look at beyond the number itself, which the Corporation's stats already
    // show immediately), so it resolves and moves on right away.
    const gameSession = getGameSession()

    const reveal = $derived(gameSession.secretAgentsReveal)
    const corporationId = $derived(
        reveal?.corporationId ?? gameSession.gameState.secretAgentsCorporationId
    )
    const hexId = $derived(reveal?.hexId ?? gameSession.gameState.secretAgentsHexId)
    const hex = $derived(hexId ? gameSession.gameState.board.hexes[hexId] : undefined)
    const corporation = $derived(
        corporationId ? gameSession.gameState.getCorporation(corporationId) : undefined
    )
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    const canIncreaseAlien = $derived(
        gameSession.validActionTypes.includes(ActionType.IncreaseAlienMiningCapacity)
    )
    const canIncreaseAmethyst = $derived(
        gameSession.validActionTypes.includes(ActionType.IncreaseAmethystMiningCapacity)
    )

    const secretAgentsImage = $derived(
        corporationId
            ? activePowerCardImageForSide(corporationId, CorporatePowerId.SecretAgents, 'back')
            : undefined
    )

    // The tile stays face down until the reveal actually starts (increaseAlienMiningCapacity.ts
    // has already flipped it for real by then, same "resolves atomically, revealed on the
    // client's own timing" split as Sign The Agreement's tile flip).
    const chevrons = $derived(hex?.alienAgreementTileChevrons)
    const alienTileImage = $derived(
        reveal && chevrons !== undefined
            ? (AlienAgreementTileRevealedIcons[chevrons] ?? AlienAgreementTileHiddenIcon)
            : AlienAgreementTileHiddenIcon
    )
    const alienMiningCapacityGain = $derived(reveal && chevrons !== undefined ? chevrons * 3 : 0)

    const PIECE_HEIGHT_PX = 107
    // How long to hold the flipped tile on screen before this panel lets go and falls through to
    // whatever machineState has already moved on to.
    const REVEAL_DURATION_MS = 3000

    async function increaseAlien() {
        // Set the reveal OPTIMISTICALLY, before submitting - not after awaiting. The chevron
        // count itself is never actually hidden from the client (definition/initializer.ts's own
        // comment: "each Alien Planet hex's chevron count is known internally from Setup onward"
        // - alienAgreementTileHidden only ever gated whether the UI showed it), so there's
        // nothing to wait on the server for. Waiting until after the await instead left a real
        // gap: crossing that await lets the framework's own state update land first, clearing
        // secretAgentsCorporationId/secretAgentsHexId and moving machineState on - and since
        // ActionPanel's reveal branch wasn't set yet at that instant, neither branch that renders
        // this panel matched, so it briefly unmounted (replaced by whatever panel the new
        // machineState calls for) before the reveal could ever be shown. Setting it first keeps
        // ActionPanel's top-priority branch true for the whole round trip, so this panel never
        // has a moment where nothing matches it.
        const corporationIdToReveal = corporationId
        const hexIdToReveal = hexId
        if (!corporationIdToReveal || !hexIdToReveal) {
            return
        }
        gameSession.secretAgentsReveal = {
            corporationId: corporationIdToReveal,
            hexId: hexIdToReveal
        }
        await gameSession.increaseAlienMiningCapacity()
        if (gameSession.lastActionError) {
            // The action didn't actually go through - drop the optimistic reveal immediately
            // rather than keep showing a flip that never happened.
            if (gameSession.secretAgentsReveal?.hexId === hexIdToReveal) {
                gameSession.secretAgentsReveal = undefined
            }
            return
        }
        setTimeout(() => {
            // Only clear if this is still the same reveal - a stale timer from an earlier choice
            // should never clobber a newer one.
            if (gameSession.secretAgentsReveal?.hexId === hexIdToReveal) {
                gameSession.secretAgentsReveal = undefined
            }
        }, REVEAL_DURATION_MS)
    }
    async function increaseAmethyst() {
        await gameSession.increaseAmethystMiningCapacity()
    }
</script>

{#if corporationId}
    <div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
        <div class="text-sm">
            {#if reveal}
                {#if presidentId}
                    <PlayerName playerId={presidentId} /> increased the Alien Corporation's Mining Capacity
                    for <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span>
                {:else}
                    <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span> increased
                    the Alien Corporation's Mining Capacity
                {/if}
            {:else if presidentId}
                <PlayerName playerId={presidentId} /> may increase Mining Capacity for
                <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span>
            {:else}
                <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span> may increase
                Mining Capacity
            {/if}
        </div>

        <div
            class="flex flex-wrap items-center gap-4 rounded-lg border border-[#2a3155] bg-[#12162b] p-3"
        >
            {#if secretAgentsImage}
                <img
                    src={secretAgentsImage}
                    alt="Secret Agents"
                    class="w-auto shrink-0 rounded-sm object-contain drop-shadow"
                    style="height: {PIECE_HEIGHT_PX}px; aspect-ratio: {POWER_CARD_ASPECT};"
                />
            {/if}
            {#key alienTileImage}
                <img
                    src={alienTileImage}
                    alt={reveal && chevrons !== undefined
                        ? `Alien Agreement Tile - ${chevrons} chevron${chevrons === 1 ? '' : 's'}`
                        : 'Alien Agreement Tile - hidden'}
                    title="Alien Agreement Tile"
                    class="h-16 w-16 shrink-0 rounded-sm object-contain drop-shadow {reveal
                        ? 'reveal-flip'
                        : ''}"
                />
            {/key}
            <div class="flex items-center gap-1.5 text-xs text-[#c3c9e6]">
                <img
                    src={alienMarker}
                    alt="Alien Corporation Mining Capacity"
                    class="h-6 w-auto drop-shadow"
                />
                {#if alienMiningCapacityGain > 0}
                    <span class="font-semibold text-[#3ddc84]">(+{alienMiningCapacityGain})</span>
                {:else}
                    <span>Flip for +3 per chevron</span>
                {/if}
            </div>
        </div>

        {#if reveal}
            <div class="text-xs text-[#7f88ad]">Continuing...</div>
        {:else if isMe && (canIncreaseAlien || canIncreaseAmethyst)}
            <div class="flex gap-2 pt-1">
                <button
                    type="button"
                    onclick={increaseAlien}
                    disabled={!canIncreaseAlien}
                    class="rounded-md bg-[#2f6fed] px-3 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Increase Alien
                </button>
                <button
                    type="button"
                    onclick={increaseAmethyst}
                    disabled={!canIncreaseAmethyst}
                    class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-3 py-1.5 text-xs font-semibold hover:bg-[#262c4d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Increase Amethyst (+3)
                </button>
            </div>
        {:else}
            <div class="text-xs text-[#7f88ad]">
                Waiting on {#if presidentId}<PlayerName playerId={presidentId} />{:else}the
                    President{/if}
                to decide how to increase Mining Capacity...
            </div>
        {/if}

        {#if gameSession.lastActionError}
            <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
        {/if}
    </div>
{/if}

<style>
    /* Same cheap card-flip approximation OfferSignTheAgreementPanel uses for its own tile/Power
       reveals - scale away to nothing and back, swapping src at the midpoint via the {#key}
       block's remount. */
    .reveal-flip {
        animation: reveal-flip 0.5s ease-in-out;
    }

    @keyframes reveal-flip {
        0% {
            transform: scaleX(1);
        }
        50% {
            transform: scaleX(0);
        }
        100% {
            transform: scaleX(1);
        }
    }
</style>
