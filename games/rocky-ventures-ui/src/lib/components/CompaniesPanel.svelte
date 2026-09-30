<script lang="ts">
    import { CompanyAbbreviations, CompanyNames, SharesPerCompany } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CompanyColors, CompanyTextColors } from '$lib/utils/companyDisplay.js'

    const gameSession = getGameSession()
    const companies = $derived(gameSession.gameState.companies)
</script>

<div class="rounded-lg border border-[#c9a961] bg-[#2a1d12] p-2 text-[#f1e6cf] shrink-0 w-[300px]">
    <div class="font-semibold mb-1">Railroads</div>
    <table class="w-full text-xs">
        <thead class="text-[#c9a961]">
            <tr>
                <th class="text-left">Company</th>
                <th>Value</th>
                <th>Track</th>
                <th>Deliv.</th>
                <th>$</th>
                <th>Shares</th>
            </tr>
        </thead>
        <tbody>
            {#each companies as company (company.id)}
                <tr>
                    <td class="py-0.5">
                        <span
                            class="inline-block rounded px-1 font-bold"
                            style="background:{CompanyColors[company.id]};color:{CompanyTextColors[company.id]}"
                            title={CompanyNames[company.id]}>{CompanyAbbreviations[company.id]}</span
                        >
                    </td>
                    <td class="text-center font-semibold">{company.value}</td>
                    <td class="text-center">{company.cubesOnMap}</td>
                    <td class="text-center">{company.deliveryValue}</td>
                    <td class="text-center">{company.treasury}</td>
                    <td class="text-center">{company.sharesRemaining}/{SharesPerCompany}{company.sharesFlipped ? ' ↓' : ''}</td>
                </tr>
            {/each}
        </tbody>
    </table>
    <div class="text-[10px] text-[#c9a961] mt-1">
        Dragon tracker: {gameSession.gameState.dragon.trackerTokens.length}/6 · Gems spent: {gameSession.gameState.gemsSpent}
    </div>
</div>
