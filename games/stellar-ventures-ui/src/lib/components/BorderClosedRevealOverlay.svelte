<script lang="ts">
    // Dramatic (not decision-driving) full-screen reveal for a Border closing (Borders & Taxes
    // page 2's own rule: "a Border closes the moment any player-controlled Corporation reaches
    // its Activation Value on the Mining Capacity track, and never reopens" - see
    // operations/borders.ts's closeBordersReachedByCorporations). Exactly the same shape of
    // problem FirstShipOrderedRevealOverlay.svelte solves, and the same solution: this has to
    // show for EVERY player, including ones who weren't watching when the closing Corporation
    // Round action resolved and only "return to the game" afterward, so it's derived straight off
    // the Board's own permanent record (board.closedBorderLevels never un-closes a level - see
    // model/board.ts's closeBorder) rather than any snapshot taken right before one player's own
    // action. "Already seen" is saved to the player's account (SeenOverlays), scoped per game, same per-viewer
    // dramatic-pacing convention as that overlay - nothing here is shared or persisted
    // server-side.
    //
    // Mounted once in GameTable.svelte, alongside the other full-screen reveals. While a reveal
    // is pinned, borderClosedReveal.level (a tiny shared piece of ephemeral UI state - see that
    // module's own comment) is set to the Border level being revealed, so Board.svelte can pulse
    // that specific Border's own segments on the actual map right behind this dialog - the
    // "pulse the border that is now closed" half of the request this overlay exists for.
    import { untrack } from 'svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SeenOverlays } from '$lib/model/seenOverlays.svelte.js'
    import type { StellarVenturesGameSession } from '$lib/model/session.svelte.js'
    import { borderClosedReveal } from '$lib/model/borderClosedReveal.svelte.js'
    import { borderZoneDisplay } from '$lib/utils/borderZoneDisplay.js'

    const gameSession = getGameSession()

    // Every Border level the current map defines that's actually closed right now, lowest first
    // - if more than one is unacknowledged at once (a returning player who missed several
    // closings), they queue up and are shown one at a time, exactly like
    // FirstShipOrderedRevealOverlay's own resolvedSections. If that's the scenario, clicking
    // Continue on "The First Border" immediately brings up "The Second Border" right behind it -
    // expected (one dialog per closed Border still unseen), not a stuck button.
    const closedBorders = $derived(
        gameSession.gameState.boardMapDefinition.borders
            .filter((border) => gameSession.gameState.board.isBorderClosed(border.level))
            .sort((a, b) => a.level - b.level)
    )

    const storageKey = `stellar-ventures-seen-border-closed-${gameSession.gameState.gameId}`

    // Seen levels are a plain array of numbers (not a Set) - simpler to reason about and to
    // serialize, and dismiss() below always replaces this with a brand-new array, so equality/
    // reactivity never depends on any in-place mutation.
    // Saved to the player's account, so a reveal watched on one device doesn't replay on another.
    const seenOverlays = new SeenOverlays(gameSession as StellarVenturesGameSession)

    function loadSeenLevels(): number[] {
        try {
            const raw = seenOverlays.get(storageKey)
            return raw ? (JSON.parse(raw) as number[]) : []
        } catch {
            return []
        }
    }

    function saveSeenLevels(levels: number[]) {
        seenOverlays.set(storageKey, JSON.stringify(levels))
    }

    let seenLevels: number[] = $state(loadSeenLevels())
    // Picks up the account copy once it loads (or changes on another device).
    $effect(() => {
        const stored = loadSeenLevels()
        const current = untrack(() => seenLevels)
        const added = stored.filter((level) => !current.includes(level))
        if (added.length > 0) seenLevels = [...current, ...added]
    })

    // If a Border-closing action gets Undone (canUndo/undoableAction - only possible before
    // anything revealsInfo-flagged happens after it), board.closedBorderLevels genuinely reverts
    // - closedBorders above is a live $derived off current state, so a reopened level simply
    // stops appearing in it and pending below already resolves to undefined for it, with no
    // overlay shown. This effect goes one step further: it also un-marks that level as "seen"
    // the moment it's no longer actually closed, so if some OTHER later action closes it again
    // for real, this reveal fires again instead of staying silently suppressed forever by a
    // "seen" flag left over from the undone attempt.
    $effect(() => {
        const closedLevelSet = new Set(closedBorders.map((border) => border.level))
        const stillValid = seenLevels.filter((level) => closedLevelSet.has(level))
        if (stillValid.length !== seenLevels.length) {
            seenLevels = stillValid
            saveSeenLevels(stillValid)
        }
    })

    // Named the way the co-designer talks about them in play ("the First Border's closed") -
    // Borders & Taxes only ever defines 3 levels (data/boardMaps.ts), so this stays a fixed map
    // rather than a general number-to-ordinal formatter.
    const BORDER_ORDINALS: Record<number, string> = { 1: 'First', 2: 'Second', 3: 'Third' }

    // The Border (and its display color) currently pending acknowledgement, combined into one
    // derived value rather than two separate ones kept in sync by hand.
    const pending = $derived.by(() => {
        if (!seenOverlays.ready) return undefined
        const border = closedBorders.find((candidate) => !seenLevels.includes(candidate.level))
        return border ? { border, color: borderZoneDisplay(border.level).color } : undefined
    })

    // Hand off to Board.svelte so it can pulse this exact Border's segments while the dialog is
    // up - cleared the instant there's nothing pending (dismissed, or none to show at all).
    $effect(() => {
        borderClosedReveal.level = pending?.border.level
        return () => {
            if (borderClosedReveal.level === pending?.border.level) {
                borderClosedReveal.level = undefined
            }
        }
    })

    function dismiss() {
        const level = pending?.border.level
        if (level === undefined) {
            return
        }
        const next = [...seenLevels, level]
        seenLevels = next
        saveSeenLevels(next)
    }
</script>

{#if pending}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div
            class="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-[#3a4166] bg-[#0b0e1a] p-6 text-center text-[#e6e9f5] shadow-2xl"
        >
            <div
                class="border-closed-badge flex h-20 w-20 items-center justify-center rounded-full border-4"
                style="border-color: {pending.color}; box-shadow: 0 0 18px {pending.color};"
            >
                <span class="text-2xl font-bold" style="color: {pending.color};">{pending.border.level}</span>
            </div>
            <div class="text-xl font-bold tracking-wide" style="color: {pending.color};">Border Closed</div>
            <div class="text-sm text-[#c3c9e6]">
                The {BORDER_ORDINALS[pending.border.level] ?? `Level ${pending.border.level}`} Border has
                closed. Corporations can only build or pass across using Create Wormhole.
            </div>
            <button
                type="button"
                onclick={dismiss}
                class="mt-1 rounded-lg bg-[#2f6fed] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
                Continue
            </button>
        </div>
    </div>
{/if}

<style>
    .border-closed-badge {
        animation: border-closed-badge-pulse 1.6s ease-in-out infinite;
    }
    @keyframes border-closed-badge-pulse {
        0%,
        100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.08);
        }
    }
</style>
