<script lang="ts">
    // Dramatic (not decision-driving) full-screen reveal for OrderShip's "First Ship in New Level
    // Ordered?" one-time effects (operations/shipOrdering.ts's resolveFirstShipOrderedEffects,
    // resolved fully atomically the instant OrderShip is submitted - flipping that Shipyard
    // section's Alien Ship Tile, if any, and/or triggering a Scrapping Event, if any). Purely
    // tension/spectacle per the co-designer - there's no decision to make here.
    //
    // Unlike a per-action pacing gate (session.svelte.ts's signTheAgreementReveal), this has to
    // show for EVERY player, including ones who weren't even watching when the triggering
    // OrderShip was submitted and only "return to the game" afterward - so it can't be seeded
    // from a snapshot taken right before that one player's own submit. Instead it's derived
    // straight from the Shipyard's own permanent record: hasTriggeredScrappingEvent/
    // alienTileRevealed (model/shipyard.ts) mark a section as resolved forever, and
    // scrapCargoLossByCorporation (recorded once, permanently, by applyScrappingEvent) plus
    // alienTileChevrons (already always-visible, not Visibility-hidden - see
    // DividendChartPanel's pendingAlienMiningCapacityReveal comment) are enough to reconstruct
    // exactly what each affected Corporation's CARGO / the Alien Corporation's Mining Capacity
    // was immediately BEFORE, purely from current, already-shared game state - no history replay
    // needed, no per-action snapshot needed, works identically for the player who triggered it
    // and for one who loads the game fresh a week later.
    //
    // "Already seen" is saved to the player's account (SeenOverlays), scoped per game, since it's purely a per-viewer
    // dramatic-pacing concern, not gameplay state - nothing here is shared or persisted
    // server-side.
    //
    // Mounted once, at the very top of GameTable.svelte (a sibling of DefaultTableLayout, not
    // nested inside the TabWorkspace/ActionPanel like the rest of the game's panels) so it truly
    // covers the whole screen regardless of which workspace tab happens to be active.
    import { untrack } from 'svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SeenOverlays } from '$lib/model/seenOverlays.svelte.js'
    import type { StellarVenturesGameSession } from '$lib/model/session.svelte.js'
    import { type CorporationId } from '@tabletop/stellar-ventures'
    import DividendChartPanel from './DividendChartPanel.svelte'
    import alienTile0 from '$lib/images/shipyard/alienTile0.png'
    import alienTile1 from '$lib/images/shipyard/alienTile1.png'
    import alienTile2 from '$lib/images/shipyard/alienTile2.png'
    import alienTile3 from '$lib/images/shipyard/alienTile3.png'
    import alienTileHidden from '$lib/images/shipyard/alienTileHidden.png'

    // Same Alien Shipyard Tile art ShipyardPanel.svelte itself uses (its own AlienTileRevealedIcons -
    // duplicated here rather than imported/shared, same as agreementTileDisplay.ts's own separate
    // copy of these same source images for the unrelated Alien Agreement Tile). Chevron count is
    // already always-visible, permanent state the instant a Scrapping Event resolves (see this
    // file's own top comment), so there's nothing to reconstruct - just look it up.
    // 0 is the alien head with a red X - without it a 0-chevron tile fell back to the face-down
    // back art, so the reveal looked like nothing had flipped.
    const AlienTileRevealedIcons: Record<number, string> = {
        0: alienTile0,
        1: alienTile1,
        2: alienTile2,
        3: alienTile3
    }
    const ALIEN_TILE_ASPECT = 391 / 451

    const gameSession = getGameSession()

    // Every Shipyard section that has ever triggered a REAL Scrapping Event on its first Ship
    // Ordered (section.hasTriggeredScrappingEvent - see operations/shipOrdering.ts's
    // resolveFirstShipOrderedEffects), oldest (lowest level) first - if more than one is
    // unacknowledged at once (a returning player who missed several), they queue up and are
    // shown one at a time rather than all at once. Deliberately excludes a section whose only
    // effect was flipping its Alien Shipyard Tile (alienTileRevealed) with no Scrap alongside it
    // - Level 2 on the Alpha map is exactly this case (an Alien Tile but no scrapTargetLevel) -
    // since there's nothing scrapped to dramatize and no other reveal moment for a bare Alien
    // Tile flip exists yet; that Mining Capacity change still lands for real, it's just not
    // paced behind this particular overlay.
    const resolvedSections = $derived(
        [...gameSession.gameState.shipyard.sections]
            .filter((section) => section.hasTriggeredScrappingEvent)
            .sort((a, b) => a.level - b.level)
    )

    const storageKey = `stellar-ventures-seen-first-ship-ordered-reveals-${gameSession.gameState.gameId}`

    // Saved to the player's account, so a reveal watched on one device doesn't replay on another.
    const seenOverlays = new SeenOverlays(gameSession as StellarVenturesGameSession)

    function loadSeenLevels(): Set<number> {
        try {
            const raw = seenOverlays.get(storageKey)
            return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
        } catch {
            return new Set()
        }
    }

    function saveSeenLevels(levels: Set<number>) {
        seenOverlays.set(storageKey, JSON.stringify([...levels]))
    }

    let seenLevels: Set<number> = $state(loadSeenLevels())
    // Picks up the account copy once it loads (or changes on another device).
    $effect(() => {
        const stored = loadSeenLevels()
        const current = untrack(() => seenLevels)
        if ([...stored].some((level) => !current.has(level))) {
            seenLevels = new Set([...current, ...stored])
        }
    })

    function markSeen(level: number) {
        const next = new Set(seenLevels)
        next.add(level)
        seenLevels = next
        saveSeenLevels(next)
    }

    const pendingSection = $derived(
        seenOverlays.ready
            ? resolvedSections.find((section) => !seenLevels.has(section.level))
            : undefined
    )

    // Reconstructs exactly what changed for the pending section - undefined fields mean "nothing
    // to show for that half" (e.g. a section with an Alien Tile but no Scrap Target, or an old
    // section that resolved before scrapCargoLossByCorporation existed, for which there's simply
    // no loss data to reconstruct with).
    const reveal = $derived.by(() => {
        const section = pendingSection
        if (!section) {
            return undefined
        }

        const cargoBefore: Partial<Record<CorporationId, number>> = {}
        if (section.scrapCargoLossByCorporation) {
            for (const [corporationId, loss] of Object.entries(section.scrapCargoLossByCorporation)) {
                if (loss > 0) {
                    const corporation = gameSession.gameState.corporations.find((c) => c.id === corporationId)
                    if (corporation) {
                        cargoBefore[corporation.id] = corporation.cargo + loss
                    }
                }
            }
        }

        const alienMiningCapacityBefore =
            section.alienTileRevealed && section.alienTileChevrons !== undefined
                ? gameSession.gameState.alienCorporation.miningCapacity - section.alienTileChevrons * 3
                : undefined

        return {
            level: section.level,
            cargoBefore,
            affectedCorporationIds: Object.keys(cargoBefore) as CorporationId[],
            alienMiningCapacityBefore
        }
    })

    const hasAnythingToShow = $derived(
        !!reveal && (reveal.affectedCorporationIds.length > 0 || reveal.alienMiningCapacityBefore !== undefined)
    )

    // A section can be "resolved" with nothing left to actually show (an old one from before
    // scrapCargoLossByCorporation existed, or one whose Scrap happened to remove 0 CARGO from
    // everyone) - silently mark those seen without ever popping up an empty overlay.
    $effect(() => {
        if (pendingSection && reveal && !hasAnythingToShow) {
            markSeen(pendingSection.level)
        }
    })

    // Each affected Corporation's CARGO token slides down individually, one at a time (not all
    // at once). THEN, if this section also has an Alien Shipyard Tile to reveal, the Alien Tile
    // itself overlays the chart face-down, flips over to show its real chevron count, and only
    // once that's settled does the Alien Corporation's own Mining Capacity marker finally slide
    // up - so the tile flip reads as the actual REASON the marker is about to move, rather than
    // the marker just jumping on its own. Paced with real gaps between each step so every one
    // reads as its own distinct moment rather than one instant jumble.
    // DividendChartPanel's own existing marker transition (left/top, 150ms ease) is what
    // actually animates each cargo/mining step once its override is released; the Tile's own two
    // stages (tileStage 'facedown' -> 'revealed') drive its own entrance/flip CSS below instead.
    const INITIAL_DELAY_MS = 1100
    const CARGO_STEP_DELAY_MS = 1400
    const TILE_APPEAR_DELAY_MS = 900
    const TILE_FLIP_DELAY_MS = 1300
    const ALIEN_STEP_DELAY_MS = 1000

    let releasedCorporationIds: CorporationId[] = $state([])
    let tileStage: 'hidden' | 'facedown' | 'revealed' = $state('hidden')
    let alienReleased = $state(false)

    // Which pending section's reveal sequence is currently running/finished, tracked by its
    // stable level number rather than by the `reveal` object itself. `reveal` is a fresh object
    // literal every time its own $derived.by recomputes - which happens on ANY unrelated
    // gameState update (gameSession.gameState is replaced wholesale on every sync, even from
    // other players' actions elsewhere), not just when a genuinely new section becomes pending.
    // Without this guard, a background sync arriving mid-reveal reran this whole effect, which
    // unconditionally reset tileStage back to 'hidden' and rescheduled every timer from scratch -
    // so the Alien Tile flip kept getting cut off and restarted before the President ever saw the
    // revealed face, reading as "it just flips around and shows the back of the tile again."
    let animatedLevel: number | undefined = $state(undefined)

    $effect(() => {
        const r = hasAnythingToShow ? reveal : undefined
        if (!r) {
            animatedLevel = undefined
            releasedCorporationIds = []
            tileStage = 'hidden'
            alienReleased = false
            return
        }
        if (animatedLevel === r.level) {
            // Same section still pending - just an unrelated gameState update producing a new
            // `reveal` object with identical content. Leave the in-progress/finished animation
            // alone instead of restarting it.
            return
        }
        animatedLevel = r.level
        releasedCorporationIds = []
        tileStage = 'hidden'
        alienReleased = false

        let cancelled = false
        const timers: ReturnType<typeof setTimeout>[] = []
        function schedule(fn: () => void, delay: number) {
            timers.push(
                setTimeout(() => {
                    if (!cancelled) fn()
                }, delay)
            )
        }

        let delay = INITIAL_DELAY_MS
        for (const corporationId of r.affectedCorporationIds) {
            schedule(() => {
                releasedCorporationIds = [...releasedCorporationIds, corporationId]
            }, delay)
            delay += CARGO_STEP_DELAY_MS
        }
        if (r.alienMiningCapacityBefore !== undefined) {
            delay += TILE_APPEAR_DELAY_MS
            schedule(() => {
                tileStage = 'facedown'
            }, delay)
            delay += TILE_FLIP_DELAY_MS
            schedule(() => {
                tileStage = 'revealed'
            }, delay)
            schedule(() => {
                alienReleased = true
            }, delay + ALIEN_STEP_DELAY_MS)
        }

        return () => {
            cancelled = true
            for (const timer of timers) clearTimeout(timer)
        }
    })

    const alienTileChevrons = $derived(pendingSection?.alienTileChevrons)

    const cargoOverridesToShow = $derived.by(() => {
        if (!reveal) return undefined
        const result: Partial<Record<CorporationId, number>> = {}
        for (const corporationId of reveal.affectedCorporationIds) {
            if (!releasedCorporationIds.includes(corporationId)) {
                result[corporationId] = reveal.cargoBefore[corporationId]
            }
        }
        return result
    })

    function dismiss() {
        if (pendingSection) {
            markSeen(pendingSection.level)
        }
    }
</script>

{#if hasAnythingToShow && reveal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div
            class="flex max-h-full w-full max-w-md flex-col gap-3 rounded-xl border border-[#3a4166] bg-[#0b0e1a] p-4 text-[#e6e9f5] shadow-2xl"
        >
            <div class="text-center text-lg font-bold">Scrapping Event</div>
            <div class="relative min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#2a2f45]">
                <DividendChartPanel
                    cargoOverrides={cargoOverridesToShow}
                    alienMiningCapacityOverride={alienReleased ? undefined : reveal.alienMiningCapacityBefore}
                />
                {#if tileStage !== 'hidden' && alienTileChevrons !== undefined}
                    <!-- The Alien Shipyard Tile itself, overlaying the chart - appears face-down
                         first (tile-appear), then flips to its real chevron count
                         (reveal-flip, keyed on src so remounting the <img> replays the flip)
                         right before the Alien marker below actually moves, so the flip reads as
                         the reason it's about to. -->
                    <div class="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-[#0b0e1a]/70">
                        {#key tileStage}
                            <img
                                src={tileStage === 'revealed'
                                    ? (AlienTileRevealedIcons[alienTileChevrons] ?? alienTileHidden)
                                    : alienTileHidden}
                                alt={tileStage === 'revealed'
                                    ? `Alien Shipyard Tile - ${alienTileChevrons} chevron${alienTileChevrons === 1 ? '' : 's'}`
                                    : 'Alien Shipyard Tile - hidden'}
                                class="h-32 w-auto rounded-lg shadow-2xl {tileStage === 'facedown'
                                    ? 'tile-appear'
                                    : 'reveal-flip'}"
                                style="aspect-ratio: {ALIEN_TILE_ASPECT};"
                            />
                        {/key}
                    </div>
                {/if}
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
    /* The Alien Shipyard Tile's own two-stage entrance: pops in face-down first (tile-appear),
       then - once flipped to 'revealed' - replays the same cheap dependency-free flip
       OfferSignTheAgreementPanel/OfferSecretAgentsChoicePanel/HostileTakeoverRevealOverlay all
       use for their own reveals (a scaleX collapse-and-restore keyed on the image's own src, so
       remounting via {#key} is what replays it here too). */
    .tile-appear {
        animation: tile-appear 0.4s ease-out;
    }
    @keyframes tile-appear {
        0% {
            transform: scale(0.6);
            opacity: 0;
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }

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
