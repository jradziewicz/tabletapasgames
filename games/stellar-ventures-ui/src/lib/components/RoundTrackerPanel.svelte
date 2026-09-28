<script lang="ts">
    import { MachineState } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeGamePhase } from '$lib/utils/phaseLabel.js'
    import roundTrackerArt from '$lib/images/trackers/roundTracker.png'
    import eraTrackerToken from '$lib/images/trackers/eraTracker.png'
    import roundFlowMarker from '$lib/images/trackers/roundFlowMarker.png'

    const gameSession = getGameSession()

    const era = $derived(gameSession.gameState.era)
    const machineState = $derived(gameSession.gameState.machineState)
    const phase = $derived(describeGamePhase(gameSession.gameState))

    // The printed reference card's Era track only ever shows Eras 1-5 (Era 3's own Amethyst
    // Agency formation and Era 5's Corporation-Round-only ending are baked into the art itself as
    // the purple/red rings) - clamp so a still-mid-Initial-Auction era value (or anything else
    // unexpected) never tries to place the token on a 6th circle that isn't on the card.
    const highlightedEra = $derived(era >= 1 && era <= 5 ? era : undefined)

    // Center-x of each Era circle, measured directly off the card art (percent of the art's own
    // width, so it stays correct at any render size). Re-measured for the Borders & Taxes-era
    // reference card (2480x1329, same layout as the original 1579x870 Alpha-only card plus a
    // Pay Taxes step in the Administration column) - evenly spaced ~208px apart at that
    // resolution starting at circle 1's center.
    const ERA_CIRCLE_LEFT_PCT: Record<number, number> = {
        1: 8.45,
        2: 16.84,
        3: 25.23,
        4: 33.61,
        5: 42.0
    }
    const ERA_CIRCLE_TOP_PCT = 14.73

    // eraTracker.png (the co-designer's own wooden Era Tracker token, extracted from page 37 of
    // the Trackers & Agreement reference PDF) isn't a simple centered circle - it's a 3D coin
    // render whose drop shadow bulks out its bottom-left, so the coin's own visual center sits
    // off from the asset's geometric center (measured directly off the token art itself: the
    // coin's dark face circle is centered at ~53.5%/44.4% of the asset's own width/height, not
    // 50%/50%). ERA_TOKEN_ANCHOR below is that offset, used in place of a plain -50%/-50%
    // translate so the coin's face - not the shadow - lands exactly on the Era circle above.
    const ERA_TOKEN_ANCHOR = { x: 53.5, y: 48 }
    const ERA_TOKEN_WIDTH_PCT = 8.0

    // Same story for roundFlowMarker.png (the blank wooden peg from page 36) - its top face
    // (the part that should land on an icon below) is centered at ~60.9%/35.3% of its own
    // bounding box, well off from center. Anchoring exactly on that top-face center still let
    // the peg's own shadow/cylinder tail (which hangs down and slightly left of the face) poke
    // out past the card's small icon circles - per the co-designer, nudged up and to the right
    // from the raw top-face-center numbers above so the whole peg (tail included) sits fully
    // inside the circle it's marking.
    const FLOW_MARKER_ANCHOR = { x: 45, y: 58 }
    const FLOW_MARKER_WIDTH_PCT = 4.5

    // Which of the printed card's 5 round-flow marker positions (if any) the current
    // MachineState corresponds to - mapped directly off the actual MachineState (per the
    // co-designer: one shared space for the whole Corporation Round, Release Dividends and
    // Boardroom Battle each get their own space, one shared space for Investor Action/Alien Tech
    // Action, and the rest of the printed Administration column - Scrap Lowest Value Ship,
    // Deliver Ordered Ships, Assign Corporate Turn Order, Pass Director, Advance Era - shares one
    // last space since those steps "move quickly"). This is deliberately its own mapping rather
    // than reusing phaseLabel.ts's CORPORATION_ROUND_STATES/ADMINISTRATION_ROUND_STATES (which
    // group ScrapLowestShip/DeliverShips under "Corporation Round" for Header.svelte's own
    // "whose turn is it" breadcrumb purposes - a different job than matching this card's actual
    // printed columns).
    type FlowSlot = 'corporation' | 'releaseDividends' | 'boardroom' | 'investorAlienTech' | 'administration'
    const CORPORATION_SLOT_STATES = new Set<MachineState>([
        MachineState.IssueShare,
        MachineState.ExpandNetworkOrWormhole,
        MachineState.PayDividends,
        MachineState.OrderShips,
        MachineState.OfferSignTheAgreement,
        MachineState.OfferSecretAgentsChoice,
        MachineState.OfferTaxAgentsChoice,
        MachineState.OfferSpareParts
    ])
    const ADMINISTRATION_SLOT_STATES = new Set<MachineState>([
        MachineState.ScrapLowestShip,
        MachineState.DeliverShips,
        MachineState.AssignTurnOrder,
        MachineState.PayTaxes,
        MachineState.FormAmethystAgency
    ])
    const activeFlowSlot = $derived.by((): FlowSlot | undefined => {
        if (CORPORATION_SLOT_STATES.has(machineState)) return 'corporation'
        if (machineState === MachineState.ReleaseDividends) return 'releaseDividends'
        if (machineState === MachineState.BoardroomBattle) return 'boardroom'
        if (machineState === MachineState.InvestorAction || machineState === MachineState.AlienTechAction) {
            return 'investorAlienTech'
        }
        if (ADMINISTRATION_SLOT_STATES.has(machineState)) return 'administration'
        if (machineState === MachineState.DraftPower) {
            // Draft Power is reached both right after an Initial Auction win (not part of the
            // printed Round flow at all) and mid-Corporation Round (Sign The Agreement's
            // replacement pick) - only the latter belongs on this card.
            return gameSession.gameState.draftPowerResumeState === MachineState.InitialAuction
                ? undefined
                : 'corporation'
        }
        // Initial Auction, Liquidation, and Game Over aren't part of the printed Round flow.
        return undefined
    })

    // Center of each marker position, measured directly off the card art (percent of its own
    // width/height, so it stays correct at any render size) - the Corporation Round position is
    // its shared gear/bracket icon,
    // Administration's is the vertical midpoint of its own 5-icon column (since one space covers
    // all of it), and the rest are each step's own icon.
    const FLOW_SLOT_PCT: Record<FlowSlot, { left: number; top: number }> = {
        corporation: { left: 3.75, top: 64.77 },
        releaseDividends: { left: 37.68, top: 45.42 },
        boardroom: { left: 37.59, top: 60.06 },
        investorAlienTech: { left: 36.46, top: 78.1 },
        administration: { left: 70.3, top: 67.4 }
    }
</script>

<div class="h-full overflow-y-auto p-4 text-[#e6e9f5]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">Round Tracker</h2>

    <!-- Same "overlay live state on the printed reference art" convention AgreementPanel.svelte
         uses for its own track - the art is static, so the current Era and current Round marker
         positions are the only "moving parts" this tab needs to add on top of it. Per the
         co-designer, the full-width card read as oversized for this tab compared to its
         neighbors - w-1/2 (rather than shrinking the source art itself) keeps every overlay
         above still lined up, since they're all positioned as percentages of this same wrapping
         div. -->
    <div class="relative w-1/2 overflow-hidden rounded-lg">
        <img src={roundTrackerArt} alt="Round Tracker" class="block w-full" />

        {#if highlightedEra}
            <img
                src={eraTrackerToken}
                alt="Current Era ({highlightedEra})"
                title="Current Era ({highlightedEra})"
                class="pointer-events-none absolute drop-shadow-lg"
                style="left: {ERA_CIRCLE_LEFT_PCT[
                    highlightedEra
                ]}%; top: {ERA_CIRCLE_TOP_PCT}%; width: {ERA_TOKEN_WIDTH_PCT}%; transform: translate(-{ERA_TOKEN_ANCHOR.x}%, -{ERA_TOKEN_ANCHOR.y}%);"
            />
        {/if}

        {#if activeFlowSlot}
            {@const slot = FLOW_SLOT_PCT[activeFlowSlot]}
            <img
                src={roundFlowMarker}
                alt="Current Round Step"
                title="Current Round Step"
                class="pointer-events-none absolute drop-shadow-lg"
                style="left: {slot.left}%; top: {slot.top}%; width: {FLOW_MARKER_WIDTH_PCT}%; transform: translate(-{FLOW_MARKER_ANCHOR.x}%, -{FLOW_MARKER_ANCHOR.y}%);"
            />
        {/if}
    </div>
</div>
