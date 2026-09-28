<script lang="ts">
    import {
        CorporationId,
        CorporatePowerId,
        effectiveMiningCapacityForCorporation,
        hostileTakeoverApplies,
        AccountingGimmickTakeoverBonus
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationDisplayNames,
        CorporationShareCertificateIcons,
        SHARE_CERTIFICATE_ASPECT
    } from '$lib/utils/corporationDisplay.js'
    import alienShareBack from '$lib/images/shares/alienShareBack.png'
    import DividendChartPanel from './DividendChartPanel.svelte'

    // Hostile Takeover / Share Liquidation's own dramatic reveal (rulebook page 21, steps 2-3),
    // per the co-designer's spec: the Dividend Chart with the Alien Mining Capacity marker
    // glowing (DividendChartPanel's own highlightAlienMiningMarker - shared with
    // BackroomDealPanel's interactive use of the same marker), next to a column of one purely
    // decorative Share Certificate per active Corporation ("for drama - not game related", per
    // the co-designer - these never represent any specific player's actual held Share), stamped
    // SAFE or flipped to its Alien Share back face, top to bottom. The Alien Share back art is
    // the co-designer's own real print file (SV_SHARE_CERT_44x67mm_CARDS_BACK_FINAL) - one
    // design regardless of Corporation, matching the rulebook's own "Alien Shares = Tr1 each"
    // (page 21) rather than a per-Corporation redesign.
    //
    // Purely a dramatic reconstruction of what Hostile Takeover already decided for real,
    // atomically, the instant Liquidate resolved (operations/liquidation.ts's
    // hostileTakeoverApplies/shareValuePerShare, run once by stateHandlers/liquidation.ts) - not
    // a decision itself, so, like FirstShipOrderedRevealOverlay, it's derived straight from
    // already-permanent game state rather than a per-action snapshot: works identically for a
    // player who was watching live and one who loads the game later.
    //
    // TESTING NOTE: "already seen" is intentionally NOT persisted (no localStorage, unlike
    // FirstShipOrderedRevealOverlay's own seen-tracking) while Backroom Deal/Accounting Gimmick
    // are still being tested - see dismissed/hasResult below. A first attempt keyed "seen" to
    // the auto-queued Liquidate action's own id, on the theory that undoing it (see
    // StellarVenturesGameSession.testingUndoLiquidation / GameEndPanel.svelte's "Undo
    // Liquidation (testing only)" button) and redoing the same choice would always produce a
    // fresh id - it doesn't: MachineContext.generateSystemActionId draws from the game's own
    // seeded PRNG, so replaying the exact same choice from the exact same undone state can hand
    // the redone Liquidate the SAME id as before, which then read as "already seen" and never
    // showed again. Tying "seen" to gameState.result itself instead sidesteps that entirely -
    // undo already reverts result to undefined for real (whatever the new Liquidate's id turns
    // out to be), which is what should un-dismiss this. Before shipping for real players, this
    // should go back to persisting across reloads (e.g. localStorage keyed by game id) now that
    // the PRNG-id pitfall is known - not needed while this is still under active design review.
    const gameSession = getGameSession()

    const activeCorporations = $derived(
        gameSession.gameState.corporations.filter((corporation) => corporation.active)
    )

    const alienMiningCapacity = $derived(gameSession.gameState.alienCorporation.miningCapacity)

    type ShareRow = {
        corporationId: CorporationId
        safe: boolean
    }

    // Mirrors shareValuePerShare's own Accounting Gimmick handling exactly (operations/
    // liquidation.ts) rather than inferring "safe" from the payout amount, since a Corporation
    // that avoided Hostile Takeover could coincidentally still work out to a Tr1 Share Value.
    const shareRows = $derived.by((): ShareRow[] => {
        return activeCorporations.map((corporation) => {
            const miningCapacity = effectiveMiningCapacityForCorporation(
                gameSession.gameState,
                corporation.id
            )
            const takeoverMiningCapacity = corporation.hasActivePower(
                CorporatePowerId.AccountingGimmick
            )
                ? miningCapacity + AccountingGimmickTakeoverBonus
                : miningCapacity
            return {
                corporationId: corporation.id,
                safe: !hostileTakeoverApplies(
                    takeoverMiningCapacity,
                    corporation,
                    alienMiningCapacity
                )
            }
        })
    })

    const hasResult = $derived(gameSession.gameState.result !== undefined)

    // Resets the moment the game is un-ended (hasResult goes false - i.e. Undo Liquidation), so
    // the very next time it ends again (redo), this reads as fresh regardless of whether the
    // redone Liquidate happens to share its predecessor's id (see the TESTING NOTE above).
    let dismissed = $state(false)

    $effect(() => {
        if (!hasResult) {
            dismissed = false
        }
    })

    function markSeen() {
        dismissed = true
    }

    const pending = $derived(hasResult && !dismissed)

    // Each Share resolves top to bottom, one at a time - stamped SAFE or flipped to its Alien
    // Share back - before the dismiss button is usable, mirroring FirstShipOrderedRevealOverlay's
    // own staggered-then-settle pacing. Per the co-designer: nothing should flip (or look like it
    // flipped) before its own turn, and a SAFE Share should never animate at all - only a Share
    // that's actually about to show its Alien Share back gets the reveal-flip class, and only for
    // the moment it's actually happening (see flippingCorporationIds below), never on first mount.
    const INITIAL_DELAY_MS = 900
    const STEP_DELAY_MS = 900
    const FLIP_ANIMATION_MS = 520

    let resolvedCount = $state(0)
    let flippingCorporationIds: Set<CorporationId> = $state(new Set())

    $effect(() => {
        resolvedCount = 0
        flippingCorporationIds = new Set()
        if (!pending) {
            return
        }

        let cancelled = false
        const timers: ReturnType<typeof setTimeout>[] = []
        function schedule(fn: () => void, delayMs: number) {
            timers.push(
                setTimeout(() => {
                    if (!cancelled) fn()
                }, delayMs)
            )
        }

        let delay = INITIAL_DELAY_MS
        for (let i = 0; i < shareRows.length; i++) {
            const row = shareRows[i]!
            const count = i + 1
            schedule(() => {
                resolvedCount = count
                if (!row.safe) {
                    const id = row.corporationId
                    flippingCorporationIds = new Set([...flippingCorporationIds, id])
                    schedule(() => {
                        flippingCorporationIds = new Set(
                            [...flippingCorporationIds].filter((x) => x !== id)
                        )
                    }, FLIP_ANIMATION_MS)
                }
            }, delay)
            delay += STEP_DELAY_MS
        }

        return () => {
            cancelled = true
            for (const timer of timers) clearTimeout(timer)
        }
    })

    function dismiss() {
        markSeen()
    }
</script>

{#if pending}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div
            class="flex max-h-full w-full max-w-2xl flex-col gap-3 rounded-xl border border-[#3a4166] bg-[#0b0e1a] p-4 text-[#e6e9f5] shadow-2xl"
        >
            <div class="text-center text-lg font-bold">Hostile Takeover</div>
            <div class="flex min-h-0 flex-1 gap-3">
                <div class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#2a2f45]">
                    <DividendChartPanel highlightAlienMiningMarker={true} />
                </div>
                <div class="flex w-32 shrink-0 flex-col gap-2 overflow-y-auto py-1 sm:w-40">
                    {#each shareRows as row, i (row.corporationId)}
                        {@const resolved = i < resolvedCount}
                        {@const flipping = flippingCorporationIds.has(row.corporationId)}
                        <div
                            class="relative shrink-0"
                            style="aspect-ratio: {SHARE_CERTIFICATE_ASPECT};"
                            title={CorporationDisplayNames[row.corporationId]}
                        >
                            <img
                                src={resolved && !row.safe
                                    ? alienShareBack
                                    : CorporationShareCertificateIcons[row.corporationId]}
                                alt="{CorporationDisplayNames[row.corporationId]} Share{resolved && !row.safe
                                    ? ' - flipped to its Alien Share side'
                                    : ''}"
                                class="h-full w-full rounded-md object-cover shadow-md {flipping
                                    ? 'reveal-flip'
                                    : ''}"
                            />
                            {#if resolved && row.safe}
                                <div
                                    class="safe-stamp pointer-events-none absolute inset-0 flex items-center justify-center"
                                >
                                    <span
                                        class="rotate-[-10deg] rounded border-4 border-[#3ddc84] bg-black/40 px-2 py-0.5 text-sm font-black uppercase tracking-widest text-[#3ddc84]"
                                    >
                                        Safe
                                    </span>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
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

<style>
    /* Same cheap dependency-free flip technique as OfferSignTheAgreementPanel's own
       .reveal-flip, adapted so it only ever plays for the specific moment a Share actually
       becomes unsafe: the scheduling effect above toggles the class on, with the new (Alien
       Share) src already set, then back off once the animation's had time to finish - never on
       first mount, and never at all for a Share that stays SAFE. */
    .reveal-flip {
        animation: reveal-flip 0.5s ease-in-out;
    }
    @keyframes reveal-flip {
        0% {
            transform: scaleX(1);
        }
        50% {
            transform: scaleX(0);
        }
        100% {
            transform: scaleX(1);
        }
    }
</style>
