<script lang="ts">
    import {
        CorporationId,
        agreementTrackEntryForPlanetCount,
        effectiveMiningCapacityForCorporation,
        hostileTakeoverApplies,
        shareValuePerShare,
        LoanPenaltyPerShare,
        AccountingGimmickTakeoverBonus,
        CorporatePowerId,
        totalCredits
    } from '@tabletop/stellar-ventures'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationDisplayNames,
        CorporationLogoIcons,
        CorporationLogoAspect
    } from '$lib/utils/corporationDisplay.js'
    import CreditsIcon from './CreditsIcon.svelte'

    // "Game Summary" (co-designer's own name for this) - a manually-opened, dismissible
    // breakdown of how each player's final Share Liquidation payout was computed: one tab per
    // player (rather than every player's table stacked vertically at once) so each table gets
    // the full width and can run at a bigger, easier-to-read font - per the co-designer's own
    // call ("a tab for each player, so that we can have the font be a bit larger"). Unlike
    // HostileTakeoverRevealOverlay this never auto-pops - it's opened from a button on
    // GameEndPanel (the "how was my score computed" ask-again case, not a one-time reveal), so
    // it takes open/onClose as plain props instead of deriving its own pending/dismissed state.
    //
    // Two view modes share the same underlying playerSummaries/activeSummary data (and the same
    // player tab strip), per the co-designer's own call for "two summary options":
    //   - Simple (viewMode 'simple', the default): a compact per-player card - Credits (what
    //     they had going into Liquidation) and Total Share Value (what Share Liquidation paid
    //     out) side by side, then one line per Corporation held showing Base Value / Bonus /
    //     Loans / Total - i.e. how each Corporation's Total Share Value broke down. No per-Share
    //     rows, no Cost/Private Contractor/Profit figures - purely "how was the share value
    //     itself calculated."
    //   - Detailed (viewMode 'detailed'): the original one-row-per-Corporation-plus-per-Share
    //     table, now focused on profit/loss instead of value composition - Share Cost, Private
    //     Contractor Costs, Dividends, Final Share Value, Total Profit, Profit Margin. Base
    //     Value/Bonus/Loans (how the value was built) live in the Simple view instead now.
    //
    // Cost, Dividends Received, and Private Contractor all depend on permanent fields added
    // specifically for this overlay - Share.pricePaid (set once at issuance, see
    // HydratedCorporationState.issueShareToPlayer), CorporationState.dividendsReceivedByPlayer
    // (a running total, see HydratedCorporationState.addDividendReceived), and
    // CorporationState.privateContractorExpenseByPlayer (a running total, see
    // HydratedCorporationState.addPrivateContractorExpense) - none of which existed before this
    // feature (or its Private Contractor column) shipped. Per the co-designer's own explicit
    // call: games already in progress when this ships simply show 0 for those columns (all three
    // fields are optional/undefined-as-0 everywhere they're read) rather than attempting to
    // reconstruct history that was never recorded. Base Share Value / Agreement Bonus / Loan
    // Penalty / Total Share Value need no such fallback - they're recomputed live from permanent
    // Corporation state the same way operations/liquidation.ts always has been.
    //
    // Total Profit is a derived summary column, not its own tracked field: Dividends Received +
    // Final Share Value (what came back to the player) minus Share Cost + Private Contractor
    // Costs (what the player put in) - computed identically at the per-Share, per-Corporation,
    // and Total row level so the per-Share sub-rows always sum back to the Corporation-level
    // figure above them. Profit Margin is Total Profit divided by that same "what the player put
    // in" figure (Share Cost + Private Contractor Costs) - undefined (rendered "—") rather than
    // Infinity/NaN when that denominator is 0, e.g. Shares that were never bought for a price
    // (older games missing Share.pricePaid) or a Corporation with no Private Contractor expense
    // at all.
    let { open, onClose }: { open: boolean; onClose: () => void } = $props()

    const gameSession = getGameSession()

    let viewMode = $state<'simple' | 'detailed'>('simple')

    const activeCorporations = $derived(
        gameSession.gameState.corporations.filter((corporation) => corporation.active)
    )

    const alienMiningCapacity = $derived(gameSession.gameState.alienCorporation.miningCapacity)

    // Dividends Received and Private Contractor are only ever tracked as a single running total
    // per player per Corporation (PayDividends pays every Share of a Corporation identically, and
    // Private Contractor is a personal Investor expense that isn't tied to any one Share either),
    // so there's no real per-Share record to show for either one. splitEvenly divides that total
    // as evenly as whole Credits allow - handing the remainder to the first few Shares - so the
    // per-Share sub-rows always sum back to exactly the Corporation-level total shown above them,
    // never off by a rounding Credit.
    function splitEvenly(total: number, count: number): number[] {
        if (count <= 0) {
            return []
        }
        const base = Math.floor(total / count)
        const remainder = total - base * count
        return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
    }

    // See this file's own doc comment above - undefined (rather than Infinity/NaN) when nothing
    // was actually put in for that row.
    function profitMarginFor(totalProfitValue: number, totalCosts: number): number | undefined {
        return totalCosts === 0 ? undefined : totalProfitValue / totalCosts
    }

    function formatPercent(value: number | undefined): string {
        return value === undefined ? '—' : `${Math.round(value * 100)}%`
    }

    type ShareSummaryRow = {
        shareNumber: number
        cost: number
        dividendsReceived: number
        privateContractorExpense: number
        baseShareValue: number
        agreementBonus: number
        loanPenalty: number
        totalValue: number
        totalProfit: number
        profitMargin: number | undefined
    }

    type CorporationSummaryRow = {
        corporationId: CorporationId
        sharesHeld: number
        cost: number
        dividendsReceived: number
        privateContractorExpense: number
        baseShareValue: number
        agreementBonus: number
        loanPenalty: number
        totalValue: number
        totalProfit: number
        profitMargin: number | undefined
        hostileTakeover: boolean
        shares: ShareSummaryRow[]
    }

    type PlayerSummary = {
        playerId: string
        rows: CorporationSummaryRow[]
        totals: Omit<CorporationSummaryRow, 'corporationId' | 'hostileTakeover' | 'shares'>
        // Simple view only - see this file's own doc comment above. baseCredits is what the
        // player had going into Liquidation (backed out of totalCredits, which already includes
        // this Era's Share Liquidation proceeds - see operations/liquidation.ts's totalCredits),
        // and finalCredits is that same totalCredits figure, included here so the Simple view's
        // "Credits + Total Share Value = Final Total" line always ties out exactly to the
        // standings shown on GameEndPanel above it.
        baseCredits: number
        finalCredits: number
    }

    // Mirrors operations/liquidation.ts's own formulas exactly (corporateShareValuePerShare /
    // shareValuePerShare / hostileTakeoverApplies) rather than re-deriving them, so this overlay
    // can never drift out of sync with what Share Liquidation actually paid out. Total Value
    // always uses the real, floored, Hostile-Takeover-aware shareValuePerShare, matching Credits
    // actually received. Base Share Value and Agreement Bonus are the exception: per the
    // co-designer, a Hostile Takeover row shows a flat $1 Base Value / $0 Bonus instead of the
    // real (much larger, no-longer-meaningful) pre-takeover numbers - both at the Corporation
    // level and on every one of that Corporation's per-Share sub-rows, not divided or multiplied
    // any further.
    const playerSummaries = $derived.by((): PlayerSummary[] => {
        return gameSession.gameState.players.map((player) => {
            const rows: CorporationSummaryRow[] = []
            for (const corporation of activeCorporations) {
                const sharesHeld = corporation.shareCountForPlayer(player.playerId)
                if (sharesHeld === 0) {
                    continue
                }

                const playerShares = corporation.shares
                    .filter(
                        (share) =>
                            share.owner?.type === 'player' && share.owner.playerId === player.playerId
                    )
                    .sort((a, b) => (a.issuedSequence ?? 0) - (b.issuedSequence ?? 0))

                const cost = playerShares.reduce((sum, share) => sum + (share.pricePaid ?? 0), 0)
                const dividendsReceived =
                    corporation.dividendsReceivedByPlayer?.[player.playerId] ?? 0
                const privateContractorExpense =
                    corporation.privateContractorExpenseByPlayer?.[player.playerId] ?? 0

                const miningCapacity = effectiveMiningCapacityForCorporation(
                    gameSession.gameState,
                    corporation.id
                )
                const issuedShareCount = corporation.issuedShareCount
                const rawBaseValuePerShare =
                    issuedShareCount === 0
                        ? 0
                        : Math.ceil((miningCapacity + corporation.cargo) / issuedShareCount)
                const rawAgreementBonusPerShare = corporation.agreement
                    ? agreementTrackEntryForPlanetCount(corporation.agreement.planetCountAtSigning)
                          .agreementBonusPerShare
                    : 0
                const loanPenaltyPerShare = corporation.loanCount * LoanPenaltyPerShare

                const takeoverMiningCapacity = corporation.hasActivePower(
                    CorporatePowerId.AccountingGimmick
                )
                    ? miningCapacity + AccountingGimmickTakeoverBonus
                    : miningCapacity
                const hostileTakeover = hostileTakeoverApplies(
                    takeoverMiningCapacity,
                    corporation,
                    alienMiningCapacity
                )
                const totalValuePerShare = shareValuePerShare(
                    miningCapacity,
                    corporation,
                    alienMiningCapacity
                )

                // A Hostile Takeover row shows a flat $1/$0 in place of the real, no-longer
                // representative Base Value / Bonus numbers - see this derivation's own doc
                // comment above.
                const baseValuePerShare = hostileTakeover ? 1 : rawBaseValuePerShare
                const agreementBonusPerShare = hostileTakeover ? 0 : rawAgreementBonusPerShare

                const dividendSplits = splitEvenly(dividendsReceived, sharesHeld)
                const contractorSplits = splitEvenly(privateContractorExpense, sharesHeld)
                const shares: ShareSummaryRow[] = playerShares.map((share, index) => {
                    const shareCost = share.pricePaid ?? 0
                    const shareDividendsReceived = dividendSplits[index] ?? 0
                    const sharePrivateContractorExpense = contractorSplits[index] ?? 0
                    const shareTotalProfit =
                        shareDividendsReceived +
                        totalValuePerShare -
                        shareCost -
                        sharePrivateContractorExpense
                    return {
                        shareNumber: index + 1,
                        cost: shareCost,
                        dividendsReceived: shareDividendsReceived,
                        privateContractorExpense: sharePrivateContractorExpense,
                        baseShareValue: baseValuePerShare,
                        agreementBonus: agreementBonusPerShare,
                        loanPenalty: loanPenaltyPerShare,
                        totalValue: totalValuePerShare,
                        totalProfit: shareTotalProfit,
                        profitMargin: profitMarginFor(
                            shareTotalProfit,
                            shareCost + sharePrivateContractorExpense
                        )
                    }
                })

                const corporationTotalValue = totalValuePerShare * sharesHeld
                const corporationTotalProfit =
                    dividendsReceived + corporationTotalValue - cost - privateContractorExpense
                rows.push({
                    corporationId: corporation.id,
                    sharesHeld,
                    cost,
                    dividendsReceived,
                    privateContractorExpense,
                    baseShareValue: hostileTakeover ? 1 : baseValuePerShare * sharesHeld,
                    agreementBonus: hostileTakeover ? 0 : agreementBonusPerShare * sharesHeld,
                    loanPenalty: loanPenaltyPerShare * sharesHeld,
                    totalValue: corporationTotalValue,
                    totalProfit: corporationTotalProfit,
                    profitMargin: profitMarginFor(
                        corporationTotalProfit,
                        cost + privateContractorExpense
                    ),
                    hostileTakeover,
                    shares
                })
            }

            // Profit Margin is deliberately left out of this sum - a ratio can't be summed
            // across Corporations the way plain Credit totals can - and is computed separately
            // below, once, from the already-summed Total Profit/Cost/Private Contractor figures.
            const summedTotals = rows.reduce(
                (sum, row) => ({
                    sharesHeld: sum.sharesHeld + row.sharesHeld,
                    cost: sum.cost + row.cost,
                    dividendsReceived: sum.dividendsReceived + row.dividendsReceived,
                    privateContractorExpense: sum.privateContractorExpense + row.privateContractorExpense,
                    baseShareValue: sum.baseShareValue + row.baseShareValue,
                    agreementBonus: sum.agreementBonus + row.agreementBonus,
                    loanPenalty: sum.loanPenalty + row.loanPenalty,
                    totalValue: sum.totalValue + row.totalValue,
                    totalProfit: sum.totalProfit + row.totalProfit
                }),
                {
                    sharesHeld: 0,
                    cost: 0,
                    dividendsReceived: 0,
                    privateContractorExpense: 0,
                    baseShareValue: 0,
                    agreementBonus: 0,
                    loanPenalty: 0,
                    totalValue: 0,
                    totalProfit: 0
                }
            )
            const totals: PlayerSummary['totals'] = {
                ...summedTotals,
                profitMargin: profitMarginFor(
                    summedTotals.totalProfit,
                    summedTotals.cost + summedTotals.privateContractorExpense
                )
            }

            const finalCredits = totalCredits(gameSession.gameState, player.playerId)
            const baseCredits = finalCredits - totals.totalValue

            return { playerId: player.playerId, rows, totals, baseCredits, finalCredits }
        })
    })

    // Which player's tab is showing. Not reset when a new game starts / players change shape -
    // the fallback to playerSummaries[0] below covers a stale id (e.g. a player who's no longer
    // in the list) the same way it covers never having picked a tab at all.
    let selectedPlayerId = $state<string | undefined>(undefined)
    const activeSummary = $derived(
        playerSummaries.find((summary) => summary.playerId === selectedPlayerId) ??
            playerSummaries[0]
    )
</script>

{#if open}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div
            class="flex max-h-full w-full max-w-5xl flex-col gap-3 rounded-xl border border-[#3a4166] bg-[#0b0e1a] p-4 text-[#e6e9f5] shadow-2xl"
        >
            <div class="text-center text-xl font-bold">Game Summary</div>

            <div class="flex justify-center gap-2">
                <button
                    type="button"
                    onclick={() => (viewMode = 'simple')}
                    class="rounded-lg px-3 py-1.5 text-xs font-semibold transition {viewMode ===
                    'simple'
                        ? 'bg-[#2f6fed] text-white'
                        : 'bg-black/20 text-[#9aa2c0] hover:bg-black/30 hover:text-[#e6e9f5]'}"
                >
                    Simple
                </button>
                <button
                    type="button"
                    onclick={() => (viewMode = 'detailed')}
                    class="rounded-lg px-3 py-1.5 text-xs font-semibold transition {viewMode ===
                    'detailed'
                        ? 'bg-[#2f6fed] text-white'
                        : 'bg-black/20 text-[#9aa2c0] hover:bg-black/30 hover:text-[#e6e9f5]'}"
                >
                    Detailed
                </button>
            </div>

            {#if playerSummaries.length > 0}
                <div class="flex flex-wrap gap-2 border-b border-[#2a2f45] pb-3">
                    {#each playerSummaries as summary (summary.playerId)}
                        <button
                            type="button"
                            onclick={() => (selectedPlayerId = summary.playerId)}
                            class="rounded-lg px-3.5 py-2 text-sm font-semibold transition {activeSummary?.playerId ===
                            summary.playerId
                                ? 'bg-[#2f6fed] text-white'
                                : 'bg-black/20 text-[#9aa2c0] hover:bg-black/30 hover:text-[#e6e9f5]'}"
                        >
                            <PlayerName playerId={summary.playerId} />
                        </button>
                    {/each}
                </div>
            {/if}

            <div class="min-h-0 flex-1 overflow-y-auto pr-1">
                {#if activeSummary}
                    {#if viewMode === 'simple'}
                        <div class="rounded-lg border border-[#2a2f45] bg-black/20 p-4">
                            <div
                                class="mb-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-b border-[#2a2f45] pb-3"
                            >
                                <div class="flex items-baseline gap-2 text-sm">
                                    <span class="text-[#9aa2c0]">Credits</span>
                                    <span class="font-mono font-semibold"
                                        ><CreditsIcon />{activeSummary.baseCredits}</span
                                    >
                                </div>
                                <div class="flex items-baseline gap-2 text-sm">
                                    <span class="text-[#9aa2c0]">Total Share Value</span>
                                    <span class="font-mono font-semibold"
                                        ><CreditsIcon />{activeSummary.totals.totalValue}</span
                                    >
                                </div>
                                <div class="flex items-baseline gap-2 text-base">
                                    <span class="text-[#9aa2c0]">Final Total</span>
                                    <span class="font-mono font-bold"
                                        ><CreditsIcon />{activeSummary.finalCredits}</span
                                    >
                                </div>
                            </div>

                            {#if activeSummary.rows.length === 0}
                                <div class="text-sm text-[#9aa2c0]">No Shares held.</div>
                            {:else}
                                <div class="space-y-2">
                                    {#each activeSummary.rows as row (row.corporationId)}
                                        <div
                                            class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-black/20 px-3 py-2"
                                        >
                                            <div class="flex items-center gap-2 text-sm">
                                                <img
                                                    src={CorporationLogoIcons[row.corporationId]}
                                                    alt=""
                                                    class="h-5 shrink-0"
                                                    style="aspect-ratio: {CorporationLogoAspect[
                                                        row.corporationId
                                                    ]};"
                                                />
                                                <span
                                                    >{CorporationDisplayNames[
                                                        row.corporationId
                                                    ]}</span
                                                >
                                                {#if row.hostileTakeover}
                                                    <span
                                                        class="rounded border border-[#dc2626] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f87171]"
                                                    >
                                                        Hostile Takeover
                                                    </span>
                                                {/if}
                                            </div>
                                            <div
                                                class="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-[#9aa2c0]"
                                            >
                                                <span
                                                    >Base Value <CreditsIcon
                                                    />{row.baseShareValue}</span
                                                >
                                                <span
                                                    >Bonus <CreditsIcon />{row.agreementBonus}</span
                                                >
                                                <span>Loans <CreditsIcon />{row.loanPenalty}</span>
                                                <span class="font-semibold text-[#e6e9f5]"
                                                    >Total <CreditsIcon />{row.totalValue}</span
                                                >
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {:else}
                        <div class="rounded-lg border border-[#2a2f45] bg-black/20 p-4">
                            {#if activeSummary.rows.length === 0}
                                <div class="text-sm text-[#9aa2c0]">No Shares held.</div>
                            {:else}
                                <div class="overflow-x-auto">
                                    <table class="w-full min-w-[720px] table-fixed text-sm">
                                        <colgroup>
                                            <col style="width: 170px;" />
                                            <col style="width: 84px;" />
                                            <col style="width: 108px;" />
                                            <col style="width: 84px;" />
                                            <col style="width: 104px;" />
                                            <col style="width: 92px;" />
                                            <col style="width: 92px;" />
                                        </colgroup>
                                        <thead>
                                            <tr class="text-left text-[#9aa2c0]">
                                                <th class="py-1.5 pr-2 align-bottom font-medium"
                                                    >Corporation</th
                                                >
                                                <th
                                                    class="py-1.5 px-2 text-right align-bottom font-medium"
                                                    >Share Cost</th
                                                >
                                                <th
                                                    class="py-1.5 px-2 text-right align-bottom font-medium"
                                                    >Private Contractor Costs</th
                                                >
                                                <th
                                                    class="py-1.5 px-2 text-right align-bottom font-medium"
                                                    >Dividends</th
                                                >
                                                <th
                                                    class="py-1.5 px-2 text-right align-bottom font-medium"
                                                    >Final Share Value</th
                                                >
                                                <th
                                                    class="py-1.5 px-2 text-right align-bottom font-medium"
                                                    >Total Profit</th
                                                >
                                                <th
                                                    class="py-1.5 pl-2 text-right align-bottom font-medium"
                                                    >Profit Margin</th
                                                >
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each activeSummary.rows as row (row.corporationId)}
                                                <tr class="border-t border-[#2a2f45]">
                                                    <td class="py-2 pr-2">
                                                        <div class="flex items-center gap-2">
                                                            <img
                                                                src={CorporationLogoIcons[
                                                                    row.corporationId
                                                                ]}
                                                                alt=""
                                                                class="h-5 shrink-0"
                                                                style="aspect-ratio: {CorporationLogoAspect[
                                                                    row.corporationId
                                                                ]};"
                                                            />
                                                            <span
                                                                >{CorporationDisplayNames[
                                                                    row.corporationId
                                                                ]}</span
                                                            >
                                                            {#if row.hostileTakeover}
                                                                <span
                                                                    class="rounded border border-[#dc2626] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f87171]"
                                                                >
                                                                    Hostile Takeover
                                                                </span>
                                                            {/if}
                                                        </div>
                                                    </td>
                                                    <td class="py-2 px-2 text-right font-mono"
                                                        ><CreditsIcon />{row.cost}</td
                                                    >
                                                    <td class="py-2 px-2 text-right font-mono"
                                                        ><CreditsIcon
                                                        />{row.privateContractorExpense}</td
                                                    >
                                                    <td class="py-2 px-2 text-right font-mono"
                                                        ><CreditsIcon />{row.dividendsReceived}</td
                                                    >
                                                    <td class="py-2 px-2 text-right font-mono"
                                                        ><CreditsIcon />{row.totalValue}</td
                                                    >
                                                    <td
                                                        class="py-2 px-2 text-right font-mono font-semibold"
                                                        ><CreditsIcon />{row.totalProfit}</td
                                                    >
                                                    <td
                                                        class="py-2 pl-2 text-right font-mono font-semibold"
                                                        >{formatPercent(row.profitMargin)}</td
                                                    >
                                                </tr>
                                                {#each row.shares as share (share.shareNumber)}
                                                    <tr class="text-xs text-[#8891b3]">
                                                        <td class="py-1 pr-2 pl-5">
                                                            Share {share.shareNumber}
                                                        </td>
                                                        <td class="py-1 px-2 text-right font-mono"
                                                            ><CreditsIcon />{share.cost}</td
                                                        >
                                                        <td class="py-1 px-2 text-right font-mono"
                                                            ><CreditsIcon
                                                            />{share.privateContractorExpense}</td
                                                        >
                                                        <td class="py-1 px-2 text-right font-mono"
                                                            ><CreditsIcon
                                                            />{share.dividendsReceived}</td
                                                        >
                                                        <td class="py-1 px-2 text-right font-mono"
                                                            ><CreditsIcon />{share.totalValue}</td
                                                        >
                                                        <td class="py-1 px-2 text-right font-mono"
                                                            ><CreditsIcon
                                                            />{share.totalProfit}</td
                                                        >
                                                        <td class="py-1 pl-2 text-right font-mono"
                                                            >{formatPercent(
                                                                share.profitMargin
                                                            )}</td
                                                        >
                                                    </tr>
                                                {/each}
                                            {/each}
                                        </tbody>
                                        <tfoot>
                                            <tr class="border-t border-[#3a4166] font-semibold">
                                                <td class="py-2 pr-2">Total</td>
                                                <td class="py-2 px-2 text-right font-mono"
                                                    ><CreditsIcon
                                                    />{activeSummary.totals.cost}</td
                                                >
                                                <td class="py-2 px-2 text-right font-mono"
                                                    ><CreditsIcon
                                                    />{activeSummary.totals
                                                        .privateContractorExpense}</td
                                                >
                                                <td class="py-2 px-2 text-right font-mono"
                                                    ><CreditsIcon
                                                    />{activeSummary.totals.dividendsReceived}</td
                                                >
                                                <td class="py-2 px-2 text-right font-mono"
                                                    ><CreditsIcon
                                                    />{activeSummary.totals.totalValue}</td
                                                >
                                                <td class="py-2 px-2 text-right font-mono"
                                                    ><CreditsIcon
                                                    />{activeSummary.totals.totalProfit}</td
                                                >
                                                <td class="py-2 pl-2 text-right font-mono"
                                                    >{formatPercent(
                                                        activeSummary.totals.profitMargin
                                                    )}</td
                                                >
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/if}
            </div>

            <button
                type="button"
                onclick={onClose}
                class="mx-auto rounded-lg bg-[#2f6fed] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
                Close
            </button>
        </div>
    </div>
{/if}
