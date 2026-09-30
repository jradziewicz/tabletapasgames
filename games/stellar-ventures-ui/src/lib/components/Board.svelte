<script lang="ts">
    import {
        HexOrientation,
        calculateHexGeometry,
        type HexDefinition,
        type Point
    } from '@tabletop/common'
    import {
        ActionType,
        MachineState,
        HexType,
        CorporatePowerId,
        type Hex,
        type HexCoordinate,
        type CorporationId,
        HydratedExpandNetwork,
        HydratedCreateWormhole,
        HydratedJerryRig,
        HydratedPrivateContractor,
        HydratedDevelopPlanets,
        HydratedChooseAmethystHomePlanet,
        HydratedDismantlingOutposts,
        HydratedForcedShipPurchase,
        HydratedPayTax,
        BoardMap,
        hexDistance,
        hexIdForCoordinate
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationOutpostIcons,
        CorporationDisplayNames
    } from '$lib/utils/corporationDisplay.js'
    import { AlienAgreementTileRevealedIcons } from '$lib/utils/agreementTileDisplay.js'
    import { operatingCorporationId } from '$lib/utils/phaseLabel.js'
    import { BoardArtLayouts, artBoundingBox } from '$lib/utils/boardArtLayouts.js'
    import { closedBorderEdgesForLevel } from '$lib/utils/closedBorders.js'
    import { borderClosedReveal } from '$lib/model/borderClosedReveal.svelte.js'
    import { borderZoneDisplay } from '$lib/utils/borderZoneDisplay.js'
    import creditsWhite from '$lib/images/currency/creditsWhite.png'
    import alienHexBack from '$lib/images/board/alienHexBack.png'
    import alienTechCube from '$lib/images/investor/alienTechCube.png'
    import corporateTurnOrderFrame from '$lib/images/trackers/corporateTurnOrder.png'
    import loansBox from '$lib/images/trackers/loansBox.png'

    const gameSession = getGameSession()

    // Corporate Turn Order tracker (top-right HUD, per the co-designer's Trackers & Agreement
    // sheet) - corporationTurnOrder already only ever holds the Corporations currently "active"
    // (the 5 starting ones from Setup, joined by Amethyst Agency once it forms - see
    // definition/initializer.ts and actions/chooseAmethystHomePlanet.ts), reordered by mining
    // capacity each Administration Round (operations/administrationRound.ts), so it can be used
    // directly here with no extra filtering - one real Outpost icon per Corporation, in order.
    const turnOrderCorporationIds = $derived(gameSession.gameState.corporationTurnOrder)
    // Only lit up while it's actually that Corporation's own turn during a Corporation Round
    // (operatingCorporationId already excludes e.g. a President just bidding for themselves in a
    // Share auction, or leftover state from a prior round while Investor/Administration runs) -
    // reusing the same helper PlayersPanel.svelte's own "Active" badge relies on.
    const turnOrderActiveCorporationId = $derived(operatingCorporationId(gameSession.gameState))

    // Row geometry measured directly off corporateTurnOrder.png (a 196x726 source image): the
    // header icon/chevron box occupies the top ~12.4% of the card, and the six numbered rows
    // (1st at top to 6th at bottom) evenly split the remaining ~87.6% - confirmed by cropping and
    // reading each row's own printed ordinal off the source art, not eyeballed off one row.
    const TURN_ORDER_HEADER_FRACTION = 0.124
    function turnOrderRowCenterPercent(index: number): number {
        return (TURN_ORDER_HEADER_FRACTION + (index + 0.5) * ((1 - TURN_ORDER_HEADER_FRACTION) / 6)) * 100
    }
    // Per the co-designer, each row's Outpost should sit flush against the BOTTOM of its own
    // row rather than centered in it (matching how a real Outpost piece sits ON the board's
    // printed hex art rather than floating mid-cell) - this is that row's bottom edge, paired
    // with .turn-order-outpost's own translateY(-100%) (rather than the center function's
    // -50%) to anchor the icon's bottom, not its middle, at this point.
    function turnOrderRowBottomPercent(index: number): number {
        return (TURN_ORDER_HEADER_FRACTION + (index + 1) * ((1 - TURN_ORDER_HEADER_FRACTION) / 6)) * 100
    }

    // Per the co-designer, sitting flush against the row's own bottom divider line (a bare
    // translateY(-100%) at the exact boundary, zero gap) reads as spilling out of the box rather
    // than sitting inside it - especially once the "current corporation" glow's own drop-shadow
    // (.turn-order-outpost.current img below) bleeds a few px past the piece's real edge. This
    // fixed-px gap (not a %, for the same reason .turn-order-outpost's own width is fixed - it
    // should stay a small, constant visual margin regardless of how big the tracker card
    // renders) pulls the anchor point up off the line so every piece keeps clear space below it.
    const TURN_ORDER_OUTPOST_BOTTOM_GAP_PX = 4

    // Which Corporation (if any) should have its home planet called out on the board right now -
    // the one currently up for bid in the Initial Auction, or (once that resolves) the one whose
    // President is drafting their second Power - same "is this Draft Power step part of the
    // Initial Auction" test InitialAuctionPanel.svelte uses (Sign The Agreement reuses the exact
    // same DraftPower machine state much later in the game for an unrelated one-off draft, and
    // should NOT trigger this). Per the co-designer, this helps players see at a glance which
    // Corporation's Share (and starting location) is currently being decided.
    const initialAuctionHighlightCorporationId = $derived.by(() => {
        const state = gameSession.gameState
        if (state.machineState === MachineState.InitialAuction && state.activeInitialAuctionCorporationId) {
            return state.activeInitialAuctionCorporationId
        }
        if (
            state.machineState === MachineState.DraftPower &&
            state.draftPowerCorporationId &&
            (state.draftPowerResumeState === MachineState.InitialAuction ||
                state.draftPowerResumeState === MachineState.IssueShare)
        ) {
            return state.draftPowerCorporationId
        }
        return undefined
    })
    const initialAuctionHomePlanetHexId = $derived(
        initialAuctionHighlightCorporationId
            ? gameSession.gameState.getCorporation(initialAuctionHighlightCorporationId).homePlanetId
            : undefined
    )

    // While the President is expanding their Corporation's network (via Expand Network or
    // Create Wormhole - mutually exclusive per click, but BOTH can be legal at once for a
    // Corporation with an adjacent expansion target and active Wormhole Technology), every hex
    // on the board becomes a click target. gameSession.boardActionMode picks which of the two
    // a click submits when both are available; ExpandNetworkPanel is what lets the President
    // choose it explicitly (see its mode toggle) - here we just fall back to whichever single
    // one is valid when only one is. The server is the final authority on whether a given hex
    // is actually a legal target either way; an illegal click just surfaces
    // gameSession.lastActionError instead of doing nothing silently.
    const canExpandNetwork = $derived(gameSession.validActionTypes.includes(ActionType.ExpandNetwork))
    const canCreateWormhole = $derived(gameSession.validActionTypes.includes(ActionType.CreateWormhole))

    // Jerry-Rig/Private Contractor (Investor Shenanigans, rulebook page 19) build an Outpost the
    // same "click a hex" way Expand Network does, but neither has a single fixed
    // activeCorporationId to build for - the acting player isn't necessarily President, and
    // picks whichever Corporation they hold Shares in via InvestorActionPanel's own Corporation
    // picker (gameSession.investorBuildCorporationId), UNTIL a Private Contractor build is
    // actually underway, at which point gameState.expandingCorporationId is the confirmed
    // target instead (see investorBuildCorporationId's own comment in session.svelte.ts).
    const investorBuildTargetCorporationId = $derived(
        gameSession.gameState.expandingCorporationId ?? gameSession.investorBuildCorporationId
    )
    const canJerryRig = $derived(
        gameSession.validActionTypes.includes(ActionType.JerryRig) &&
            !!gameSession.investorBuildCorporationId
    )
    const canPrivateContractor = $derived(
        gameSession.validActionTypes.includes(ActionType.PrivateContractor) &&
            !!investorBuildTargetCorporationId
    )

    // Develop Planet(s) (Alien Tech Action) has no Corporation to pick first - clicking its
    // circle in AlienTechActionPanel goes straight to boardActionMode, which doubles here as
    // "the player has explicitly started selecting hexes" (there's no other signal for that,
    // unlike Jerry-Rig/Private Contractor's investorBuildCorporationId).
    const canDevelopPlanets = $derived(
        gameSession.validActionTypes.includes(ActionType.DevelopPlanets) &&
            gameSession.boardActionMode === ActionType.DevelopPlanets
    )

    // Form Amethyst Agency's final step (stateHandlers/formAmethystAgency.ts): once its
    // Formation Auction resolves, the winning President clicks one of Amethyst Agency's 3
    // candidate Home Planet hexes - the only board-click action available in this machine
    // state, so (like Expand Network/Create Wormhole/Jerry-Rig) it activates automatically
    // rather than needing an explicit "start" step first.
    const canChooseAmethystHomePlanet = $derived(
        gameSession.validActionTypes.includes(ActionType.ChooseAmethystHomePlanet)
    )

    // Dismantling Outposts (Corporate Power Glossary, page 29) - like Develop Planet(s), this
    // has no automatic "only one thing could be meant" fallback (a Corporation mid-Expand
    // Network/Wormhole step could mean either), so it only activates once the President
    // explicitly requests it via ExpandNetworkPanel's own Dismantle button, which sets
    // boardActionMode to this directly - see canDevelopPlanets' own comment for the same pattern.
    const canDismantlingOutposts = $derived(
        gameSession.validActionTypes.includes(ActionType.DismantlingOutposts) &&
            gameSession.boardActionMode === ActionType.DismantlingOutposts
    )

    // Forced Purchase's own "No Credits?" Loans (rulebook pages 16-17 & 25) - same "only
    // activates once explicitly requested" treatment as Dismantling Outposts above, set by
    // OrderShipPanel's own Force Purchase button rather than assumed as a default.
    const canForcedShipPurchase = $derived(
        gameSession.validActionTypes.includes(ActionType.ForcedShipPurchase) &&
            gameSession.boardActionMode === ActionType.ForcedShipPurchase
    )

    const canPayTaxLoan = $derived(gameSession.validActionTypes.includes(ActionType.PayTax))

    const activeBoardActionMode = $derived(
        // A Private Contractor build already in progress always wins - the player doesn't need
        // to keep boardActionMode set across each of its several hex clicks the way
        // Expand Network's own explicit toggle does, since there's only ever one thing an
        // in-progress build's hex clicks could mean.
        gameSession.gameState.expandingCorporationId && canPrivateContractor
            ? ActionType.PrivateContractor
            : (gameSession.boardActionMode ??
                  (canExpandNetwork
                      ? ActionType.ExpandNetwork
                      : canCreateWormhole
                        ? ActionType.CreateWormhole
                        : canJerryRig
                          ? ActionType.JerryRig
                          : canPrivateContractor
                            ? ActionType.PrivateContractor
                            : canChooseAmethystHomePlanet
                              ? ActionType.ChooseAmethystHomePlanet
                              : canPayTaxLoan
                                ? ActionType.PayTax
                                : undefined))
    )
    // Not folded into the fallback chain above, same reasoning as Develop Planet(s) - Dismantling
    // Outposts only ever becomes active because gameSession.boardActionMode was explicitly set to
    // it (canDismantlingOutposts already requires that), never as a default guess.

    const canClickHex = $derived(
        (activeBoardActionMode === ActionType.ExpandNetwork && canExpandNetwork) ||
            (activeBoardActionMode === ActionType.CreateWormhole && canCreateWormhole) ||
            (activeBoardActionMode === ActionType.JerryRig && canJerryRig) ||
            (activeBoardActionMode === ActionType.PrivateContractor && canPrivateContractor) ||
            (activeBoardActionMode === ActionType.DevelopPlanets && canDevelopPlanets) ||
            (activeBoardActionMode === ActionType.ChooseAmethystHomePlanet && canChooseAmethystHomePlanet) ||
            (activeBoardActionMode === ActionType.DismantlingOutposts && canDismantlingOutposts) ||
            (activeBoardActionMode === ActionType.ForcedShipPurchase && canForcedShipPurchase) ||
            (activeBoardActionMode === ActionType.PayTax && canPayTaxLoan)
    )

    // Expand Network, Jerry-Rig and Private Contractor all reject an Alien Planet hex the same
    // way (canBuildExpansionOutpost's canBuildOnAlienPlanets, gated on the Corporation holding
    // Alien Explorers - see actions/jerryRig.ts etc.), and it's by far the most common reason a
    // legal-looking board click on one of those distinctive Alien Planet hexes fails: either the
    // Corporation never drafted Alien Explorers, or (per HydratedSignTheAgreement's own comment)
    // it already signed The Agreement and had Alien Explorers discarded as a result - "the
    // Corporation can no longer build Outposts on Alien Planets." A failed click here would
    // otherwise just surface a generic "An error occurred processing your action" toast (the
    // local optimistic execution's own thrown error doesn't survive gameSession.applyAction's
    // catch-all), so check for this specific, easy-to-explain case up front and set a clear
    // message directly instead of letting the click fail silently-ish.
    function blockedAlienPlanetMessage(
        hexId: string,
        corporationId: CorporationId | undefined
    ): boolean {
        if (!corporationId) {
            return false
        }
        const hex = gameSession.gameState.board.getHex(hexId)
        if (hex?.type !== HexType.AlienPlanet) {
            return false
        }
        // Alien Explorers OR Secret Agents (Amethyst Agency's own alien-planet-building
        // Power - model/corporation.ts's canBuildOnAlienPlanets) - checking AlienExplorers alone
        // here wrongly blocked Amethyst Agency's own clicks with this message even though
        // Secret Agents lets it build there same as Alien Explorers does.
        if (gameSession.gameState.getCorporation(corporationId).canBuildOnAlienPlanets()) {
            return false
        }
        gameSession.lastActionError = 'Corporation can no longer place on Alien planets'
        return true
    }

    // Same reasoning as blockedAlienPlanetMessage above, for the other common "looks legal, but
    // this specific hex needs a Power you don't have" click: a Nebular Anomaly (HexType.Anomaly)
    // hex is normally off-limits, buildable only via Icarus Experiment (Sun/Anomaly alike) or
    // Nebular Explorers (Anomaly only, and only while unused Alien Planet tiles remain - see
    // model/board.ts's canBuildOutpost / operations/network.ts's
    // canBuildOnNebulaAnomalyForCorporation). validHexIds already keeps an ineligible
    // Corporation's Anomaly hexes unhighlighted, but per the board's own comment an unhighlighted
    // hex can still be clicked - so give a clear reason rather than the generic error toast.
    function blockedAnomalyMessage(hexId: string, corporationId: CorporationId | undefined): boolean {
        if (!corporationId) {
            return false
        }
        const hex = gameSession.gameState.board.getHex(hexId)
        if (hex?.type !== HexType.Anomaly) {
            return false
        }
        const corporation = gameSession.gameState.getCorporation(corporationId)
        if (corporation.hasActivePower(CorporatePowerId.IcarusExperiment)) {
            return false
        }
        if (
            corporation.hasActivePower(CorporatePowerId.NebularExplorers) &&
            gameSession.gameState.unusedAlienAgreementTileChevrons.length > 0
        ) {
            return false
        }
        gameSession.lastActionError = 'Corporation cannot build on Nebular Anomalies'
        return true
    }

    function onHexClick(hexId: string) {
        if (activeBoardActionMode === ActionType.ExpandNetwork && canExpandNetwork) {
            if (blockedAlienPlanetMessage(hexId, gameSession.gameState.activeCorporationId)) return
            if (blockedAnomalyMessage(hexId, gameSession.gameState.activeCorporationId)) return
            gameSession.expandNetwork(hexId)
        } else if (activeBoardActionMode === ActionType.CreateWormhole && canCreateWormhole) {
            // Not so immediate - the first click on a hex just highlights it and lets
            // ExpandNetworkPanel preview its cost/Mining Capacity gain; only a second click on
            // that SAME hex actually submits CreateWormhole (see wormholeSelectedHexId's own
            // comment in session.svelte.ts). Create Wormhole is gated by the same Alien Explorers
            // check as Expand Network/Jerry-Rig/Private Contractor (see canCreateWormhole), so
            // check it here too rather than letting the second click fail generically.
            if (blockedAlienPlanetMessage(hexId, gameSession.gameState.activeCorporationId)) {
                return
            }
            if (blockedAnomalyMessage(hexId, gameSession.gameState.activeCorporationId)) {
                return
            }
            if (gameSession.wormholeSelectedHexId === hexId) {
                gameSession.createWormhole(hexId)
            } else {
                gameSession.wormholeSelectedHexId = hexId
            }
        } else if (
            activeBoardActionMode === ActionType.JerryRig &&
            canJerryRig &&
            investorBuildTargetCorporationId
        ) {
            if (blockedAlienPlanetMessage(hexId, investorBuildTargetCorporationId)) return
            if (blockedAnomalyMessage(hexId, investorBuildTargetCorporationId)) return
            gameSession.jerryRig(investorBuildTargetCorporationId, hexId)
        } else if (
            activeBoardActionMode === ActionType.PrivateContractor &&
            canPrivateContractor &&
            investorBuildTargetCorporationId
        ) {
            if (blockedAlienPlanetMessage(hexId, investorBuildTargetCorporationId)) return
            if (blockedAnomalyMessage(hexId, investorBuildTargetCorporationId)) return
            gameSession.privateContractor(investorBuildTargetCorporationId, hexId)
        } else if (activeBoardActionMode === ActionType.DevelopPlanets && canDevelopPlanets) {
            // Toggle only - Develop Planet(s) submits its whole hexIds batch at once, from
            // AlienTechActionPanel's own Submit button, not per click.
            gameSession.toggleDevelopPlanetsHex(hexId)
        } else if (
            activeBoardActionMode === ActionType.ChooseAmethystHomePlanet &&
            canChooseAmethystHomePlanet
        ) {
            gameSession.chooseAmethystHomePlanet(hexId)
        } else if (
            activeBoardActionMode === ActionType.DismantlingOutposts &&
            canDismantlingOutposts
        ) {
            gameSession.dismantlingOutposts(hexId)
        } else if (
            activeBoardActionMode === ActionType.ForcedShipPurchase &&
            canForcedShipPurchase
        ) {
            // Toggle only - like Develop Planet(s), this submits its whole hexIds batch at once,
            // from OrderShipPanel's own Confirm button, not per click.
            gameSession.toggleForcedShipPurchaseHex(hexId)
        } else if (activeBoardActionMode === ActionType.PayTax && canPayTaxLoan) {
            gameSession.toggleTaxLoanHex(hexId)
        }
    }

    // Confirmed by the game's co-designer: the Alpha board's data is authored row-major (each
    // "Row N" comment in data/alphaBoard.ts is a constant-r band of hexes, listed left-to-right
    // by increasing q) - that only renders as true horizontal bands under Pointy hex math (where
    // a hex's y position is a pure function of r). Flat hex math shears y by q/2 as well, which
    // was making the whole board look rotated/skewed relative to the physical board.
    //
    // width/height here are chosen to match a TRUE regular hexagon (width:height = sqrt(3)/2)
    // rather than an arbitrary placeholder ratio, because the real board art (below) is now laid
    // in behind these hexes and only lines up cleanly with correctly-proportioned ones.
    const HEX_WIDTH = 80
    const HEX_HEIGHT = HEX_WIDTH / (Math.sqrt(3) / 2)
    const hexDefinition: HexDefinition = {
        orientation: HexOrientation.Pointy,
        dimensions: { width: HEX_WIDTH, height: HEX_HEIGHT }
    }
    const sharedGeometry = calculateHexGeometry(hexDefinition, { q: 0, r: 0 })
    const hexPoints = sharedGeometry.vertices.map((point) => `${point.x},${point.y}`).join(' ')
    const halfExtent = Math.max(sharedGeometry.boundingBox.width, sharedGeometry.boundingBox.height) / 2

    // Alignment for boardAlpha.jpg (a crop of the higher-contrast board art, cropped to just the
    // hex galaxy - the Shipyard/round-track/chart panels printed alongside the real board live
    // elsewhere in this UI, not in this crop). Measured directly off this 1704x928 source image by
    // overlaying a trial hex grid and fitting it against the art's own printed hex borders across
    // the full board (checked at both the near and far corners from the origin, not just one
    // landmark) - not eyeballed off a single hex. If boardAlpha.jpg is ever re-cropped or
    // re-exported at a different resolution, these four numbers need to be re-measured against the
    // new file.
    const boardArtLayout = $derived(
        BoardArtLayouts[gameSession.gameState.boardMap ?? BoardMap.Alpha]
    )
    const printedPanels = $derived(boardArtLayout.printedPanels)

    const artScale = $derived(boardArtLayout.pixelsPerQ / HEX_WIDTH)
    const artImage = $derived(artBoundingBox(boardArtLayout, artScale))

    function artPointToSvg(point: Point): Point {
        return { x: point.x / artScale + artImage.x, y: point.y / artScale + artImage.y }
    }

    function artLengthToSvg(length: number): number {
        return length / artScale
    }

    // The real board art already carries hex type (color), the printed base value, and its own
    // white/red hex borders (the red ones appear to flag specific hexes on the printed board).
    // Painting our own solid color fill, a duplicate value number, and a synthetic stroke on top
    // of all of that just muddied the art. So this component now draws NOTHING over a hex except
    // information the art can't show: the corporation name on home planets, and outpost markers.
    // Hex polygons stay in the DOM (transparent, no stroke) purely so they're available as future
    // click/hover targets - not for anything visual today.

    const hexes = $derived(Object.values(gameSession.gameState.board.hexes))

    // Which hexes would actually pass validation right now - a live, no-hover-required
    // highlight of legal placements, computed with the exact same check the server itself runs
    // (HydratedExpandNetwork.canExpandNetwork / HydratedCreateWormhole.canCreateWormhole) rather
    // than a re-implementation of the rules here, so it never drifts from adjacency, Outpost
    // Restrictions, remaining budget, or any Corporate Power that lifts them. Recomputes
    // whenever the game state does, so newly-adjacent hexes light up immediately as each Outpost
    // in a multi-step build lands on the board. Clicking an unhighlighted hex is still allowed
    // (see the comment above canClickHex) - this is a visual hint on top of that, not a new
    // restriction.
    const validHexIds = $derived.by(() => {
        if (!canClickHex || !gameSession.myPlayer) {
            return new Set<string>()
        }
        const playerId = gameSession.myPlayer.id
        const state = gameSession.gameState
        const targetCorporationId = investorBuildTargetCorporationId
        const isValid =
            activeBoardActionMode === ActionType.ExpandNetwork
                ? (hexId: string) => HydratedExpandNetwork.canExpandNetwork(state, playerId, hexId)
                : activeBoardActionMode === ActionType.CreateWormhole
                  ? (hexId: string) => HydratedCreateWormhole.canCreateWormhole(state, playerId, hexId)
                  : activeBoardActionMode === ActionType.JerryRig && targetCorporationId
                    ? (hexId: string) =>
                          HydratedJerryRig.canJerryRig(state, playerId, targetCorporationId, hexId)
                    : activeBoardActionMode === ActionType.PrivateContractor && targetCorporationId
                      ? (hexId: string) =>
                            HydratedPrivateContractor.canPrivateContractor(
                                state,
                                playerId,
                                targetCorporationId,
                                hexId
                            )
                      : activeBoardActionMode === ActionType.DevelopPlanets
                        ? (hexId: string) =>
                              // Already-selected hexes stay highlighted regardless (so a pick
                              // never looks like it un-highlighted itself), and a not-yet-picked
                              // hex is valid exactly when adding it would still pass validation -
                              // which is also what naturally caps new picks once the player's
                              // Alien Tech Cubes run out (canDevelopPlanets checks cubes >=
                              // hexIds.length).
                              gameSession.developPlanetsHexIds.includes(hexId) ||
                              HydratedDevelopPlanets.canDevelopPlanets(state, playerId, [
                                  ...gameSession.developPlanetsHexIds,
                                  hexId
                              ])
                      : activeBoardActionMode === ActionType.ChooseAmethystHomePlanet
                        ? (hexId: string) =>
                              HydratedChooseAmethystHomePlanet.canChooseAmethystHomePlanet(
                                  state,
                                  playerId
                              ) &&
                              HydratedChooseAmethystHomePlanet.availableHomePlanetHexIds(state).includes(
                                  hexId
                              )
                        : activeBoardActionMode === ActionType.DismantlingOutposts
                          ? (hexId: string) =>
                                HydratedDismantlingOutposts.canDismantlingOutposts(state, playerId, hexId)
                          : activeBoardActionMode === ActionType.PayTax
                            ? (hexId: string) =>
                                  gameSession.taxLoanHexIds.includes(hexId) ||
                                  HydratedPayTax.canSelectLoanHex(
                                      state,
                                      playerId,
                                      hexId,
                                      gameSession.taxLoanHexIds
                                  )
                            : activeBoardActionMode === ActionType.ForcedShipPurchase
                            ? (hexId: string) =>
                                  // Same "already-picked hexes stay valid regardless, a
                                  // not-yet-picked one is valid exactly when there's still room
                                  // and it's actually this Corporation's own Outpost"
                                  // convention as Develop Planet(s) above.
                                  gameSession.forcedShipPurchaseHexIds.includes(hexId) ||
                                  HydratedForcedShipPurchase.canSelectForcedShipPurchaseHex(
                                      state,
                                      playerId,
                                      hexId,
                                      gameSession.forcedShipPurchaseHexIds
                                  )
                            : undefined
        if (!isValid) {
            return new Set<string>()
        }
        const ids = new Set<string>()
        for (const hex of hexes) {
            if (isValid(hex.id)) {
                ids.add(hex.id)
            }
        }
        return ids
    })
    // Which hexes the player's already picked this Develop Planet(s) selection - highlighted
    // distinctly (a stronger fill) from merely-still-selectable hexes in validHexIds above, so
    // confirmed picks read differently from open options.
    const selectedDevelopPlanetsHexIds = $derived(
        activeBoardActionMode === ActionType.DevelopPlanets
            ? new Set(gameSession.developPlanetsHexIds)
            : new Set<string>()
    )

    // Same idea as selectedDevelopPlanetsHexIds above, for Forced Purchase's own hex-picking.
    const selectedForcedShipPurchaseHexIds = $derived(
        activeBoardActionMode === ActionType.ForcedShipPurchase
            ? new Set(gameSession.forcedShipPurchaseHexIds)
            : activeBoardActionMode === ActionType.PayTax
              ? new Set(gameSession.taxLoanHexIds)
              : new Set<string>()
    )

    // Once a Create Wormhole hex is tentatively picked (gameSession.wormholeSelectedHexId - see
    // its own comment in session.svelte.ts), swap the "every legal hex lit up" highlight for a
    // single drawn-out line back to this Corporation's nearest Outpost, so the President can
    // visually see exactly what createWormholeCostForCorporation is charging for (1 Credit per
    // hex on this line that isn't an endpoint - see ExpandNetworkPanel's own cost preview). Split
    // into the nearest-Outpost hex itself and the rest of the line so both endpoints (this one
    // and the picked target) can be highlighted green - "this doesn't count toward the cost" -
    // while only the hexes strictly in between get the blue "this is what you're paying for"
    // treatment.
    const wormholeNearestOutpostHex = $derived.by(() => {
        const selectedHexId = gameSession.wormholeSelectedHexId
        const corporationId = gameSession.gameState.activeCorporationId
        if (
            activeBoardActionMode !== ActionType.CreateWormhole ||
            !selectedHexId ||
            !corporationId
        ) {
            return undefined
        }
        const board = gameSession.gameState.board
        const target = board.getHex(selectedHexId)
        if (!target) {
            return undefined
        }
        let nearest: Hex | undefined
        let nearestDistance = Infinity
        for (const hex of hexes) {
            if (!hex.outposts.includes(corporationId)) {
                continue
            }
            const distance = hexDistance(hex.coordinate, target.coordinate)
            if (distance < nearestDistance) {
                nearest = hex
                nearestDistance = distance
            }
        }
        return nearest
    })
    const wormholePathHexIds = $derived.by(() => {
        const selectedHexId = gameSession.wormholeSelectedHexId
        const nearest = wormholeNearestOutpostHex
        if (!selectedHexId || !nearest) {
            return new Set<string>()
        }
        const target = gameSession.gameState.board.getHex(selectedHexId)
        if (!target) {
            return new Set<string>()
        }
        return new Set(hexLine(nearest.coordinate, target.coordinate).map(hexIdForCoordinate))
    })
    // Whether validHexIds' "every legal hex" highlight should stay on - suppressed once a
    // Create Wormhole hex is picked, since wormholePathHexIds above takes over as the more
    // specific, informative highlight at that point.
    const showAllValidHexHighlight = $derived(
        !(activeBoardActionMode === ActionType.CreateWormhole && gameSession.wormholeSelectedHexId)
    )

    // While the player is choosing where to build an Outpost (Expand Network, Create Wormhole,
    // Jerry-Rig, Private Contractor), every hex that isn't a legal target is dimmed under a mask
    // and stops taking clicks, so the only thing left to click is somewhere that can actually be
    // built on - rather than the old "highlight the legal hexes but still let a bad click fail
    // with an error". Uses the same validHexIds the highlight is drawn from.
    const maskUnbuildableHexes = $derived(
        canClickHex &&
            (activeBoardActionMode === ActionType.ExpandNetwork ||
                activeBoardActionMode === ActionType.CreateWormhole ||
                activeBoardActionMode === ActionType.JerryRig ||
                activeBoardActionMode === ActionType.PrivateContractor)
    )
    // Hexes that stay unmasked even though they're not in validHexIds: the picked Wormhole target,
    // its nearest Outpost, and the path between them (see wormholePathHexIds).
    function isMaskedHex(hexId: string): boolean {
        return (
            maskUnbuildableHexes &&
            !validHexIds.has(hexId) &&
            !wormholePathHexIds.has(hexId) &&
            gameSession.wormholeSelectedHexId !== hexId &&
            wormholeNearestOutpostHex?.id !== hexId
        )
    }

    // While a Corporation is being offered Sign The Agreement (OfferSignTheAgreementPanel.svelte,
    // in the action sidebar), pulse-highlight the Alien Planet hexes it actually holds an Outpost
    // on right here on the board - the same hexes counted in that panel's planet-count preview -
    // so everyone at the table can see exactly which planets are "in that section of the board"
    // the decision is about, not just an abstract count.
    const signTheAgreementAlienPlanetHexIds = $derived.by(() => {
        const corporationId = gameSession.gameState.signTheAgreementCorporationId
        if (!corporationId) {
            return new Set<string>()
        }
        const ids = new Set<string>()
        for (const hex of hexes) {
            if (hex.type === HexType.AlienPlanet && hex.outposts.includes(corporationId)) {
                ids.add(hex.id)
            }
        }
        return ids
    })
    const hexGeometries = $derived(
        new Map(hexes.map((hex) => [hex.id, calculateHexGeometry(hexDefinition, hex.coordinate)]))
    )

    const bounds = $derived.by(() => {
        if (printedPanels) {
            return {
                minX: artImage.x,
                minY: artImage.y,
                width: artImage.width,
                height: artImage.height
            }
        }
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const geometry of hexGeometries.values()) {
            minX = Math.min(minX, geometry.center.x)
            minY = Math.min(minY, geometry.center.y)
            maxX = Math.max(maxX, geometry.center.x)
            maxY = Math.max(maxY, geometry.center.y)
        }
        if (!isFinite(minX)) {
            return { minX: 0, minY: 0, width: 400, height: 400 }
        }
        const pad = halfExtent + 24
        return {
            minX: minX - pad,
            minY: minY - pad,
            width: maxX - minX + pad * 2,
            height: maxY - minY + pad * 2
        }
    })

    // A single Outpost on a hex sits dead center, sized as a fraction of the hex so it scales
    // with HEX_WIDTH/HEX_HEIGHT rather than being a hardcoded pixel value. Two Outposts sharing
    // a hex stay that same full size and just land side by side (there's just enough room for
    // that with a small gap between them) - it's only at 3+ (rare, but possible) that they fan
    // out around the center and shrink to avoid completely overlapping.
    const SINGLE_OUTPOST_FRACTION = 0.4
    const STACKED_OUTPOST_FRACTION = 0.27
    const PAIR_OUTPOST_RADIUS_FRACTION = 0.22

    // Develop Planet(s) (Alien Tech Action) permanently doubles a Neutral Planet hex's Mining
    // value by spending 1 Alien Tech Cube on it (hex.valueDoubled - see
    // actions/developPlanets.ts). Marked with that same cube's own icon (shared with
    // CorporationCharter.svelte's Wormhole/Cargo Boost cubes), centered horizontally near the
    // hex's own top vertex (its "peak") rather than dead center or tucked into a corner - that
    // way it always sits above any Outpost built on the hex (which stays centered) instead of
    // fighting it for the same spot. Its top edge lands right at the peak itself (not centered
    // on it) so the whole cube reads as sitting inside THIS hex rather than straddling the
    // border with whichever hex is above it.
    const DEVELOPED_CUBE_FRACTION = 0.3

    // The 7 Alien Planet hexes (rulebook Setup step 6) each get 1 of the 10 Alien Agreement
    // Tiles dealt face-down, placed here directly on the hex itself so it reads as "sitting on
    // the board" rather than only in the Agreement tab's own list view (AgreementPanel.svelte).
    // The hidden (face-down) side uses its own dedicated hex-shaped art (alienHexBack.png, from
    // the game's co-designer) rather than AgreementPanel's shipyard-tile-shaped placeholder -
    // once revealed, both still show the same numbered-chevron art (AlienAgreementTileRevealedIcons).
    // Sized against the tile art's own 391x451 aspect ratio (0.867), which is almost exactly
    // HEX_WIDTH:HEX_HEIGHT's own ratio (0.866) - so sizing off HEX_WIDTH alone naturally fills
    // the hex's full bounding box on both axes at once, without needing to size each axis
    // separately.
    const ALIEN_TILE_ASPECT = 391 / 451
    const ALIEN_TILE_WIDTH_FRACTION = 0.97
    // Mega-Earth / Mini-Earth Outposts sit on the board's printed value-track boxes rather than on
    // the hex itself: the 1st Corporation takes the bottom (unnumbered) box and each later one
    // covers the next number up, so the lowest visible number is the shared value.
    const sharedTrackOutposts = $derived([
        ...gameSession.gameState.board.megaEarth.fillOrder.map((corporationId, index) => ({
            corporationId,
            center: boardArtLayout.megaEarthBoxCentersPx[index]
        })),
        ...(gameSession.gameState.board.miniEarth?.fillOrder ?? []).map((corporationId, index) => ({
            corporationId,
            center: boardArtLayout.miniEarthBoxCentersPx[index]
        }))
    ])

    function sharedTrackBoxSvgPosition(center: Point) {
        const size = Math.min(HEX_WIDTH, HEX_HEIGHT) * SINGLE_OUTPOST_FRACTION
        const svgCenter = artPointToSvg(center)
        return { x: svgCenter.x - size / 2, y: svgCenter.y - size / 2, size }
    }

    // Shared by closedBorderSegments/pulsingBorderSegments below - both need the exact same
    // midpoint/perpendicular geometry, just for a different set of edges. Centers are computed
    // straight from each hex's own axial coordinate (calculateHexGeometry, the same function
    // hexGeometries itself is built from) rather than looked up in hexGeometries by id, because
    // closedBorderEdges/closedBorderEdgesForLevel now also hand back synthetic "off the map"
    // hexes (see closedBorders.ts's offBoardHex) to extend a ring to the board's own edge - those
    // were never real hexes on the board, so they'd never be in the hexGeometries map, but their
    // axial coordinate still resolves to a real point in art space either way.
    function borderSegmentsFor(edges: [Hex, Hex][]) {
        return edges.map(([hexA, hexB]) => {
            const a = calculateHexGeometry(hexDefinition, hexA.coordinate).center
            const b = calculateHexGeometry(hexDefinition, hexB.coordinate).center
            const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
            const length = Math.hypot(b.x - a.x, b.y - a.y)
            const halfEdge = HEX_HEIGHT / 4
            const perpendicular = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }
            return {
                id: `${hexA.id}|${hexB.id}`,
                x1: midpoint.x + perpendicular.x * halfEdge,
                y1: midpoint.y + perpendicular.y * halfEdge,
                x2: midpoint.x - perpendicular.x * halfEdge,
                y2: midpoint.y - perpendicular.y * halfEdge
            }
        })
    }

    // Every closed Border, each ring drawn and colored on its own (borderZoneDisplay's own
    // teal/purple/green - the same colors used everywhere else a Border level shows up) rather
    // than one combined red line for all of them, so which specific Border is which stays
    // unambiguous even with more than one closed at once - true whether the board is just sitting
    // there closed, or pulsing for the Expand Network reminder below.
    const closedBorderSegmentsByLevel = $derived(
        (gameSession.gameState.board.closedBorderLevels ?? []).flatMap((level) =>
            borderSegmentsFor(closedBorderEdgesForLevel(gameSession.gameState.board, level)).map(
                (segment) => ({
                    ...segment,
                    id: `${level}:${segment.id}`,
                    color: borderZoneDisplay(level).color
                })
            )
        )
    )

    // Whenever the active Corporation is Expanding Network (or Creating a Wormhole - the same
    // MachineState covers both), every already-closed Border pulses on the board as a reminder
    // it can't be built or passed across without a Wormhole - shown to everyone looking at the
    // board while that's true, not just the acting President.
    const expandNetworkActive = $derived(
        gameSession.gameState.machineState === MachineState.ExpandNetworkOrWormhole
    )

    // The one specific Border BorderClosedRevealOverlay.svelte currently has pinned on screen
    // (see borderClosedReveal's own comment) - pulsed more emphatically than the plain closed-
    // border pulse above, so it reads as "here's the Border that dialog is about", right on the
    // real map behind/around the dialog itself.
    const pulsingBorderLevel = $derived(borderClosedReveal.level)
    const pulsingBorderSegments = $derived(
        pulsingBorderLevel !== undefined
            ? borderSegmentsFor(closedBorderEdgesForLevel(gameSession.gameState.board, pulsingBorderLevel))
            : []
    )
    // Matches the specific Border's own color (borderZoneDisplay - teal/purple/green, the same
    // colors BorderClosedRevealOverlay.svelte's badge uses) rather than a single fixed pulse
    // color, so which Border is pulsing is unambiguous even with more than one already closed.
    const pulsingBorderColor = $derived(
        pulsingBorderLevel !== undefined ? borderZoneDisplay(pulsingBorderLevel).color : undefined
    )

    const loanCorporations = $derived(
        gameSession.gameState.corporations.filter((corporation) => corporation.loanCount > 0)
    )

    // A straight line of hex coordinates from a to b, inclusive of both endpoints - the classic
    // "cube coordinate lerp + round" hex line-draw algorithm (axial -> cube via y = -q - r).
    // createWormholeCost doesn't actually care about a path (just raw hexDistance), so this is
    // purely illustrative - any straight line has exactly hexDistance(a, b) + 1 hexes, which is
    // all that matters for showing the President what's being charged for.
    function hexLine(a: HexCoordinate, b: HexCoordinate): HexCoordinate[] {
        const distance = hexDistance(a, b)
        if (distance === 0) {
            return [a]
        }
        const aCube = { x: a.q, y: -a.q - a.r, z: a.r }
        const bCube = { x: b.q, y: -b.q - b.r, z: b.r }
        const results: HexCoordinate[] = []
        for (let step = 0; step <= distance; step++) {
            const t = step / distance
            const x = aCube.x + (bCube.x - aCube.x) * t
            const y = aCube.y + (bCube.y - aCube.y) * t
            const z = aCube.z + (bCube.z - aCube.z) * t
            let rx = Math.round(x)
            let ry = Math.round(y)
            let rz = Math.round(z)
            const xDiff = Math.abs(rx - x)
            const yDiff = Math.abs(ry - y)
            const zDiff = Math.abs(rz - z)
            if (xDiff > yDiff && xDiff > zDiff) {
                rx = -ry - rz
            } else if (yDiff > zDiff) {
                ry = -rx - rz
            } else {
                rz = -rx - ry
            }
            results.push({ q: rx, r: rz })
        }
        return results
    }

    function outpostLayout(index: number, total: number) {
        const hexSize = Math.min(HEX_WIDTH, HEX_HEIGHT)
        if (total <= 1) {
            return { x: 0, y: 0, size: hexSize * SINGLE_OUTPOST_FRACTION }
        }
        if (total === 2) {
            const radius = hexSize * PAIR_OUTPOST_RADIUS_FRACTION
            const angle = index === 0 ? 0 : Math.PI
            return {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                size: hexSize * SINGLE_OUTPOST_FRACTION
            }
        }
        const radius = hexSize * 0.25
        const angle = (index / total) * 2 * Math.PI
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            size: hexSize * STACKED_OUTPOST_FRACTION
        }
    }

</script>

<div class="board-shell">
    <svg
        viewBox="{bounds.minX} {bounds.minY} {bounds.width} {bounds.height}"
        width={bounds.width}
        height={bounds.height}
        class="block"
    >
        <image
            href={boardArtLayout.art}
            x={artImage.x}
            y={artImage.y}
            width={artImage.width}
            height={artImage.height}
            preserveAspectRatio="none"
        />
        {#each hexes as hex (hex.id)}
            {@const geometry = hexGeometries.get(hex.id)}
            {#if geometry}
                <g transform="translate({geometry.center.x}, {geometry.center.y})">
                    <polygon
                        points={hexPoints}
                        fill="transparent"
                        stroke="none"
                        pointer-events={canClickHex && !isMaskedHex(hex.id) ? 'all' : 'none'}
                        class="{canClickHex && !isMaskedHex(hex.id) ? 'expandable-hex' : ''} {showAllValidHexHighlight &&
                        validHexIds.has(hex.id)
                            ? 'valid-expansion-hex'
                            : ''} {wormholePathHexIds.has(hex.id) &&
                        gameSession.wormholeSelectedHexId !== hex.id &&
                        wormholeNearestOutpostHex?.id !== hex.id
                            ? 'wormhole-path-hex'
                            : ''} {selectedDevelopPlanetsHexIds.has(hex.id) ||
                        selectedForcedShipPurchaseHexIds.has(hex.id) ||
                        gameSession.wormholeSelectedHexId === hex.id ||
                        wormholeNearestOutpostHex?.id === hex.id
                            ? 'selected-develop-hex'
                            : ''}"
                        onclick={() => onHexClick(hex.id)}
                    ></polygon>
                    {#if hex.type === HexType.AlienPlanet}
                        {@const revealed = hex.alienAgreementTileHidden === false}
                        {@const chevrons = hex.alienAgreementTileChevrons}
                        {@const tileWidth = HEX_WIDTH * ALIEN_TILE_WIDTH_FRACTION}
                        {@const tileHeight = tileWidth / ALIEN_TILE_ASPECT}
                        {#if !hex.alienAgreementTileRemoved}
                            <!-- Once a Corporation Signs The Agreement here, the physical tile is
                                 taken off the board entirely and returned to the box (see
                                 signTheAgreement.ts) - so once alienAgreementTileRemoved is set,
                                 render nothing at all for this hex's tile, rather than continuing
                                 to show the revealed (or facedown) art indefinitely. -->
                            <image
                                href={revealed && chevrons !== undefined
                                    ? (AlienAgreementTileRevealedIcons[chevrons] ?? alienHexBack)
                                    : alienHexBack}
                                x={-tileWidth / 2}
                                y={-tileHeight / 2}
                                width={tileWidth}
                                height={tileHeight}
                                preserveAspectRatio="xMidYMid meet"
                                pointer-events="none"
                            />
                        {/if}
                        {#if validHexIds.has(hex.id)}
                            <!-- The alien tile artwork above is fully opaque and sits on top of
                                 the ordinary highlight polygon (drawn first, at the top of this
                                 <g>), which otherwise makes a legal Alien Planet target
                                 invisible - completely hidden behind the tile. Redraw the
                                 highlight here, above the tile art, so it's visible - and with a
                                 bolder fill/stroke than the plain hex highlight, since the co-
                                 designer wants Alien Planet targets to stand out more, not just
                                 be merely visible. -->
                            <polygon
                                points={hexPoints}
                                pointer-events="none"
                                class="alien-valid-expansion-overlay"
                            ></polygon>
                        {/if}
                        {#if signTheAgreementAlienPlanetHexIds.has(hex.id)}
                            <!-- Same "redraw above the opaque tile art" need as the highlight
                                 above, but pulsing rather than static - this hex isn't something
                                 to click, just something to notice while the President decides
                                 whether to Sign The Agreement. -->
                            <polygon
                                points={hexPoints}
                                pointer-events="none"
                                class="sign-the-agreement-hex-pulse"
                            ></polygon>
                        {/if}
                    {/if}
                    {#if hex.valueDoubled}
                        {@const cubeSize = Math.min(HEX_WIDTH, HEX_HEIGHT) * DEVELOPED_CUBE_FRACTION}
                        <image
                            href={alienTechCube}
                            x={-cubeSize / 2}
                            y={-HEX_HEIGHT / 2}
                            width={cubeSize}
                            height={cubeSize}
                            preserveAspectRatio="xMidYMid meet"
                            pointer-events="none"
                        />
                    {/if}
                    {#if hex.type !== HexType.MegaEarth && hex.type !== HexType.MiniEarth}
                        {#each hex.outposts as corporationId, index (corporationId + index)}
                            {@const outpost = outpostLayout(index, hex.outposts.length)}
                            <image
                                href={CorporationOutpostIcons[corporationId]}
                                x={outpost.x - outpost.size / 2}
                                y={outpost.y - outpost.size / 2}
                                width={outpost.size}
                                height={outpost.size}
                                preserveAspectRatio="xMidYMid meet"
                                pointer-events="none"
                            />
                        {/each}
                    {/if}
                    {#if hex.id === initialAuctionHomePlanetHexId}
                        <polygon
                            points={hexPoints}
                            pointer-events="none"
                            class="auction-home-planet-highlight"
                        ></polygon>
                    {/if}
                    {#if isMaskedHex(hex.id)}
                        <!-- Mask over a hex that can't be built on right now (see
                             maskUnbuildableHexes) - drawn last so it dims the tile art and any
                             Outposts on it, and lets clicks fall through to nothing. -->
                        <polygon
                            points={hexPoints}
                            pointer-events="none"
                            class="unbuildable-hex-mask"
                        ></polygon>
                    {/if}
                </g>
            {/if}
        {/each}
        {#each sharedTrackOutposts as outpost (outpost.corporationId + outpost.center?.y)}
            {#if outpost.center}
                {@const position = sharedTrackBoxSvgPosition(outpost.center)}
                <image
                    href={CorporationOutpostIcons[outpost.corporationId]}
                    x={position.x}
                    y={position.y}
                    width={position.size}
                    height={position.size}
                    preserveAspectRatio="xMidYMid meet"
                    pointer-events="none"
                />
            {/if}
        {/each}
        {#each closedBorderSegmentsByLevel as segment (segment.id)}
            <line
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                class="closed-border {expandNetworkActive ? 'closed-border-expand-pulse' : ''}"
                style="stroke: {segment.color};"
                pointer-events="none"
            />
        {/each}
        {#each pulsingBorderSegments as segment (segment.id)}
            <!-- The specific Border BorderClosedRevealOverlay.svelte is currently revealing -
                 drawn again, on top of the plain closed-border line above, with a bolder pulse,
                 in that Border's own color, so it stands out from every other already-closed
                 Border. -->
            <line
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                class="closed-border-reveal-pulse"
                style="stroke: {pulsingBorderColor};"
                pointer-events="none"
            />
        {/each}
        {#if printedPanels}
            {#each turnOrderCorporationIds as corporationId, index (corporationId)}
                {@const center = printedPanels.turnOrderRowCentersPx[index]}
                {#if center}
                    {@const svgCenter = artPointToSvg(center)}
                    {@const size = artLengthToSvg(printedPanels.turnOrderMarkerSizePx)}
                    <image
                        href={CorporationOutpostIcons[corporationId]}
                        x={svgCenter.x - size / 2}
                        y={svgCenter.y - size / 2}
                        width={size}
                        height={size}
                        preserveAspectRatio="xMidYMid meet"
                        pointer-events="none"
                        class={corporationId === turnOrderActiveCorporationId
                            ? 'printed-turn-order-current'
                            : ''}
                    >
                        <title>{CorporationDisplayNames[corporationId]}</title>
                    </image>
                {/if}
            {/each}
            {#each gameSession.gameState.board.closedBorderLevels ?? [] as borderLevel (borderLevel)}
                {@const badgeCenter = printedPanels.taxBadgeCentersPxByBorderLevel[borderLevel]}
                {#if badgeCenter}
                    {@const svgCenter = artPointToSvg(badgeCenter)}
                    <text
                        x={svgCenter.x}
                        y={svgCenter.y + artLengthToSvg(78)}
                        class="closed-border-label"
                        style="fill: {borderZoneDisplay(borderLevel).color};"
                        text-anchor="middle"
                        font-size={artLengthToSvg(26)}
                        pointer-events="none">CLOSED</text
                    >
                {/if}
            {/each}
            {@const taxBoxCenter = artPointToSvg(printedPanels.taxBoxCenterPx)}
            {@const creditsSize = artLengthToSvg(80)}
            <image
                href={creditsWhite}
                x={taxBoxCenter.x - creditsSize * 1.1}
                y={taxBoxCenter.y - creditsSize / 2}
                width={creditsSize * (344 / 395)}
                height={creditsSize}
                preserveAspectRatio="xMidYMid meet"
                pointer-events="none"
            />
            <text
                x={taxBoxCenter.x}
                y={taxBoxCenter.y}
                class="tax-box-amount"
                dominant-baseline="central"
                font-size={artLengthToSvg(96)}
                pointer-events="none">{gameSession.gameState.taxBox ?? 0}</text
            >
            {#each loanCorporations as corporation, index (corporation.id)}
                {@const loansGridColumns = 3}
                {@const iconSize = artLengthToSvg(80)}
                {@const loanGridColumn = index % loansGridColumns}
                {@const loanGridRow = Math.floor(index / loansGridColumns)}
                {@const iconCenter = artPointToSvg({
                    x:
                        printedPanels.loansBoxCenterPx.x +
                        (loanGridColumn - (loansGridColumns - 1) / 2) * printedPanels.loansColumnSpacingPx,
                    y:
                        printedPanels.loansBoxCenterPx.y +
                        (loanGridRow === 0 ? -1 : 1) * (printedPanels.loansRowGapPx / 2)
                })}
                <image
                    href={CorporationOutpostIcons[corporation.id]}
                    x={iconCenter.x - iconSize / 2}
                    y={iconCenter.y - iconSize / 2}
                    width={iconSize}
                    height={iconSize}
                    preserveAspectRatio="xMidYMid meet"
                    pointer-events="none"
                >
                    <title>{CorporationDisplayNames[corporation.id]}: {corporation.loanCount} Loans</title>
                </image>
                <text
                    x={iconCenter.x + iconSize / 2}
                    y={iconCenter.y + iconSize / 2}
                    class="loan-count"
                    font-size={artLengthToSvg(34)}
                    pointer-events="none">×{corporation.loanCount}</text
                >
            {/each}
        {/if}
    </svg>

    {#if !printedPanels}
    <div class="turn-order-tracker">
        <img src={corporateTurnOrderFrame} alt="Corporate Turn Order" class="turn-order-frame" />
        {#each turnOrderCorporationIds as corporationId, index (corporationId)}
            <div
                class="turn-order-outpost {corporationId === turnOrderActiveCorporationId ? 'current' : ''}"
                style="top: calc({turnOrderRowBottomPercent(index)}% - {TURN_ORDER_OUTPOST_BOTTOM_GAP_PX}px);"
                title={CorporationDisplayNames[corporationId]}
            >
                <img src={CorporationOutpostIcons[corporationId]} alt={CorporationDisplayNames[corporationId]} />
            </div>
        {/each}
    </div>

    <!-- Loans reference box - the co-designer's own finished "LOANS" rules-reference card (a
         fixed HUD pinned to the board's bottom-right corner, mirroring turn-order-tracker's own
         top-left corner treatment), explaining Take a Loan and its Liquidation penalty exactly
         like a printed reference, the same way Mega-Earth's own value track is printed straight
         onto the board rather than computed live. The whole card is baked art (including its own
         "-3" figures) rather than composed from live text - if LoanPenaltyPerShare
         (operations/liquidation.ts) ever changes, this art asset needs a matching update, same as
         any other printed reference. Positioned in the corner specifically to stay clear of
         Mega-Earth's own value track, which sits around 86% across / 73-83% down the board art -
         comfortably clear of this bottom-right corner HUD at any reasonable board render size. -->
    <img src={loansBox} alt="Loans reference" class="loans-box" />
    {/if}
</div>

<style>
    .closed-border {
        /* stroke color is set inline per-instance (closedBorderSegmentsByLevel's own color) to
           match each specific Border level, rather than one fixed color here. */
        stroke-width: 5;
        stroke-linecap: round;
        opacity: 0.9;
    }
    .closed-border-label {
        /* fill color is set inline per-instance to match that Border level, same as the line
           itself above. */
        font-weight: 700;
        letter-spacing: 0.08em;
    }
    /* Expand Network/Create Wormhole reminder - every already-closed Border pulses while the
       active Corporation is expanding (see expandNetworkActive's own comment). A brighter/wider
       stroke pulse rather than filter: drop-shadow(...), since this is an SVG <line> rather than
       an <img>/<polygon> like the app's other pulsing highlights. */
    .closed-border-expand-pulse {
        animation: closed-border-expand-pulse 1.4s ease-in-out infinite;
    }
    @keyframes closed-border-expand-pulse {
        0%,
        100% {
            stroke-width: 5;
            opacity: 0.9;
        }
        50% {
            stroke-width: 9;
            opacity: 1;
        }
    }
    /* BorderClosedRevealOverlay.svelte's own currently-revealed Border, pulsed even more
       emphatically than the Expand Network reminder above (brighter color, bigger swing) so it
       reads as "here's the Border that dialog is about" rather than just another reminder. */
    .closed-border-reveal-pulse {
        /* stroke color is set inline per-instance (pulsingBorderColor) to match the specific
           Border that's closing, rather than a single fixed color here. */
        stroke-linecap: round;
        animation: closed-border-reveal-pulse 1.1s ease-in-out infinite;
    }
    @keyframes closed-border-reveal-pulse {
        0%,
        100% {
            stroke-width: 6;
            opacity: 0.6;
        }
        50% {
            stroke-width: 14;
            opacity: 1;
        }
    }
    .tax-box-amount {
        fill: #ffffff;
        font-weight: 700;
    }
    .loan-count {
        fill: #ffffff;
        font-weight: 700;
    }
    .printed-turn-order-current {
        filter: drop-shadow(0 0 6px #ffffff);
    }
    .expandable-hex {
        cursor: pointer;
    }

    .expandable-hex:hover {
        fill: rgba(47, 111, 237, 0.22);
    }

    /* Legal placement hexes are highlighted persistently, without needing a hover, so the
       President can see every valid Outpost target at a glance - see validHexIds above. Amber
       rather than green so it reads as "you may place here" distinctly from
       .selected-develop-hex's green "already placed here" below, and so it doesn't get lost
       against the board's own greens/blues. */
    /* The dimming mask over hexes that can't be built on while choosing where to build. Kept
       fairly light so the map stays readable underneath; the amber .valid-expansion-hex tint
       still marks the legal targets on top of it. */
    .unbuildable-hex-mask {
        fill: rgba(6, 9, 20, 0.45);
        stroke: none;
    }
    .valid-expansion-hex {
        fill: rgba(251, 191, 36, 0.3);
    }

    .valid-expansion-hex:hover {
        fill: rgba(251, 191, 36, 0.5);
    }

    /* Redrawn on top of the (opaque) Alien Planet tile artwork - see the overlay polygon above -
       bolder than .valid-expansion-hex both because it has to read over the tile art and because
       the co-designer wants Alien Planet targets more visually prominent than an ordinary legal
       hex, not just equally visible. Same amber as .valid-expansion-hex, plus a solid stroke the
       plain fill-only style doesn't need, since it has to stand out over busy tile art. */
    .alien-valid-expansion-overlay {
        fill: rgba(251, 191, 36, 0.45);
        stroke: #fbbf24;
        stroke-width: 4;
        stroke-linejoin: round;
    }

    /* Green (matching the Agreement/handshake color used elsewhere) rather than the amber used
       for legal-placement highlights above, since this isn't something to click - it's just
       drawing attention to which Alien Planets are under discussion while the President decides
       whether to Sign The Agreement. */
    .sign-the-agreement-hex-pulse {
        fill: rgba(143, 224, 168, 0.5);
        stroke: #8fe0a8;
        stroke-width: 4;
        stroke-linejoin: round;
        animation: sign-the-agreement-hex-pulse 1.6s ease-in-out infinite;
    }

    @keyframes sign-the-agreement-hex-pulse {
        0%,
        100% {
            opacity: 0.45;
        }
        50% {
            opacity: 1;
        }
    }

    /* Once a Create Wormhole hex is picked, this replaces .valid-expansion-hex's "every legal
       hex" highlight (see showAllValidHexHighlight) with just the hexes on the line back to the
       nearest Outpost - blue to match the Create Wormhole toggle's own accent color, distinct
       from the amber "you may place here" and green "already picked" highlights. */
    .wormhole-path-hex {
        fill: rgba(47, 111, 237, 0.35);
    }

    /* Confirmed Develop Planet(s) picks get a stronger fill than merely-selectable hexes
       (.valid-expansion-hex above), so a click's result is visually obvious at a glance. */
    .selected-develop-hex {
        fill: rgba(61, 220, 132, 0.55);
    }

    .selected-develop-hex:hover {
        fill: rgba(61, 220, 132, 0.7);
    }

    .board-shell {
        position: relative;
        display: inline-flex;
        border-radius: 14px;
        background: #0b0e1a;
        padding: 12px;
        box-shadow:
            0 0 0 4px rgba(47, 111, 237, 0.12),
            0 10px 22px rgba(0, 0, 0, 0.4);
        overflow: hidden;
    }

    /* Draws attention to the Corporation currently up for bid (or drafting) in the Initial
       Auction - same amber as .valid-expansion-hex/.alien-valid-expansion-overlay above, but
       pulsing rather than a flat fill, since this is calling attention to a hex rather than
       inviting a click on it. */
    .auction-home-planet-highlight {
        fill: none;
        stroke: #fbbf24;
        stroke-width: 5;
        stroke-linejoin: round;
        animation: auction-home-planet-pulse 1.4s ease-in-out infinite;
    }

    @keyframes auction-home-planet-pulse {
        0%,
        100% {
            stroke-opacity: 0.45;
        }
        50% {
            stroke-opacity: 1;
        }
    }

    /* Corporate Turn Order tracker (Trackers & Agreement sheet, page 2) - a fixed-size HUD
       pinned to the board's own top-right corner regardless of how large the hex grid itself
       renders, since it's a reference panel rather than part of the map. Sized off its own
       source art's aspect ratio (196x726) so it never distorts at any board size. Bumped up
       from the original 72px (then dialed back 10% from an interim 110px) - per the co-designer,
       the fix for "too small" is scaling the whole tracker card up (this width), not making the
       Outpost pieces disproportionately large relative to their own row - see
       .turn-order-outpost below, which is sized in fixed px to exactly match an Outpost's true
       on-screen size as it renders on the board itself, rather than as a fraction of this card's
       own width, so a piece reads as the same normal size in both places rather than looking
       oversized here specifically. */
    .turn-order-tracker {
        position: absolute;
        top: 18px;
        left: 18px;
        width: 99px;
        z-index: 5;
        filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55));
    }

    .turn-order-frame {
        display: block;
        width: 100%;
    }

    /* Positioned into the right-hand half of each numbered row (the row's own ordinal text
       occupies the left half - see turnOrderRowBottomPercent's own comment for the row math),
       justified to the BOTTOM of that row via top/translateY(-100%) rather than centered.
       Width has been through several rounds (21px -> 34px -> 30.6px) chasing the co-designer's
       repeated "shrink the gap between rows' pieces" asks. The row math: this tracker's own row
       height is ~53.55px at its current 99px card width, and each piece sits 4px above its
       row's own bottom edge (TURN_ORDER_OUTPOST_BOTTOM_GAP_PX) - so the visible gap to the piece
       in the row below is simply rowHeight - pieceHeight (whatever pieceHeight the 30.6px width
       actually rendered at, per each Corporation's own real Outpost art aspect ratio - checked
       directly against the source PNGs rather than guessed: gambogeGuild is shortest/widest at
       h/w 1.095, ceruleanCouncil is tallest/narrowest at 1.365, the rest fall in between). Most
       Corporations' pieces were rendering well under the old 40px cap at 30.6px wide (only
       ceruleanCouncil was actually hitting it), so this round's "50% smaller again" bumps BOTH
       width (30.6px -> 37.4px) and the cap below (40px -> 49px) together - letting every
       Corporation's piece grow, not just the one already pinned to the old ceiling. 49px (not
       the theoretical max of rowHeight-4=49.55px) is the real hard limit here: any taller and a
       piece would start poking past the TOP of its own row into the row above, undoing this
       whole tracker's very first fix ("space the outposts so that they are fully within each
       box"). ceruleanCouncil's own natural height at 37.4px (~51px) already exceeds that ceiling
       and gets capped down to 49px - a bigger cut than a flat 50% for that one Corporation
       specifically, but it's a hard physical constraint (the row's own height), not a choice. */
    .turn-order-outpost {
        position: absolute;
        left: 64%;
        width: 37.4px;
        transform: translate(-50%, -100%);
    }

    .turn-order-outpost img {
        display: block;
        width: 100%;
        /* Belt-and-suspenders on top of the width above: the 6 Corporations' own Outpost art
           isn't all quite the same aspect ratio (ceruleanCouncil.png runs noticeably taller/
           narrower than the others), so a width alone that happens to fit the rest can still let
           its own height poke past this row's own boundary. Capping height too (49px - see
           .turn-order-outpost's own comment above for exactly why 49, not rowHeight itself)
           guarantees every Corporation's piece stays fully inside its row regardless of that
           Corporation's own icon proportions, while also being the thing that actually
           determines ceruleanCouncil's final rendered size at the current 37.4px width, since
           its own art computes taller than 49px at that width and gets capped back down to it. */
        max-height: 49px;
        object-fit: contain;
    }

    /* The Corporation whose turn it currently is (Corporation Round only - see
       turnOrderActiveCorporationId's own comment) gets a glow rather than a second badge, so it
       reads at a glance without adding new chrome on top of the tracker art. */
    .turn-order-outpost.current img {
        filter: drop-shadow(0 0 5px #2f6fed) drop-shadow(0 0 5px #2f6fed);
    }

    /* Loans reference box - fixed HUD pinned to the board's bottom-right corner (see the
       template comment above for why this stays purely a static reference card). Sized off the
       source art's own aspect ratio (615x590) so it never distorts, and kept modest so it never
       crowds Mega-Earth's own printed value track, which lives well up and to the left of this
       corner. */
    .loans-box {
        position: absolute;
        bottom: 18px;
        right: 18px;
        z-index: 5;
        width: 140px;
        filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55));
    }

</style>
