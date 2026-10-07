<script lang="ts">
    import { CorporationId } from '@tabletop/stellar-ventures'
    import { ScalingWrapper } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationDisplayNames,
        CorporationLogoIcons,
        CorporationLogoAspect,
        CHARTER_ASPECT
    } from '$lib/utils/corporationDisplay.js'
    import CorporationCharterWithPowers from './CorporationCharterWithPowers.svelte'
    import {
        CHARTER_EDGE_TOP_PCT,
        CHARTER_NOTCH_CARD_HEIGHT_PCT_OF_CHARTER,
        CHARTER_NOTCH_SLOTS
    } from '$lib/utils/charterLayout.js'

    const gameSession = getGameSession()

    // Natural (unzoomed) width of the Charter art inside the ScalingWrapper.
    const CHARTER_BASE_WIDTH_PX = 1000

    // Fixed display order (matches CorporationOutpostIcons/CorporationLogoIcons' own page
    // order) rather than gameState.corporations' array order, so the picker's layout never
    // shuffles between games.
    const DISPLAY_ORDER: CorporationId[] = [
        CorporationId.PinkInc,
        CorporationId.FrostFederated,
        CorporationId.ScarletSyndicate,
        CorporationId.CeruleanCouncil,
        CorporationId.GambogeGuild,
        CorporationId.AmethystAgency
    ]

    const corporationsById = $derived(
        new Map(gameSession.gameState.corporations.map((corporation) => [corporation.id, corporation]))
    )

    // Defaults to whichever Corporation is currently taking its turn, if any - otherwise the
    // first one - rather than always opening on the same Corporation regardless of game state.
    let selectedId: CorporationId = $state(
        gameSession.gameState.activeCorporationId ?? DISPLAY_ORDER[0]!
    )

    // Held Power cards hang off the Charter's bottom edge (absolutely positioned, see
    // CorporationCharterWithPowers), so they add no height of their own. Without this padding the
    // ScalingWrapper fit only the Charter box and the cards were cut off below it.
    const powerOverhangPx = $derived.by(() => {
        const powerCount = corporationsById.get(selectedId)?.powers.length ?? 0
        if (powerCount === 0) return 0
        const rows = Math.ceil(powerCount / CHARTER_NOTCH_SLOTS.length)
        const bottomPct = CHARTER_EDGE_TOP_PCT + rows * CHARTER_NOTCH_CARD_HEIGHT_PCT_OF_CHARTER
        const charterHeightPx = CHARTER_BASE_WIDTH_PX / CHARTER_ASPECT
        return Math.max(0, ((bottomPct - 100) / 100) * charterHeightPx)
    })

    function isFormed(id: CorporationId): boolean {
        return corporationsById.get(id)?.active ?? false
    }

</script>

<div class="flex h-full flex-col p-4 text-[#e6e9f5]">
    <h2 class="mb-3 shrink-0 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        Corporation Charter
    </h2>

    <div class="mb-3 flex shrink-0 flex-wrap gap-1.5">
        {#each DISPLAY_ORDER as corporationId (corporationId)}
            {@const aspect = CorporationLogoAspect[corporationId] ?? 1}
            {@const formed = isFormed(corporationId)}
            <button
                type="button"
                onclick={() => (selectedId = corporationId)}
                class="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs {selectedId ===
                corporationId
                    ? 'border-[#2f6fed] bg-[#212845] text-white'
                    : 'border-[#3a4166] bg-[#1a1f38] text-[#a8afd1] hover:bg-[#212845]'} {formed
                    ? ''
                    : 'opacity-50'}"
            >
                <img
                    src={CorporationLogoIcons[corporationId]}
                    alt=""
                    class="h-4 shrink-0 drop-shadow"
                    style="width: {16 * aspect}px;"
                />
                {CorporationDisplayNames[corporationId]}
                {#if !formed}
                    <span class="text-[10px] text-[#7f88ad]">(not yet formed)</span>
                {/if}
            </button>
        {/each}
    </div>

    <!-- The Charter art sits in the shared ScalingWrapper (same pan/zoom the Board tab uses):
         it starts fit to the panel, then zooms with the bottom-left buttons / wheel / pinch and
         pans by dragging. The art itself is all percentage-positioned, so the fixed base width
         below only sets how sharp it stays when zoomed in - the wrapper scales it to fit. -->
    <div class="min-h-0 flex-1">
        <ScalingWrapper justify="center" controls="bottom-left" dragToPan expandable>
            <div style="padding-bottom: {powerOverhangPx}px;">
                <div class="relative" style="width: {CHARTER_BASE_WIDTH_PX}px; aspect-ratio: {CHARTER_ASPECT};">
                    <CorporationCharterWithPowers corporationId={selectedId} />
                </div>
            </div>
        </ScalingWrapper>
    </div>
</div>
