<script lang="ts">
    import {
        ActionType,
        CorporatePowerId,
        dividendRowForCargo,
        dividendRowForMiningCapacity,
        effectiveMiningCapacityForCorporation,
        type CorporationId
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import { CorporatePowerBackImages, POWER_CARD_ASPECT } from '$lib/utils/corporatePowerImages.js'
    import CorporationBadge from './CorporationBadge.svelte'
    import DividendChartPanel from './DividendChartPanel.svelte'

    // Deep Space Pirates (Corporate Power Glossary, page 29): "Pay Dividends, One-Time. Copy
    // another Corporation's Mining Capacity when determining Dividends. Discard after use."
    // A straight copy of DeepSpaceSmugglingPanel.svelte's own flow (see its comment for the
    // full rationale on the 3-step Apply/pick-target/Confirm shape) - the only real difference
    // is which track on the Dividend Chart gets copied: Mining Capacity here instead of Cargo,
    // so this reads/writes DividendChartPanel's deepSpacePiratesClickableCorporationIds
    // (mining markers) rather than deepSpaceSmugglingClickableCorporationIds (cargo markers),
    // and the payout preview swaps in the target's effective Mining Capacity while keeping this
    // Corporation's own Cargo unchanged - the mirror image of Smuggling's preview, which swaps
    // in the target's Cargo while keeping this Corporation's own Mining Capacity unchanged.
    const gameSession = getGameSession()

    const corporation = $derived(
        gameSession.gameState.corporations.find((corporation) =>
            corporation.hasActivePower(CorporatePowerId.DeepSpacePirates)
        )
    )
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    const canDeepSpacePirates = $derived(
        gameSession.validActionTypes.includes(ActionType.DeepSpacePirates)
    )
    const canDecline = $derived(
        gameSession.validActionTypes.includes(ActionType.DeclinePayDividendsPower)
    )

    let revealed = $state(false)
    let selectedCorporationId: CorporationId | undefined = $state()

    const otherActiveCorporationIds = $derived(
        corporation
            ? gameSession.gameState.corporations
                  .filter((candidate) => candidate.active && candidate.id !== corporation.id)
                  .map((candidate) => candidate.id)
            : []
    )

    // Which payout-table cell (row/status) the pulsing highlight below should land on - the
    // CURRENT cell before a target is picked, the NEW preview cell once one is (see
    // payoutHighlight's own comment on DividendChartPanel). Same min(cargo row, mining row)
    // rule dividendPayoutPerShare itself applies internally, just surfaced here as a row number
    // instead of a dollar amount so the chart can point at the actual printed cell.
    const currentPayoutHighlight = $derived.by(() => {
        if (!corporation) return undefined
        const miningCapacity = effectiveMiningCapacityForCorporation(
            gameSession.gameState,
            corporation.id
        )
        const row = Math.min(
            dividendRowForCargo(corporation.cargo),
            dividendRowForMiningCapacity(miningCapacity)
        )
        return { row, status: corporation.status }
    })

    const previewPayoutHighlight = $derived.by(() => {
        if (!corporation || !selectedCorporationId) return undefined
        const targetMiningCapacity = effectiveMiningCapacityForCorporation(
            gameSession.gameState,
            selectedCorporationId
        )
        const row = Math.min(
            dividendRowForCargo(corporation.cargo),
            dividendRowForMiningCapacity(targetMiningCapacity)
        )
        return { row, status: corporation.status }
    })

    function reveal() {
        revealed = true
    }

    function chooseTarget(corporationId: CorporationId) {
        selectedCorporationId = corporationId
    }

    function changeSelection() {
        selectedCorporationId = undefined
    }

    async function confirm() {
        if (!selectedCorporationId) {
            return
        }
        const corporationId = selectedCorporationId
        revealed = false
        selectedCorporationId = undefined
        await gameSession.deepSpacePirates(corporationId)
    }

    async function decline() {
        revealed = false
        selectedCorporationId = undefined
        await gameSession.declinePayDividendsPower()
    }
</script>

<div class="flex h-full flex-col text-[#e6e9f5]">
    <div class="px-4 pt-3 text-center">
        <div class="text-sm font-semibold">
            {CorporatePowerDisplayNames[CorporatePowerId.DeepSpacePirates]}
        </div>
    </div>

    {#if !revealed && corporation}
        <div class="mx-auto flex w-[10.35rem] flex-col items-center gap-2 px-4 pt-2">
            <CorporationBadge corporationId={corporation.id} />
            <img
                src={CorporatePowerBackImages[CorporatePowerId.DeepSpacePirates] ?? ''}
                alt={CorporatePowerDisplayNames[CorporatePowerId.DeepSpacePirates]}
                class="block w-full rounded-md shadow-lg"
                style="aspect-ratio: {POWER_CARD_ASPECT};"
            />
        </div>
    {/if}

    {#if isMe && (canDeepSpacePirates || canDecline)}
        <!-- Same "buttons live right under the header, above the chart" placement as
             DeepSpaceSmugglingPanel - the chart's own tall aspect-ratio box can run past the
             visible frame otherwise. -->
        <div class="flex justify-center gap-2 px-4 pb-2 pt-2">
            {#if !revealed}
                <button
                    type="button"
                    onclick={reveal}
                    disabled={!canDeepSpacePirates}
                    class="rounded-md bg-[#2f6fed] px-4 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Apply
                </button>
            {:else if selectedCorporationId}
                <button
                    type="button"
                    onclick={confirm}
                    class="rounded-md bg-[#3ddc84] px-4 py-1.5 text-xs font-semibold text-[#0b0e1a] hover:bg-[#52e696]"
                >
                    Confirm
                </button>
                <button
                    type="button"
                    onclick={changeSelection}
                    class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-4 py-1.5 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
                >
                    Choose Different
                </button>
            {/if}
            <button
                type="button"
                onclick={decline}
                disabled={!canDecline}
                class="rounded-md bg-[#5a6178] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6b7290] disabled:cursor-not-allowed disabled:opacity-50"
            >
                Decline
            </button>
        </div>
    {/if}

    {#if revealed}
        <!-- Per the co-designer: no text description of the payout - pulse-highlight the actual
             printed figure on the chart itself instead (payoutHighlight below), the CURRENT
             cell the instant this chart comes up, then the NEW preview cell once a target is
             picked - see currentPayoutHighlight/previewPayoutHighlight's own comments. -->
        <div class="min-h-0 flex-1">
            <DividendChartPanel
                deepSpacePiratesClickableCorporationIds={isMe && !selectedCorporationId
                    ? otherActiveCorporationIds
                    : []}
                onSelectDeepSpacePiratesTarget={chooseTarget}
                payoutHighlight={selectedCorporationId ? previewPayoutHighlight : currentPayoutHighlight}
            />
        </div>
    {/if}

    {#if gameSession.lastActionError}
        <div class="px-4 pb-2 text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
    {/if}
</div>
