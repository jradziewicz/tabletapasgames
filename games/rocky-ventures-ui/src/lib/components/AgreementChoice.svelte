<script lang="ts">
    import { ChooseAgreementGemCost, type AgreementLetter, type DeliveryCityId } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { agreementImageUrl, agreementTooltip } from '$lib/utils/agreementImages.js'
    import gemIcon from '$lib/images/icons/gem.png'

    // Buying an agreement card: take the top agreement for free, or pay a gem to take any other.
    let { slotIndex, cityId }: { slotIndex: number; cityId: DeliveryCityId } = $props()
    const gameSession = getGameSession()
    const pile = $derived(gameSession.gameState.agreementStacks[cityId] ?? [])
    const cityName = $derived(cityId === 'dornoch' ? 'Dornoch' : 'Manor')

    function choose(letter: AgreementLetter, index: number) {
        void gameSession.investWithAgreement(slotIndex, index === 0 ? undefined : letter)
    }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
    <div class="max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-xl border-2 border-[#c9a961] bg-[#1a120b] p-4 text-[#f1e6cf] shadow-2xl">
        <h2 class="text-lg font-semibold">Choose a {cityName} agreement</h2>
        <p class="mt-1 text-sm text-[#c9a961]">
            The top one is free. Any other costs
            <span class="inline-flex items-center gap-0.5 font-semibold">{ChooseAgreementGemCost} <img src={gemIcon} alt="gem" class="h-3.5 w-auto" /></span>.
        </p>
        <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {#each pile as letter, index (letter)}
                {@const url = agreementImageUrl(cityId, letter)}
                <button
                    type="button"
                    class="rv-lift flex flex-col items-center gap-1 rounded-lg border-2 p-1 text-sm font-semibold"
                    style="border-color: {index === 0 ? '#3ddc84' : '#8a6d3b'};"
                    title={agreementTooltip(cityId, letter)}
                    onclick={() => choose(letter, index)}
                >
                    {#if url}<img src={url} alt="{cityName} agreement {letter}" class="block h-auto w-full rounded" draggable="false" />{/if}
                    {#if index === 0}
                        <span class="text-[#7ee2a2]">Top · free</span>
                    {:else}
                        <span class="flex items-center gap-1 text-[#ffd166]">{ChooseAgreementGemCost} <img src={gemIcon} alt="gem" class="h-3.5 w-auto" /></span>
                    {/if}
                </button>
            {/each}
        </div>
        <div class="mt-3 flex justify-end">
            <button type="button" class="rv-quiet text-sm" onclick={() => (gameSession.agreementPick = undefined)}>Cancel</button>
        </div>
    </div>
</div>
