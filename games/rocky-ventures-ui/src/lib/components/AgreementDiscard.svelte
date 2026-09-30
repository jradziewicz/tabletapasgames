<script lang="ts">
    import { CompanyIds, CompanyNames, buildableBoxes } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { agreementImageUrl, agreementTooltip } from '$lib/utils/agreementImages.js'
    import { CompanyColors, CompanyTextColors } from '$lib/utils/companyDisplay.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const activeId = $derived(gameState.activePlayerIds[0])
    const player = $derived(activeId ? gameState.getPlayerState(activeId) : undefined)
    const pick = $derived(gameSession.discardPick)
</script>

{#if player && player.agreements.length > 0}
    <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {#if pick === undefined}
            {#each player.agreements as agreement (`${agreement.cityId}-${agreement.letter}`)}
                {@const url = agreementImageUrl(agreement.cityId, agreement.letter)}
                <button
                    type="button"
                    onclick={() => (gameSession.discardPick = { cityId: agreement.cityId, letter: agreement.letter })}
                    class="block overflow-hidden rounded border-2 border-[#8a6d3b] hover:border-[#ffd166]"
                    title="Discard for 2 free track — {agreementTooltip(agreement.cityId, agreement.letter)}"
                >
                    {#if url}
                        <img src={url} alt="{agreement.cityId} {agreement.letter}" class="block h-[56px] w-auto" draggable="false" />
                    {:else}
                        <span class="px-2 py-1">{agreement.cityId} {agreement.letter}</span>
                    {/if}
                </button>
            {/each}
        {:else}
            {@const url = agreementImageUrl(pick.cityId, pick.letter)}
            {#if url}
                <img src={url} title={agreementTooltip(pick.cityId, pick.letter)} alt="{pick.cityId} {pick.letter}" class="block h-[56px] w-auto rounded border-2 border-[#ffd166]" draggable="false" />
            {/if}
            {#each CompanyIds as companyId (companyId)}
                {@const options = buildableBoxes(gameState, companyId, true).length}
                <button
                    type="button"
                    disabled={options === 0}
                    onclick={() => gameSession.discardAgreement(companyId)}
                    class="rv-lift border-2 border-transparent px-2 py-1 font-semibold disabled:opacity-40"
                    style="background-color: {CompanyColors[companyId]}; color: {CompanyTextColors[companyId]};"
                >
                    {CompanyNames[companyId]}
                </button>
            {/each}
            <button
                type="button"
                onclick={() => (gameSession.discardPick = undefined)}
                class="rv-quiet"
            >
                Back
            </button>
        {/if}
    </div>
{/if}
