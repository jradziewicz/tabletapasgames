<script lang="ts">
    import {
        CompanyNames,
        DornochDurConnectionBonus,
        MaxCubesPerCompany,
        ShareFlipTriggerIndex
    } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CompanyColors, CompanyTextColors } from '$lib/utils/companyDisplay.js'
    import { companyLogoUrl } from '$lib/utils/companyLogos.js'

    // One box per railroad, styled like the player boxes above (and Stellar Ventures' sidebar):
    // a header painted in the railroad's colour with its logo, then its value and supply.
    const gameSession = getGameSession()
    const companies = $derived(gameSession.gameState.companies)
</script>

<div class="space-y-2 px-2 pb-2 text-left">
    <h2 class="mb-1 px-1 text-xs font-semibold uppercase tracking-widest" style="color: #7f88ad;">Railroads</h2>
    {#each companies as company (company.id)}
        {@const logo = companyLogoUrl(company.id)}
        {@const topMultiplier = company.sharesRemaining > 0 ? company.multiplierForShare(company.nextShareIndex) : undefined}
        {@const flipsShares = company.nextShareIndex === ShareFlipTriggerIndex && !company.sharesFlipped}
        <div class="overflow-hidden rounded-lg border text-sm" style="background-color: #12162b; color: #e6e9f5; border-color: #2a3155;">
            <div
                class="flex items-center justify-between gap-2 px-3 py-1.5"
                style="background-color: {CompanyColors[company.id]}; color: {CompanyTextColors[company.id]};"
            >
                <div class="flex min-w-0 items-center gap-2 font-semibold">
                    {#if logo}
                        <img src={logo} alt="" class="h-7 w-7 shrink-0 rounded-full" draggable="false" />
                    {/if}
                    <span class="truncate">{CompanyNames[company.id]}</span>
                </div>
                <span
                    class="shrink-0 rounded-full border border-current bg-black/15 px-2 py-0.5 text-[11px] font-semibold"
                    title={topMultiplier === undefined
                        ? 'No shares left'
                        : `Next share bought is worth ${topMultiplier}x the railroad's value${flipsShares ? ', and buying it flips the shares already sold to their backs' : ''}`}
                >
                    {#if topMultiplier === undefined}
                        Sold out
                    {:else}
                        Top share {topMultiplier}x{flipsShares ? ' (flip shares)' : ''}
                    {/if}
                </span>
            </div>
            <div class="flex border-b" style="border-color: #2a3155;">
                <div class="flex-1 px-3 py-1.5">
                    <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Track Value</div>
                    <div class="font-mono text-sm font-semibold">{company.trackValue}</div>
                </div>
                <div class="flex-1 border-l px-3 py-1.5" style="border-color: #2a3155;">
                    <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Deliveries</div>
                    <div class="font-mono text-sm font-semibold">{company.deliveryValue}</div>
                </div>
                <div class="flex-1 border-l px-3 py-1.5" style="border-color: #2a3155;">
                    <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Total Value</div>
                    <div
                        class="font-mono text-sm font-semibold"
                        title={company.connectedToDornochDur ? `Includes +${DornochDurConnectionBonus} for connecting to Dornoch Dur` : undefined}
                    >
                        {company.value}{company.connectedToDornochDur ? '*' : ''}
                    </div>
                </div>
            </div>
            <div class="flex">
                <div class="flex-1 px-3 py-1.5">
                    <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Money Left</div>
                    <div class="font-mono text-sm font-semibold">{`$${company.treasury}`}</div>
                </div>
                <div class="flex-1 border-l px-3 py-1.5" style="border-color: #2a3155;">
                    <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Cubes Left</div>
                    <div class="font-mono text-sm font-semibold">{MaxCubesPerCompany - company.cubesOnMap}</div>
                </div>
            </div>
        </div>
    {/each}
</div>
