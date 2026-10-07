<script lang="ts">
    import { untrack } from 'svelte'
    // Dramatic (not decision-driving) full-screen reveal for a completed batch of Tax Payments
    // (state.taxPaymentSummary - see model/gameState.ts's own comment and
    // stateHandlers/payTaxes.ts, which finalizes it the instant state.taxPayerCorporationIds
    // fully drains). Same shape of problem as FirstShipOrderedRevealOverlay.svelte and
    // BorderClosedRevealOverlay.svelte, same solution: has to show for EVERY player, including
    // ones who weren't watching Pay Taxes resolve and only "return to the game" afterward, so
    // it's derived straight off taxPaymentSummary's own permanent, already-shared record rather
    // than any snapshot taken right before one player's own action. taxPaymentSummary.id
    // increments once per completed batch, so "already seen" is just the highest id this viewer
    // has acknowledged - saved to their account (SeenOverlays), scoped per game, same per-viewer dramatic-
    // pacing convention as those two overlays.
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SeenOverlays } from '$lib/model/seenOverlays.svelte.js'
    import type { StellarVenturesGameSession } from '$lib/model/session.svelte.js'
    import { borderZoneDisplay } from '$lib/utils/borderZoneDisplay.js'
    import { CorporationDisplayNames, CorporationLogoIcons, CorporationLogoAspect } from '$lib/utils/corporationDisplay.js'
    import CreditsIcon from './CreditsIcon.svelte'

    const gameSession = getGameSession()

    const summary = $derived(gameSession.gameState.taxPaymentSummary)

    const storageKey = `stellar-ventures-seen-tax-payment-${gameSession.gameState.gameId}`
    // Saved to the player's account, so a reveal watched on one device doesn't replay on another.
    const seenOverlays = new SeenOverlays(gameSession as StellarVenturesGameSession)

    function loadSeenId(): number {
        const raw = seenOverlays.get(storageKey)
        return raw ? Number(raw) || 0 : 0
    }

    let seenId: number = $state(loadSeenId())
    // Picks up the account copy once it loads (or changes on another device).
    $effect(() => {
        const stored = loadSeenId()
        if (stored > untrack(() => seenId)) seenId = stored
    })

    const pending = $derived(
        seenOverlays.ready && summary && summary.id > seenId ? summary : undefined
    )
    const taxBoxIncrease = $derived(pending ? pending.taxBoxAfter - pending.taxBoxBefore : 0)

    function dismiss() {
        if (pending) {
            seenId = pending.id
            seenOverlays.set(storageKey, String(pending.id))
        }
    }
</script>

{#if pending}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div
            class="flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto rounded-xl border border-[#3a4166] bg-[#0b0e1a] p-4 text-[#e6e9f5] shadow-2xl"
        >
            <div class="text-center text-lg font-bold">Pay Taxes</div>

            <!-- Snapshot of the Tax Box and Tax Zones at the moment this batch was collected -
                 taxBoxAfter/zones are frozen onto the summary itself precisely so a later Border
                 closing (raising a new Tax Zone) can't retroactively change what an earlier
                 reveal shows. -->
            <div class="rounded-lg border border-[#2a3155] bg-[#12162b] p-3">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-semibold uppercase tracking-widest text-[#7f88ad]">
                        Tax Box
                    </span>
                    <span class="flex items-center gap-1.5 font-mono text-sm font-semibold">
                        <CreditsIcon />{pending.taxBoxAfter}
                        {#if taxBoxIncrease > 0}
                            <span class="text-[#3ddc84]">(+{taxBoxIncrease})</span>
                        {/if}
                    </span>
                </div>
                {#if pending.zones.length > 0}
                    <div class="mt-2 flex flex-wrap gap-2 border-t border-[#232945] pt-2">
                        {#each pending.zones as zone (zone.level)}
                            {@const display = borderZoneDisplay(zone.level)}
                            <span
                                class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                                style="border-color: {display.color}; color: {display.color};"
                            >
                                Zone {zone.level}: <CreditsIcon />{zone.tax}
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- One row per Corporation that paid, in the order it paid - logo/name, amount
                 actually paid (operations/taxes.ts's payTax, clamped to whatever Treasury could
                 cover), and how many NEW Loans it took on to get there (0 skips the +Loans
                 badge entirely, rather than showing "+0"). -->
            <div class="overflow-hidden rounded-lg border border-[#2a3155]">
                <table class="w-full border-collapse text-sm">
                    <tbody>
                        {#each pending.payments as payment, index (payment.corporationId + index)}
                            {@const logoAspect = CorporationLogoAspect[payment.corporationId] ?? 1}
                            <tr class={index % 2 === 0 ? 'bg-[#1b2242]' : ''}>
                                <td class="flex items-center gap-2 px-3 py-1.5">
                                    <img
                                        src={CorporationLogoIcons[payment.corporationId]}
                                        alt=""
                                        class="h-5 shrink-0 drop-shadow"
                                        style="width: {20 * logoAspect}px;"
                                    />
                                    <span class="font-semibold">{CorporationDisplayNames[payment.corporationId]}</span>
                                </td>
                                <td class="px-3 py-1.5 text-right font-mono font-semibold text-[#ff6b6b]">
                                    -<CreditsIcon />{payment.amount}
                                </td>
                                <td class="w-0 px-3 py-1.5 text-right">
                                    {#if payment.loans > 0}
                                        <span class="whitespace-nowrap rounded-full border border-[#e0343a] px-2 py-0.5 text-[10px] font-semibold text-[#ff8f8f]">
                                            +{payment.loans} Loan{payment.loans === 1 ? '' : 's'}
                                        </span>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <button
                type="button"
                onclick={dismiss}
                class="mx-auto rounded-lg bg-[#2f6fed] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
                Continue
            </button>
        </div>
    </div>
{/if}
