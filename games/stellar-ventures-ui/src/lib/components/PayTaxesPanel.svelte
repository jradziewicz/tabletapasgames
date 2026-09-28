<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, taxDueForCorporation, taxLoanHexesNeeded } from '@tabletop/stellar-ventures'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CreditsText from './CreditsText.svelte'

    const gameSession = getGameSession()

    const corporationId = $derived(gameSession.gameState.taxPayerCorporationIds?.[0])
    const corporation = $derived(
        corporationId ? gameSession.gameState.getCorporation(corporationId) : undefined
    )
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const taxDue = $derived(
        corporationId ? taxDueForCorporation(gameSession.gameState, corporationId) : 0
    )
    const hexesNeeded = $derived(
        corporationId ? taxLoanHexesNeeded(gameSession.gameState, corporationId) : 0
    )
    const canPay = $derived(gameSession.validActionTypes.includes(ActionType.PayTax))
    const selectedCount = $derived(gameSession.taxLoanHexIds.length)
</script>

{#if corporationId && corporation}
    <div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
        <div class="text-sm">
            <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span> owes
            <CreditsText text={`₮${taxDue}`} /> in Taxes but only has
            <CreditsText text={`₮${corporation.treasury}`} />.
        </div>
        {#if canPay}
            <div class="space-y-2 rounded-md border border-[#3a4166] bg-[#141833] p-2 text-xs">
                <div>
                    Pick {hexesNeeded} of your Outposts on the map to send to the Loans box ({selectedCount}/{hexesNeeded}
                    selected).
                </div>
                <button
                    type="button"
                    disabled={selectedCount !== hexesNeeded}
                    onclick={() => gameSession.payTax(gameSession.taxLoanHexIds)}
                    class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845] disabled:opacity-50"
                >
                    Take Loans and Pay Taxes
                </button>
            </div>
        {:else if presidentId}
            <div class="text-xs text-[#7f88ad]">
                Waiting for <PlayerName playerId={presidentId} /> to choose Outposts for Loans...
            </div>
        {/if}
    </div>
{/if}
