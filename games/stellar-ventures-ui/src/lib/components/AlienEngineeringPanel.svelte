<script lang="ts">
    import {
        ActionType,
        CorporatePowerId,
        type CorporationId
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import { CorporatePowerBackImages, POWER_CARD_ASPECT } from '$lib/utils/corporatePowerImages.js'
    import { CorporationDisplayNames, CorporationLogoIcons, CorporationLogoAspect } from '$lib/utils/corporationDisplay.js'

    // Alien Engineering (Corporate Power Glossary, page 29): "Investor Round, Ongoing. President
    // may reclaim any number of Technology Cubes from the Charter as a free action; the
    // Corporation immediately loses Cargo Boost and/or Wormhole access." Per the co-designer,
    // offered during BOTH halves of this player's Investor Shenanigans turn (their Investor
    // Action and their Alien Tech Action - see actions/alienEngineering.ts,
    // stateHandlers/investorAction.ts and stateHandlers/alienTechAction.ts), so this one
    // component is embedded in both InvestorActionPanel.svelte and AlienTechActionPanel.svelte
    // rather than duplicated. Clicking "Alien Engineering" brings up the Power Tile plus a
    // Corporation picker (every Corporation this player presides over that still holds the
    // power and has something left to reclaim); clicking a Corporation then presents whichever
    // of "Deactivate 1 CARGO" / "Deactivate 2 CARGO" / "Deactivate Wormhole" are actually legal
    // for it - each submits immediately, same as Cargo Boost/Launder's own "Spend N" buttons.
    const gameSession = getGameSession()

    const currentPlayerId = $derived(gameSession.gameState.investorShenanigansCurrentPlayerId)

    const canOffer = $derived(gameSession.validActionTypes.includes(ActionType.AlienEngineering))

    const eligibleCorporations = $derived.by(() => {
        if (!currentPlayerId) return []
        return gameSession.gameState.corporations.filter(
            (corporation) =>
                corporation.getPresidentPlayerId() === currentPlayerId &&
                corporation.hasActivePower(CorporatePowerId.AlienEngineering) &&
                ((corporation.cargoBoostCubesOnCharter ?? 0) > 0 || corporation.wormholeActive)
        )
    })

    let opening = $state(false)
    let selectedCorporationId: CorporationId | undefined = $state()

    const selectedCorporation = $derived(
        selectedCorporationId ? gameSession.gameState.getCorporation(selectedCorporationId) : undefined
    )

    // Leaving this mode (offering stops - e.g. every reclaimable cube/Wormhole on every
    // Corporation this player presides over is gone) drops the card rather than leaving it stuck
    // open on an action that can no longer be submitted.
    $effect(() => {
        if (opening && !canOffer) {
            opening = false
            selectedCorporationId = undefined
        }
    })

    function open() {
        opening = true
        selectedCorporationId = undefined
    }

    function cancel() {
        opening = false
        selectedCorporationId = undefined
    }

    function chooseCorporation(corporationId: CorporationId) {
        selectedCorporationId = corporationId
    }

    function backToCorporations() {
        selectedCorporationId = undefined
    }

    async function reclaim(cargoBoostCubesToReclaim: number, reclaimWormhole: boolean) {
        if (!selectedCorporationId) return
        const corporationId = selectedCorporationId
        opening = false
        selectedCorporationId = undefined
        await gameSession.alienEngineering(corporationId, cargoBoostCubesToReclaim, reclaimWormhole)
    }
</script>

{#if canOffer && !opening}
    <div class="flex items-center gap-2">
        <button
            type="button"
            onclick={open}
            class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1.5 text-xs font-semibold hover:border-[#2f6fed] hover:bg-[#212845]"
        >
            Alien Engineering
        </button>
    </div>
{/if}

{#if opening}
    <div class="space-y-2 rounded-md border border-[#3a4166] bg-[#141833] p-3">
        <div class="mx-auto flex w-[10.35rem] flex-col items-center gap-2">
            <img
                src={CorporatePowerBackImages[CorporatePowerId.AlienEngineering] ?? ''}
                alt={CorporatePowerDisplayNames[CorporatePowerId.AlienEngineering]}
                class="block w-full rounded-md shadow-lg"
                style="aspect-ratio: {POWER_CARD_ASPECT};"
            />
        </div>

        {#if !selectedCorporation}
            <div class="text-xs font-semibold">Reclaim Alien Technology Cubes from:</div>
            <div class="flex flex-wrap gap-2">
                {#each eligibleCorporations as corporation (corporation.id)}
                    <button
                        type="button"
                        onclick={() => chooseCorporation(corporation.id)}
                        class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#2a3155] bg-[#12162b] px-2.5 py-1.5 text-left transition hover:brightness-110"
                    >
                        <img
                            src={CorporationLogoIcons[corporation.id]}
                            alt=""
                            class="h-8 shrink-0 drop-shadow"
                            style="width: {32 * (CorporationLogoAspect[corporation.id] ?? 1)}px;"
                        />
                        <div class="text-sm font-semibold text-[#e6e9f5]">
                            {CorporationDisplayNames[corporation.id]}
                        </div>
                    </button>
                {/each}
                {#if eligibleCorporations.length === 0}
                    <div class="text-xs text-[#7f88ad]">No eligible Corporations.</div>
                {/if}
            </div>
            <button
                type="button"
                onclick={cancel}
                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-3 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
            >
                Cancel
            </button>
        {:else}
            <div class="text-xs font-semibold">
                Deactivate for {CorporationDisplayNames[selectedCorporation.id]}:
            </div>
            <div class="flex flex-wrap gap-1.5">
                {#if (selectedCorporation.cargoBoostCubesOnCharter ?? 0) >= 1}
                    <button
                        type="button"
                        onclick={() => reclaim(1, false)}
                        class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa]"
                    >
                        Deactivate 1 CARGO
                    </button>
                {/if}
                {#if (selectedCorporation.cargoBoostCubesOnCharter ?? 0) >= 2}
                    <button
                        type="button"
                        onclick={() => reclaim(2, false)}
                        class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa]"
                    >
                        Deactivate 2 CARGO
                    </button>
                {/if}
                {#if selectedCorporation.wormholeActive}
                    <button
                        type="button"
                        onclick={() => reclaim(0, true)}
                        class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa]"
                    >
                        Deactivate Wormhole
                    </button>
                {/if}
            </div>
            <div class="flex gap-1.5">
                <button
                    type="button"
                    onclick={backToCorporations}
                    class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-3 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
                >
                    Back
                </button>
                <button
                    type="button"
                    onclick={cancel}
                    class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-3 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
                >
                    Cancel
                </button>
            </div>
        {/if}

        {#if gameSession.lastActionError}
            <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
        {/if}
    </div>
{/if}
