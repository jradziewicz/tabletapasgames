<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        type CorporationId,
        CorporationStatus,
        OutpostSupplyByCorporationId,
        effectiveMiningCapacityForCorporation,
        dividendPayoutPerShare,
        AgreementTrackByPlanetCount,
        AgreementTrackMaxPlanets
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporatePowerDisplayNames, CorporatePowerDescriptions } from '$lib/utils/corporatePowerDisplay.js'
    import { CorporationAgreementTokenIcons } from '$lib/utils/corporationDisplay.js'
    import CreditsIcon from './CreditsIcon.svelte'
    import CreditsText from './CreditsText.svelte'

    // A full at-a-glance stat sheet for one Corporation - everything on its Charter plus the
    // live numbers that only exist in game state (Treasury, Mining Capacity, current Dividend
    // payout, etc.) - shown underneath the Charter art itself in the Charter tab
    // (CharterPanel.svelte). Deliberately a real <table>, not another card, since this is meant
    // to be scanned as a reference sheet rather than read as a sentence.
    let { corporationId }: { corporationId: CorporationId } = $props()

    const gameSession = getGameSession()
    const corporation = $derived(gameSession.gameState.getCorporation(corporationId))
    const presidentId = $derived(corporation.getPresidentPlayerId())

    const miningCapacity = $derived(
        effectiveMiningCapacityForCorporation(gameSession.gameState, corporationId)
    )
    const payoutPerShare = $derived(
        dividendPayoutPerShare(corporation.cargo, miningCapacity, corporation.status)
    )
    const outpostSupply = $derived(OutpostSupplyByCorporationId[corporationId])
    const outpostsBuilt = $derived(outpostSupply - corporation.unbuiltOutposts)

    function statusLabel(status: CorporationStatus) {
        switch (status) {
            case CorporationStatus.Major:
                return 'Major'
            case CorporationStatus.Minor:
                return 'Minor'
            default:
                return 'Private'
        }
    }

    function shipLevelsLabel(levels: number[]) {
        if (levels.length === 0) return 'None'
        return levels
            .slice()
            .sort((a, b) => a - b)
            .map((level) => `L${level}`)
            .join(', ')
    }

    // Same hover-tooltip pattern PlayersPanel.svelte uses for its own Corporate Power badges.
    let hoveredPowerId: string | undefined = $state()
    let tooltipX: number | undefined = $state()
    let tooltipY: number | undefined = $state()

    function showPowerInfo(powerId: string, x: number, y: number) {
        hoveredPowerId = powerId
        tooltipX = x
        tooltipY = y
    }
    function hidePowerInfo() {
        hoveredPowerId = undefined
    }
</script>

<div class="overflow-hidden rounded-lg border border-[#2a3155] text-sm">
    <table class="w-full border-collapse">
        <tbody>
            <tr class="border-b border-[#2a3155] bg-[#1b2242]">
                <th class="w-1/2 px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Status
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {statusLabel(corporation.status)}
                </td>
            </tr>
            <tr class="border-b border-[#2a3155]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    President
                </th>
                <td class="px-3 py-1.5 text-right font-semibold text-[#8fe0a8]">
                    {#if presidentId}
                        <PlayerName playerId={presidentId} />
                    {:else}
                        <span class="text-[#7f88ad]">None</span>
                    {/if}
                </td>
            </tr>
            <tr class="border-b border-[#2a3155] bg-[#161b38]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Treasury
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    <CreditsIcon />{corporation.treasury}
                </td>
            </tr>
            <tr class="border-b border-[#2a3155]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Shares
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {corporation.issuedShareCount} issued / {corporation.availableShareCount} available
                </td>
            </tr>
            <tr class="border-b border-[#2a3155] bg-[#161b38]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Cargo
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {corporation.cargo}
                </td>
            </tr>
            <tr class="border-b border-[#2a3155]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Mining Capacity
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {miningCapacity}
                </td>
            </tr>
            <tr class="border-b border-[#2a3155] bg-[#161b38]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Current Payout
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    <CreditsIcon />{payoutPerShare}
                </td>
            </tr>
            <tr class="border-b border-[#2a3155]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Agreement
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {#if corporation.agreement}
                        Signed at {corporation.agreement.planetCountAtSigning} Planets (<CreditsIcon />{AgreementTrackByPlanetCount[
                            Math.min(corporation.agreement.planetCountAtSigning, AgreementTrackMaxPlanets)
                        ]!.bonusDividendPerShare} Bonus Dividend)
                    {:else if CorporationAgreementTokenIcons[corporationId]}
                        <!-- Same colored handshake token as the Agreement tab - disappears once
                             this Corporation signs (the branch above takes over). -->
                        <img
                            src={CorporationAgreementTokenIcons[corporationId]}
                            alt="Has not signed The Agreement"
                            title="Has not signed The Agreement"
                            class="ml-auto h-7 w-auto drop-shadow"
                        />
                    {:else}
                        <span class="text-[10px] font-normal text-[#7f88ad]">Cannot sign The Agreement</span>
                    {/if}
                </td>
            </tr>
            <tr class="border-b border-[#2a3155] bg-[#161b38]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Loans
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {corporation.loanCount}
                </td>
            </tr>
            <tr class="border-b border-[#2a3155]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Outposts
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {outpostsBuilt} built / {outpostSupply} total
                </td>
            </tr>
            <tr class="border-b border-[#2a3155] bg-[#161b38]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Ordered Ships
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {shipLevelsLabel(corporation.orderedShipLevels)}
                </td>
            </tr>
            <tr class="border-b border-[#2a3155]">
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Delivered Ships
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {shipLevelsLabel(corporation.deliveredShipLevels)}
                </td>
            </tr>
            <tr class={corporation.powers.length > 0 ? 'border-b border-[#2a3155] bg-[#161b38]' : 'bg-[#161b38]'}>
                <th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                    Wormhole Active
                </th>
                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#e6e9f5]">
                    {corporation.wormholeActive ? 'Yes' : 'No'}
                </td>
            </tr>
            {#if corporation.powers.length > 0}
                <tr>
                    <th class="px-3 py-1.5 text-left align-top text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                        Active Powers
                    </th>
                    <td class="px-3 py-1.5 text-right">
                        <div class="flex flex-wrap justify-end gap-1">
                            {#each corporation.powers as power (power.id)}
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <span
                                    class="cursor-help rounded border border-[#3a4166] bg-[#1a1f38] px-1.5 py-0.5 text-[10px] font-semibold text-[#a8afd1]"
                                    onmouseenter={(e) => showPowerInfo(power.id, e.clientX, e.clientY)}
                                    onmousemove={(e) => showPowerInfo(power.id, e.clientX, e.clientY)}
                                    onmouseleave={hidePowerInfo}
                                >
                                    {CorporatePowerDisplayNames[power.id] ?? power.id}
                                </span>
                            {/each}
                        </div>
                    </td>
                </tr>
            {/if}
        </tbody>
    </table>
</div>

{#if hoveredPowerId}
    <div
        class="pointer-events-none fixed z-30 w-max max-w-[240px] -translate-x-1/2 -translate-y-full rounded-md border border-[#3a4166] bg-[#10142a] px-2.5 py-1.5 text-xs shadow-lg"
        style="left: {tooltipX}px; top: {(tooltipY ?? 0) - 12}px;"
    >
        <div class="font-semibold text-[#e6e9f5]">
            {CorporatePowerDisplayNames[hoveredPowerId] ?? hoveredPowerId}
        </div>
        <div class="mt-1 text-[#c3c9e6]">
            <CreditsText text={CorporatePowerDescriptions[hoveredPowerId] ?? ''} />
        </div>
    </div>
{/if}
