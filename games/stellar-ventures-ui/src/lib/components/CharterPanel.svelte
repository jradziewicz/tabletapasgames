<script lang="ts">
    import { CorporationId } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationDisplayNames,
        CorporationLogoIcons,
        CorporationLogoAspect,
        CHARTER_ASPECT
    } from '$lib/utils/corporationDisplay.js'
    import CorporationCharterWithPowers from './CorporationCharterWithPowers.svelte'

    const gameSession = getGameSession()

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

    function isFormed(id: CorporationId): boolean {
        return corporationsById.get(id)?.active ?? false
    }

</script>

<div class="h-full overflow-y-auto p-4 text-[#e6e9f5]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        Corporation Charter
    </h2>

    <div class="mb-3 flex flex-wrap gap-1.5">
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

    <!-- Just the Charter art now - the stats table that used to sit beside it is gone (no
         longer needed per the co-designer), so this no longer needs a flex row splitting width
         between the two. -->
    <!-- Phones: near full width so the Charter art is legible; desktop keeps 45% (25% smaller than the prior 60%). -->
    <div class="mx-auto w-[92%] md:w-[45%]">
        <div class="relative" style="aspect-ratio: {CHARTER_ASPECT};">
            <CorporationCharterWithPowers corporationId={selectedId} />
        </div>
    </div>
</div>
