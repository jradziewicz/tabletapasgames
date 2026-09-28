<script lang="ts">
    import { DividendPayoutTable, MAX_DIVIDEND_ROW, CorporationStatus } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import { describeGamePhase, formatGamePhase } from '$lib/utils/phaseLabel.js'
    import CreditsIcon from './CreditsIcon.svelte'

    const gameSession = getGameSession()

    const era = $derived(gameSession.gameState.era)
    const turnOrder = $derived(gameSession.gameState.corporationTurnOrder)
    const activeIndex = $derived(gameSession.gameState.activeCorporationIndex)
    const phaseText = $derived(formatGamePhase(describeGamePhase(gameSession.gameState)))

    const rows = Array.from({ length: MAX_DIVIDEND_ROW + 1 }, (_, row) => row)
</script>

<div class="h-full overflow-y-auto p-4 text-[#e6e9f5]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        Corporation Status &amp; Round Track
    </h2>

    <div class="mb-4 rounded-lg border border-[#3a4166] bg-[#1a1f38] px-3 py-2 text-sm">
        <div class="font-semibold">Era {era} - {phaseText}</div>
        <div class="mt-2 flex flex-wrap gap-1.5">
            {#each turnOrder as corporationId, index (corporationId)}
                <span
                    class="rounded-md border px-2 py-1 text-xs {index === activeIndex
                        ? 'border-[#2f6fed] bg-[#212845] font-semibold text-white'
                        : 'border-[#3a4166] bg-[#10142a] text-[#a8afd1]'}"
                >
                    {CorporationDisplayNames[corporationId]}
                </span>
            {/each}
        </div>
    </div>

    <h3 class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        Dividend Payout Table
    </h3>
    <p class="mb-2 text-xs text-[#7f88ad]">
        Row = the lower of a Corporation's Cargo row and Mining Capacity row. Column = its current
        Status. (See each Corporation's own Payout line in the Players sidebar for its live row.)
    </p>
    <table class="w-full border-collapse text-xs">
        <thead>
            <tr class="text-[#7f88ad]">
                <th class="border-b border-[#3a4166] px-2 py-1 text-left">Row</th>
                <th class="border-b border-[#3a4166] px-2 py-1 text-right">Private</th>
                <th class="border-b border-[#3a4166] px-2 py-1 text-right">Minor</th>
                <th class="border-b border-[#3a4166] px-2 py-1 text-right">Major</th>
            </tr>
        </thead>
        <tbody>
            {#each rows as row (row)}
                <tr class="odd:bg-black/20">
                    <td class="px-2 py-1 text-[#7f88ad]">{row === MAX_DIVIDEND_ROW ? '13+' : row}</td>
                    <td class="px-2 py-1 text-right font-mono">
                        <CreditsIcon />{DividendPayoutTable[row]![CorporationStatus.Private]}
                    </td>
                    <td class="px-2 py-1 text-right font-mono">
                        <CreditsIcon />{DividendPayoutTable[row]![CorporationStatus.Minor]}
                    </td>
                    <td class="px-2 py-1 text-right font-mono">
                        <CreditsIcon />{DividendPayoutTable[row]![CorporationStatus.Major]}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
