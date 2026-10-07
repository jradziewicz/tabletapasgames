<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionType,
        AlienTechActionId,
        CorporatePowerId,
        effectiveMiningCapacityForCorporation,
        type CorporationId
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporationDisplayNames, CorporationLogoIcons, CorporationLogoAspect } from '$lib/utils/corporationDisplay.js'
    import { InvestorActionDiscIcons } from '$lib/utils/investorDisplay.js'
    import alienTechActionRow from '$lib/images/investor/alienTechActionRow.png'
    import alienTechCube from '$lib/images/investor/alienTechCube.png'
    import LeakedResearchConfirmPanel from './LeakedResearchConfirmPanel.svelte'
    import AlienEngineeringPanel from './AlienEngineeringPanel.svelte'

    const gameSession = getGameSession()

    // Investor Shenanigans (rulebook page 19), Alien Tech Action half - always immediately after
    // this same player's Investor Action (InvestorActionPanel.svelte, which that file's own
    // comment explains further). Same co-designer player-mats art (page 2 this time), same
    // mirrors-onto-the-Investor-Board-tab relationship via playerState.lastAlienTechActionId.
    const currentPlayerId = $derived(gameSession.gameState.investorShenanigansCurrentPlayerId)
    const currentPlayerState = $derived(
        currentPlayerId
            ? gameSession.gameState.players.find((p) => p.playerId === currentPlayerId)
            : undefined
    )
    const myTurn = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === currentPlayerId)
    const canAct = $derived(myTurn && !gameSession.busy && !gameSession.isViewingHistory)
    // Same one marker per player as InvestorActionPanel/InvestorBoard.svelte - matched to their
    // Color, not a fixed image, and shared across both rows.
    const discIcon = $derived(
        currentPlayerId ? InvestorActionDiscIcons[gameSession.colors.getPlayerColor(currentPlayerId)] : undefined
    )

    // Circle centers measured directly off the row art (same method as InvestorActionPanel) -
    // left-to-right as printed: Cargo Boost, Research Wormhole, Develop Planet(s), Launder.
    const CIRCLES: {
        discId: AlienTechActionId
        actionType: ActionType
        left: number
        label: string
        wired: boolean
    }[] = [
        {
            discId: AlienTechActionId.CargoBoost,
            actionType: ActionType.CargoBoost,
            left: 17.18,
            label: 'Cargo Boost',
            wired: true
        },
        {
            discId: AlienTechActionId.ResearchWormhole,
            actionType: ActionType.ResearchWormhole,
            left: 41.54,
            label: 'Research Wormhole',
            wired: true
        },
        {
            discId: AlienTechActionId.DevelopPlanets,
            actionType: ActionType.DevelopPlanets,
            left: 65.89,
            label: 'Develop Planet(s)',
            wired: true
        },
        {
            discId: AlienTechActionId.Launder,
            actionType: ActionType.Launder,
            left: 90.23,
            label: 'Launder',
            wired: true
        }
    ]
    const CIRCLE_TOP = 60.45
    const CIRCLE_DIAM = 78.67 // measured off the row art's own printed circles (connected-components on their [112,118,123] fill), as % of the row's own height

    // The row art is much wider than it is tall, so a button sized to the SAME percentage
    // of both width and height renders as an oval, not a circle - convert CIRCLE_DIAM's
    // height percentage into the width percentage that covers the same number of actual
    // pixels, given the row's own aspect ratio, so the click target (and its ring) is a
    // true circle sitting exactly over the printed one.
    const ROW_ASPECT = 7173 / 947
    const CIRCLE_WIDTH_PCT = CIRCLE_DIAM / ROW_ASPECT

    // A Corporation's own Charter art has exactly 2 physical "Cargo" cube slots printed on it
    // (CorporationCharter.svelte's own CARGO_CUBE_CENTERS) - once both are filled, there's
    // nowhere left to physically place another cube, so per the co-designer a Corporation
    // already holding 2 shouldn't be offered as a target any more (the engine itself doesn't
    // enforce this cap - see cargoBoost.ts's own doc comment on a "wasted" boost past MAX_CARGO
    // being legal - this is specifically about the Charter's own physical cube slots running out,
    // a separate, always-true limit regardless of that Corporation's current CARGO value).
    const MAX_CARGO_BOOST_CUBES_ON_CHARTER = 2

    // Cargo Boost needs a Corporation this player holds Shares in (any amount) + 1 or 2 cubes,
    // and Charter room left for at least 1 more cube (see MAX_CARGO_BOOST_CUBES_ON_CHARTER above).
    const cargoBoostCorporations = $derived.by(() => {
        if (!currentPlayerId) return []
        return gameSession.gameState.corporations.filter(
            (c) =>
                c.active &&
                c.shareCountForPlayer(currentPlayerId) > 0 &&
                (c.cargoBoostCubesOnCharter ?? 0) < MAX_CARGO_BOOST_CUBES_ON_CHARTER
        )
    })
    // Research Wormhole needs a Corporation this player holds Shares in that doesn't already
    // have Wormhole Technology active.
    const researchWormholeCorporations = $derived.by(() => {
        if (!currentPlayerId) return []
        return gameSession.gameState.corporations.filter(
            (c) => c.active && !c.wormholeActive && c.shareCountForPlayer(currentPlayerId) > 0
        )
    })
    const playerAlienTechCubes = $derived(currentPlayerState?.alienTechCubes ?? 0)

    // Leaked Research (Corporate Power Glossary, page 29): "Anytime, One-Time. President may
    // perform Research Wormhole as a free action for this Corporation, still spending Alien
    // Technology as normal." "Free" means this doesn't cost the President their once-per-
    // Investor-Round Alien Tech Action slot - unlike ResearchWormhole above (one of the 4 fixed
    // discs, which DOES consume the Action Disc for the round), this renders as its own
    // always-visible button with no disc animation, and doesn't touch placingDiscId/
    // lastAlienTechActionId at all. Exactly one eligible Corporation - this player's own
    // presided Corporation still holding the power - so no picker needed either.
    const leakedResearchCorporation = $derived.by(() => {
        if (!currentPlayerId) return undefined
        return gameSession.gameState.corporations.find(
            (c) =>
                c.active &&
                c.hasActivePower(CorporatePowerId.LeakedResearch) &&
                c.getPresidentPlayerId() === currentPlayerId
        )
    })

    // Per the co-designer, clicking Activate brings up the Power Tile first
    // (leakedResearchConfirming) rather than submitting immediately - see
    // LeakedResearchConfirmPanel.svelte.
    let leakedResearchConfirming = $state(false)

    async function confirmLeakedResearch() {
        leakedResearchConfirming = false
        if (!leakedResearchCorporation) return
        await gameSession.leakedResearch(leakedResearchCorporation.id)
    }

    $effect(() => {
        if (leakedResearchConfirming && !leakedResearchCorporation) {
            leakedResearchConfirming = false
        }
    })

    // Develop Planet(s) has no Corporation to pick - clicking its circle goes straight into
    // "selecting hexes on the map" mode (gameSession.boardActionMode doubles as that signal -
    // see Board.svelte's canDevelopPlanets), submitted as one batch once the player's happy
    // with their picks, unlike every other action here which submits immediately on click.
    const developPlanetsActive = $derived(gameSession.boardActionMode === ActionType.DevelopPlanets)
    const developPlanetsSelectedCount = $derived(gameSession.developPlanetsHexIds.length)
    const developPlanetsCubesRemaining = $derived(playerAlienTechCubes - developPlanetsSelectedCount)

    // Corporations whose Mining Capacity would actually change from the Neutral Planets
    // currently queued to develop (rulebook page 19: "This permanently doubles the planet's
    // Value. Adjust Mining Capacity for all Corporations" - but doubling a hex's Value only
    // benefits a Corporation that actually has an Outpost sitting on it - see
    // HydratedBoardState.miningCapacityForCorporation). Summed across every selected hex, since
    // a Neutral Planet can hold up to 2 Corporations' Outposts at once (Outpost Restrictions)
    // and a single Corporation could hold Outposts on several of the selected hexes. The gain
    // per hex is exactly hex.baseValue - developPlanets.ts only ever targets a hex that isn't
    // already valueDoubled, so doubling always adds one more baseValue, never less.
    const developPlanetsImpactedCorporations = $derived.by(() => {
        if (developPlanetsSelectedCount === 0) return []
        const board = gameSession.gameState.board
        const gainByCorporationId = new Map<CorporationId, number>()
        for (const hexId of gameSession.developPlanetsHexIds) {
            const hex = board.requireHex(hexId)
            for (const corporationId of hex.outposts) {
                gainByCorporationId.set(
                    corporationId,
                    (gainByCorporationId.get(corporationId) ?? 0) + (hex.baseValue ?? 0)
                )
            }
        }
        return gameSession.gameState.corporations
            .filter((corporation) => gainByCorporationId.has(corporation.id))
            .map((corporation) => ({
                corporationId: corporation.id,
                miningCapacity: effectiveMiningCapacityForCorporation(gameSession.gameState, corporation.id),
                gain: gainByCorporationId.get(corporation.id) ?? 0
            }))
    })

    let cargoBoostCorporationId: CorporationId | undefined = $state()
    // How many more cubes the selected Corporation's Charter has physical room for (see
    // MAX_CARGO_BOOST_CUBES_ON_CHARTER above) - a Corporation already at 1 (not yet excluded
    // from the picker entirely) only has room for 1 more, so "Spend 2 cubes" needs disabling
    // there even though the Corporation itself is still offered.
    const cargoBoostRemainingCapacity = $derived.by(() => {
        if (!cargoBoostCorporationId) return MAX_CARGO_BOOST_CUBES_ON_CHARTER
        const corporation = gameSession.gameState.getCorporation(cargoBoostCorporationId)
        return MAX_CARGO_BOOST_CUBES_ON_CHARTER - (corporation.cargoBoostCubesOnCharter ?? 0)
    })
    // Optimistic "the disc is landing here" override, set the instant an action is chosen
    // and cleared only once the real submit resolves - so the disc visibly lands on its new
    // spot before ActionPanel swaps this whole panel out for whatever comes next (mirrors
    // InvestorActionPanel's own placingDiscId).
    let placingDiscId: AlienTechActionId | undefined = $state()

    // Once the player has started choosing an Alien Tech Action (a picker is open) or is mid-
    // Develop Planet(s), passing isn't a meaningful option any more - hide it until they back
    // out (re-click the same circle, Cancel, or Undo).
    const actionSelectionInProgress = $derived(
        gameSession.alienTechPickerOpen !== undefined || developPlanetsActive
    )

    function isOffered(actionType: ActionType) {
        return gameSession.validActionTypes.includes(actionType)
    }

    async function clickCircle(circle: (typeof CIRCLES)[number]) {
        if (!canAct || !isOffered(circle.actionType) || developPlanetsActive) return

        if (circle.discId === AlienTechActionId.CargoBoost) {
            cargoBoostCorporationId = undefined
            gameSession.alienTechPickerOpen = gameSession.alienTechPickerOpen === AlienTechActionId.CargoBoost ? undefined : AlienTechActionId.CargoBoost
        } else if (circle.discId === AlienTechActionId.ResearchWormhole) {
            gameSession.alienTechPickerOpen =
                gameSession.alienTechPickerOpen === AlienTechActionId.ResearchWormhole ? undefined : AlienTechActionId.ResearchWormhole
        } else if (circle.discId === AlienTechActionId.Launder) {
            gameSession.alienTechPickerOpen = gameSession.alienTechPickerOpen === AlienTechActionId.Launder ? undefined : AlienTechActionId.Launder
        } else if (circle.discId === AlienTechActionId.DevelopPlanets) {
            gameSession.alienTechPickerOpen = undefined
            placingDiscId = AlienTechActionId.DevelopPlanets
            await new Promise((resolve) => setTimeout(resolve, 600))
            placingDiscId = undefined
            gameSession.boardActionMode = ActionType.DevelopPlanets
        }
    }

    async function chooseCargoBoost(amount: number) {
        if (!cargoBoostCorporationId) return
        gameSession.alienTechPickerOpen = undefined
        placingDiscId = AlienTechActionId.CargoBoost
        await new Promise((resolve) => setTimeout(resolve, 600))
        try {
            await gameSession.cargoBoost(cargoBoostCorporationId, amount)
        } finally {
            placingDiscId = undefined
        }
    }

    async function chooseResearchWormhole(corporationId: CorporationId) {
        gameSession.alienTechPickerOpen = undefined
        placingDiscId = AlienTechActionId.ResearchWormhole
        await new Promise((resolve) => setTimeout(resolve, 600))
        try {
            await gameSession.researchWormhole(corporationId)
        } finally {
            placingDiscId = undefined
        }
    }

    async function chooseLaunder(amount: number) {
        gameSession.alienTechPickerOpen = undefined
        placingDiscId = AlienTechActionId.Launder
        await new Promise((resolve) => setTimeout(resolve, 600))
        try {
            await gameSession.launder(amount)
        } finally {
            placingDiscId = undefined
        }
    }

    async function submitDevelopPlanets() {
        await gameSession.developPlanets()
    }

    function cancelDevelopPlanets() {
        gameSession.cancelDevelopPlanets()
    }

    async function pass() {
        await gameSession.passAlienTechAction()
    }
</script>

<!-- Fixed min-height, shared with InvestorActionPanel.svelte's own wrapper (keep these two
     in sync) - see that file's comment for why. -->
<div class="space-y-2 sm:min-h-[22rem] px-4 py-2 text-[#e6e9f5]">
    <div class="flex items-center justify-between text-sm">
        <span class="font-semibold">Alien Tech Action</span>
        {#if currentPlayerId}
            <span class="text-[#7f88ad]">
                {#if myTurn}Your turn{:else}Waiting on <PlayerName playerId={currentPlayerId} />...{/if}
            </span>
        {/if}
    </div>

    <!-- Same "the row art is only for CHOOSING an action" rule InvestorActionPanel follows -
         once Develop Planet(s) is chosen, it gives way to the hex-selection status box below. -->
    {#if !developPlanetsActive}
        <div class="flex flex-wrap items-center gap-3">
            <!-- Full-width on phones, like InvestorActionPanel's row: at 34.5% of a phone screen the
                 row art and its click circles were an unreadable, barely tappable sliver. -->
            <div class="relative w-full shrink-0 overflow-hidden rounded-lg sm:w-[34.5%]" style="aspect-ratio: {7173 / 947};"> <!-- Matched to InvestorActionPanel.svelte row art sizing (34.5% of the original full-width row art) so the two panels come out the same overall size - keep these two in sync, including overflow-hidden + rounded-lg for the row art corners. -->
                <img src={alienTechActionRow} alt="Alien Tech Action" class="absolute inset-0 h-full w-full" />

                {#each CIRCLES as circle (circle.discId)}
                    {@const offered =
                        canAct &&
                        isOffered(circle.actionType) &&
                        circle.wired &&
                        !developPlanetsActive &&
                        // Cargo Boost's own Charter-physical-slot cap
                        // (MAX_CARGO_BOOST_CUBES_ON_CHARTER below) is stricter than what the
                        // engine's own canOfferCargoBoost checks (just "holds any Share
                        // somewhere") - per the co-designer, don't let a player click into this
                        // circle at all if every Corporation they hold Shares in already has no
                        // physical room left, rather than clicking through to an empty picker.
                        (circle.discId !== AlienTechActionId.CargoBoost ||
                            cargoBoostCorporations.length > 0)}
                    <button
                        type="button"
                        disabled={!offered}
                        onclick={() => clickCircle(circle)}
                        aria-label={circle.label}
                        class="absolute rounded-full transition-colors {offered
                            ? 'cursor-pointer ring-2 ring-transparent hover:ring-[#3ddc84]'
                            : 'cursor-default'}"
                        style="left: {circle.left}%; top: {CIRCLE_TOP}%; height: {CIRCLE_DIAM}%; width: {CIRCLE_WIDTH_PCT}%; transform: translate(-50%, -50%);"
                    ></button>

                    <!-- Same single-Action-Disc rule as InvestorActionPanel's own circles (see its
                         comment) - lastAlienTechActionId (old spot) and placingDiscId (new spot
                         being chosen right now) could independently match different circles
                         during the ~600ms placingDiscId window, rendering the disc twice. -->
                    {#if ((currentPlayerState?.lastAlienTechActionId === circle.discId && placingDiscId === undefined) || placingDiscId === circle.discId) && discIcon}
                        <img
                            src={discIcon}
                            alt="Alien Tech Action disc"
                            class="pointer-events-none absolute drop-shadow"
                            style="left: {circle.left}%; top: {CIRCLE_TOP}%; height: {CIRCLE_DIAM * 0.99}%; width: auto; transform: translate(-50%, -50%);"
                        />
                    {/if}
                {/each}
            </div>


            <!-- Off-board resting spot: the disc sits here (not on any action) once a player has
                 passed this round, or before they've taken an action yet this round - to the
                 right of the row art rather than stacked below it, now that the row art is
                 left-justified instead of centered. -->
            {#if currentPlayerState && !currentPlayerState.lastAlienTechActionId && !placingDiscId && discIcon}
                <div class="flex flex-col items-center gap-1 text-center text-xs text-[#7f88ad]">
                    <img src={discIcon} alt="Alien Tech Action disc (off board)" class="h-10 w-auto opacity-70" />
                    <span>Off board</span>
                </div>
            {/if}
        </div>

        <!-- The current voter's own Alien Tech Cubes, shown as the same physical-cube art used
             everywhere else (CorporationCharter/InvestorBoardPanel/Board.svelte) rather than a
             bare number, so it reads as a supply of pieces the way Outposts/Votes do elsewhere
             in this UI. Shown for every sub-step of this panel (the row above, and the Develop
             Planet(s) status box below), not just here. -->
        {#if currentPlayerState}
            <div class="flex flex-wrap items-center gap-1 pt-1 text-xs">
                <span class="mr-1 shrink-0 text-[10px] uppercase tracking-widest text-[#7f88ad]">
                    Alien Tech Cubes:
                </span>
                {#if playerAlienTechCubes > 0}
                    {#each { length: playerAlienTechCubes } as _, index (index)}
                        <img src={alienTechCube} alt="Alien Technology cube" class="h-5 w-5 shrink-0 drop-shadow" />
                    {/each}
                {:else}
                    <span class="text-[10px] text-[#7f88ad]">None</span>
                {/if}
            </div>
        {/if}
    {/if}

    <!-- Develop Planet(s) submits a whole hexIds batch at once, so picking happens on the map
         (Board.svelte highlights every still-eligible Neutral Planet and keeps confirmed picks
         lit up distinctly) while this status box just tracks the running Alien Tech Cube supply
         and (once at least 1 hex is picked) which Corporations it would actually affect, plus
         Submit/Cancel - Board.svelte's own click handler does the actual hex toggling. No
         instructional text here - the highlighted hexes on the map are the instruction. -->
    {#if developPlanetsActive}
        <div class="space-y-1.5 rounded-md border border-[#3a4166] bg-[#141833] p-2 text-xs">
            <div class="flex flex-wrap items-center gap-1">
                <span class="mr-1 shrink-0 text-[10px] uppercase tracking-widest text-[#7f88ad]">
                    Alien Tech Cubes:
                </span>
                {#if developPlanetsCubesRemaining > 0}
                    {#each { length: developPlanetsCubesRemaining } as _, index (index)}
                        <img src={alienTechCube} alt="Alien Technology cube" class="h-5 w-5 shrink-0 drop-shadow" />
                    {/each}
                {:else}
                    <span class="text-[10px] text-[#7f88ad]">None left</span>
                {/if}
            </div>

            <!-- Appears once at least 1 Neutral Planet is picked - one compact row per
                 Corporation that actually has an Outpost on any of the picked hexes (the only
                 Corporations whose Mining Capacity this would change), logo/name plus the
                 current figure and a green "(+X)" for how much doubling the picked hex(es)
                 would add - see developPlanetsImpactedCorporations above. -->
            {#if developPlanetsImpactedCorporations.length > 0}
                <div class="space-y-1 border-t border-[#232945] pt-1.5">
                    {#each developPlanetsImpactedCorporations as impact (impact.corporationId)}
                        {@const aspect = CorporationLogoAspect[impact.corporationId] ?? 1}
                        <div class="flex items-center gap-1.5 rounded-md border border-[#2a3155] bg-[#12162b] px-1.5 py-1">
                            <img
                                src={CorporationLogoIcons[impact.corporationId]}
                                alt=""
                                class="h-5 shrink-0 drop-shadow"
                                style="width: {20 * aspect}px;"
                            />
                            <span class="text-xs font-semibold text-[#e6e9f5]">
                                {CorporationDisplayNames[impact.corporationId]}
                            </span>
                            {#if impact.gain > 0}
                                <span class="text-xs font-semibold text-[#3ddc84]">(+{impact.gain})</span>
                            {/if}
                            <span class="ml-auto whitespace-nowrap text-[10px] text-[#7f88ad]">
                                Mining Capacity: {impact.miningCapacity}
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}

            <div class="flex gap-1.5 pt-1">
                <button
                    type="button"
                    disabled={developPlanetsSelectedCount === 0}
                    onclick={submitDevelopPlanets}
                    class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-40"
                >
                    Develop {developPlanetsSelectedCount} Planet{developPlanetsSelectedCount === 1 ? '' : '(s)'}
                </button>
                <button
                    type="button"
                    onclick={cancelDevelopPlanets}
                    class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
                >
                    Cancel
                </button>
            </div>
        </div>
    {/if}

    {#if gameSession.alienTechPickerOpen === AlienTechActionId.CargoBoost}
        <div class="space-y-1 rounded-md border border-[#3a4166] bg-[#141833] p-2">
            <div class="text-xs font-semibold">Add cubes to a Corporation's Charter (+1 CARGO each):</div>
            <!-- Same Corporation-picker card style as Jerry-Rig/Private Contractor/Research
                 Wormhole - logo + name rather than a plain text button - but this picker is a
                 two-step flow (pick a Corporation card first, THEN choose how many cubes to
                 spend below), so the selected card gets a highlighted border/background
                 instead of firing an action immediately on click. -->
            <div class="flex flex-wrap gap-2">
                {#each cargoBoostCorporations as corporation (corporation.id)}
                    <button
                        type="button"
                        onclick={() => (cargoBoostCorporationId = corporation.id)}
                        class="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition hover:brightness-110 {cargoBoostCorporationId ===
                        corporation.id
                            ? 'border-[#2f6fed] bg-[#182449]'
                            : 'border-[#2a3155] bg-[#12162b]'}"
                    >
                        <img
                            src={CorporationLogoIcons[corporation.id]}
                            alt=""
                            class="h-8 shrink-0 drop-shadow"
                            style="width: {32 * (CorporationLogoAspect[corporation.id] ?? 1)}px;"
                        />
                        <div class="text-sm font-semibold text-[#e6e9f5]">
                            {CorporationDisplayNames[corporation.id]}
                        </div>
                    </button>
                {/each}
                {#if cargoBoostCorporations.length === 0}
                    <div class="text-xs text-[#7f88ad]">No eligible Corporations.</div>
                {/if}
            </div>
            {#if cargoBoostCorporationId}
                <div class="flex gap-1.5 pt-1">
                    <button
                        type="button"
                        disabled={playerAlienTechCubes < 1 || cargoBoostRemainingCapacity < 1}
                        onclick={() => chooseCargoBoost(1)}
                        class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-40"
                    >
                        Spend 1 cube (+1 CARGO)
                    </button>
                    <button
                        type="button"
                        disabled={playerAlienTechCubes < 2 || cargoBoostRemainingCapacity < 2}
                        onclick={() => chooseCargoBoost(2)}
                        class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-40"
                    >
                        Spend 2 cubes (+2 CARGO)
                    </button>
                </div>
            {/if}
        </div>
    {/if}

    {#if gameSession.alienTechPickerOpen === AlienTechActionId.ResearchWormhole}
        <div class="space-y-1 rounded-md border border-[#3a4166] bg-[#141833] p-2">
            <div class="text-xs font-semibold">Activate Wormhole Technology for:</div>
            {#if researchWormholeCorporations.length === 0}
                <div class="text-xs text-[#7f88ad]">No eligible Corporations.</div>
            {/if}
            <!-- Same Corporation-picker card style as Investor Action's Jerry-Rig/Private
                 Contractor pickers (InvestorActionPanel.svelte) - logo + name rather than a
                 plain text button, per the co-designer. -->
            <div class="flex flex-wrap gap-2">
                {#each researchWormholeCorporations as corporation (corporation.id)}
                    <button
                        type="button"
                        onclick={() => chooseResearchWormhole(corporation.id)}
                        class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#2a3155] bg-[#12162b] px-2.5 py-1.5 text-left transition hover:brightness-110"
                    >
                        <img
                            src={CorporationLogoIcons[corporation.id]}
                            alt=""
                            class="h-8 shrink-0 drop-shadow"
                            style="width: {32 * (CorporationLogoAspect[corporation.id] ?? 1)}px;"
                        />
                        <div class="text-sm font-semibold text-[#e6e9f5]">
                            {CorporationDisplayNames[corporation.id]}
                        </div>
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    {#if gameSession.alienTechPickerOpen === AlienTechActionId.Launder}
        <div class="space-y-1 rounded-md border border-[#3a4166] bg-[#141833] p-2">
            <div class="text-xs font-semibold">Discard cubes for Liquid Funds:</div>
            <div class="flex gap-1.5">
                <button
                    type="button"
                    disabled={playerAlienTechCubes < 1}
                    onclick={() => chooseLaunder(1)}
                    class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-40"
                >
                    Discard 1 cube (+2 Credits)
                </button>
                <button
                    type="button"
                    disabled={playerAlienTechCubes < 2}
                    onclick={() => chooseLaunder(2)}
                    class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-40"
                >
                    Discard 2 cubes (+5 Credits)
                </button>
            </div>
        </div>
    {/if}

    {#if leakedResearchCorporation && !leakedResearchConfirming}
        <div class="flex items-center gap-2">
            <button
                type="button"
                onclick={() => (leakedResearchConfirming = true)}
                disabled={!canAct || !isOffered(ActionType.LeakedResearch)}
                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1.5 text-xs font-semibold hover:border-[#2f6fed] hover:bg-[#212845] disabled:cursor-not-allowed disabled:opacity-40"
            >
                Leaked Research
            </button>
        </div>
    {/if}

    {#if leakedResearchConfirming && leakedResearchCorporation}
        <LeakedResearchConfirmPanel
            corporationId={leakedResearchCorporation.id}
            onConfirm={confirmLeakedResearch}
            onCancel={() => (leakedResearchConfirming = false)}
        />
    {/if}

    <AlienEngineeringPanel />

    {#if canAct && !actionSelectionInProgress}
        <div class="flex items-center gap-2 pt-1">
            <button
                type="button"
                onclick={pass}
                disabled={!isOffered(ActionType.PassAlienTechAction)}
                class="rounded-md border border-[#3a4166] px-3 py-1 text-xs font-semibold hover:bg-[#1a1f38] disabled:opacity-40"
            >
                Pass
            </button>
        </div>
    {/if}

    {#if gameSession.lastActionError}
        <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
    {/if}
</div>
