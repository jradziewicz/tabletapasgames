<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, CorporatePowerId, taxAgentsTaxBoxTakeAmount } from '@tabletop/stellar-ventures'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import {
        activePowerCardImageForSide,
        POWER_CARD_ASPECT
    } from '$lib/utils/corporatePowerImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CreditsText from './CreditsText.svelte'

    const gameSession = getGameSession()

    const corporationId = $derived(gameSession.gameState.taxAgentsCorporationId)
    const presidentId = $derived(
        corporationId
            ? gameSession.gameState.getCorporation(corporationId).getPresidentPlayerId()
            : undefined
    )
    const takeAmount = $derived(taxAgentsTaxBoxTakeAmount(gameSession.gameState))
    const canForceTax = $derived(gameSession.validActionTypes.includes(ActionType.TaxAgentsForceTax))
    const canTake = $derived(
        gameSession.validActionTypes.includes(ActionType.TaxAgentsTakeFromTaxBox)
    )
    const taxAgentsImage = $derived(
        corporationId
            ? activePowerCardImageForSide(corporationId, CorporatePowerId.TaxAgents, 'front')
            : undefined
    )
</script>

{#if corporationId}
    <div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
        <div class="text-sm">
            {#if presidentId}
                <PlayerName playerId={presidentId} /> may use Tax Agents for
            {/if}
            <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span>
        </div>
        <div
            class="flex flex-wrap items-center gap-4 rounded-lg border border-[#2a3155] bg-[#12162b] p-3"
        >
            {#if taxAgentsImage}
                <img
                    src={taxAgentsImage}
                    alt="Tax Agents"
                    class="h-[107px] w-auto shrink-0 rounded-sm object-contain drop-shadow"
                    style="aspect-ratio: {POWER_CARD_ASPECT};"
                />
            {/if}
            <div class="flex flex-col gap-2">
                {#if canForceTax || canTake}
                    {#if canForceTax}
                        <button
                            type="button"
                            onclick={() => gameSession.taxAgentsForceTax()}
                            class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-3 py-1.5 text-left text-sm hover:border-[#2f6fed] hover:bg-[#212845]"
                        >
                            Corporations Present pay Tax
                        </button>
                    {/if}
                    {#if canTake}
                        <button
                            type="button"
                            onclick={() => gameSession.taxAgentsTakeFromTaxBox()}
                            class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-3 py-1.5 text-left text-sm hover:border-[#2f6fed] hover:bg-[#212845]"
                        >
                            Take <CreditsText text={`₮${takeAmount}`} /> from the Tax Box
                        </button>
                    {/if}
                {:else}
                    <div class="text-xs text-[#7f88ad]">Waiting for the President to choose...</div>
                {/if}
            </div>
        </div>
    </div>
{/if}
