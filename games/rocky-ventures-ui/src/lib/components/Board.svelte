<script lang="ts">
    import {
        BoardArtSize,
        DummyPlayerId,
        BoardBoxLocations,
        BoxSize,
        BoardNodes,
        BoardNodesById,
        CompanyIds,
        CompanyId,
        DeliveryCityId,
        MineTier,
        MineTokensById,
        NodeKind,
        OreKind,
        RegionIds,
        RegionNames,
        ScourgeDefinitionsById,
        huntTargets,
        huntableRegions,
        type RegionId,
        SharesPerCompany,
        TrackValueByCubeCount,
        isMineNode,
        type BoardNode,
        type MineSite
    } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CompanyColors } from '$lib/utils/companyDisplay.js'
    import { CompanyBoardLayouts } from '$lib/utils/companyBoardLayout.js'
    import { shareImageUrl } from '$lib/utils/shareImages.js'
    import { mineTokenBackImageUrl, mineTokenImageUrl } from '$lib/utils/tokenImages.js'
    import { cardBackImageUrl, cardImageUrl } from '$lib/utils/cardImages.js'
    import { DrawPileBox, MarketSlotBoxes, type MarketSlotBox } from '$lib/utils/marketLayout.js'
    import { CityRouteColors, routePolylinePoints } from '$lib/utils/routePath.js'
    import { DummyColor } from '$lib/utils/dummyDisplay.js'
    import { GemHexRadius, GemTrackFillOrder, hexagonPoints } from '$lib/utils/gemTrack.js'
    import { gridCellPosition, victoryPointPosition } from '$lib/utils/trackLayout.js'
    import { scourgeImageUrl } from '$lib/utils/scourgeImages.js'
    import { agreementImageUrl, agreementTooltip } from '$lib/utils/agreementImages.js'
    import { AgreementBoxes } from '$lib/utils/agreementBoxLayout.js'
    import {
        ScourgeBoxes,
        ScourgeCardHeight,
        ScourgeCardWidth,
        ScourgeSplayStep
    } from '$lib/utils/scourgeBoxLayout.js'
    import boardArt from '$lib/images/board.jpg'
    import GridArtOverrides from '$lib/components/GridArtOverrides.svelte'
    import { RegionMapBounds, RegionRuns, regionAt, regionLabelPoint } from '$lib/utils/regionMap.js'

    const gameSession = getGameSession()

    let boardSvg: SVGSVGElement | undefined = $state()
    let huntHoverRegion: RegionId | undefined = $state()
    const huntPickRegions: RegionId[] = $derived(
        gameSession.huntActive && gameSession.isMyTurn && !gameSession.isViewingHistory
            ? RegionIds.filter((region) => huntableRegions(gameSession.gameState).includes(region))
            : []
    )

    function huntRegionAt(event: MouseEvent): RegionId | undefined {
        const matrix = boardSvg?.getScreenCTM()
        if (!matrix) {
            return undefined
        }
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
        const region = regionAt({ x: point.x, y: point.y })
        return region && huntPickRegions.includes(region) ? region : undefined
    }

    function remainingHuntValue(region: string): number {
        return huntTargets(gameSession.gameState, region).reduce(
            (total, target) => total + Math.max(0, target.level - target.hits),
            0
        )
    }

    const mineNodes = BoardNodes.filter(isMineNode)
    const board = $derived(gameSession.gameState.board)
    const companies = $derived(gameSession.gameState.companies)
    const players = $derived.by(() => {
        const discs = gameSession.gameState.players.map((player) => ({
            playerId: player.playerId,
            weaponLevel: player.weaponLevel,
            toolLevel: player.toolLevel,
            victoryPoints: player.victoryPoints,
            color: gameSession.colors.getPlayerUiColor(player.playerId)
        }))
        const dummy = gameSession.gameState.dummy
        if (dummy) {
            discs.push({
                playerId: DummyPlayerId,
                weaponLevel: dummy.weaponLevel,
                toolLevel: dummy.toolLevel,
                victoryPoints: dummy.victoryPoints,
                color: DummyColor
            })
        }
        return discs
    })

    const PlayerDiscRadius = 11
    const VictoryPointDiscRadius = PlayerDiscRadius * 2

    // Players sharing a cell or track space fan out slightly so every disc stays visible.
    function stackOffset(index: number, count: number, scale = 1): { dx: number; dy: number } {
        if (count <= 1) {
            return { dx: 0, dy: 0 }
        }
        const spread = 9 * scale
        return { dx: (index - (count - 1) / 2) * spread, dy: (index - (count - 1) / 2) * -spread * 0.6 }
    }

    const gridGroups = $derived.by(() => {
        const groups = new Map<string, string[]>()
        for (const player of players) {
            const key = `${player.weaponLevel},${player.toolLevel}`
            groups.set(key, [...(groups.get(key) ?? []), player.playerId])
        }
        return groups
    })

    const victoryPointGroups = $derived.by(() => {
        const groups = new Map<number, string[]>()
        for (const player of players) {
            const key = ((player.victoryPoints % 100) + 100) % 100
            groups.set(key, [...(groups.get(key) ?? []), player.playerId])
        }
        return groups
    })

    const MineTokenRadius = 24

    let previousSlots: string[] | undefined
    let previousRevealed: Set<string> | undefined
    let highlightTimer: ReturnType<typeof setTimeout> | undefined
    let newCardIds: string[] = $state([])
    let newMineIds: string[] = $state([])

    $effect(() => {
        const slots = gameSession.gameState.market.slots.map((slot) => slot)
        const revealed = new Set(
            Object.values(gameSession.gameState.board.mines)
                .filter((site) => site.token !== undefined)
                .map((site) => site.nodeId)
        )
        const priorSlots = previousSlots
        const priorRevealed = previousRevealed
        previousSlots = slots
        previousRevealed = revealed
        if (!priorSlots || !priorRevealed || gameSession.isViewingHistory) {
            return
        }
        const addedCards = slots.filter((id) => id !== undefined && !priorSlots.includes(id))
        const addedMines = [...revealed].filter((nodeId) => !priorRevealed.has(nodeId))
        if (addedCards.length === 0 && addedMines.length === 0) {
            return
        }
        newCardIds = addedCards
        newMineIds = addedMines
        clearTimeout(highlightTimer)
        highlightTimer = setTimeout(() => {
            newCardIds = []
            newMineIds = []
        }, 3600)
    })
    const activePlayerColor = $derived.by(() => {
        const playerId = gameSession.gameState.activePlayerIds[0]
        return playerId ? gameSession.colors.getPlayerBgColorValue(playerId) : '#ffd166'
    })
    const CubeSize = 24
    const ShareCardWidth = 110
    const ShareCardHeight = 67
    const ShareSplayStep = 118


    function mineSite(node: BoardNode): MineSite {
        return board.mines[node.id]
    }

    function mineImageUrl(node: BoardNode, site: MineSite): string | undefined {
        if (site.empty) {
            return undefined
        }
        if (site.token) {
            return mineTokenImageUrl(site.token)
        }
        return mineTokenBackImageUrl(OreKind.Gold, node.kind === NodeKind.MineA ? MineTier.A : MineTier.B)
    }

    function deliveredTokenImageUrl(tokenId: string): string | undefined {
        const token = MineTokensById[tokenId]
        return token ? mineTokenBackImageUrl(OreKind.Gold, token.tier) : undefined
    }

    const market = $derived(gameSession.gameState.market)

    function toggleShareSplay(companyId: CompanyId) {
        gameSession.splayedShareCompanyId =
            gameSession.splayedShareCompanyId === companyId ? undefined : companyId
    }

    const drawPileImageUrl = $derived.by(() => {
        const decade = gameSession.gameState.nextDrawPileDecade
        if (decade !== undefined) {
            return cardBackImageUrl(decade)
        }
        return market.drawPile.length > 0 ? cardImageUrl(market.drawPile[0]!) : undefined
    })

    function marketClickTitle(slotIndex: number): string {
        switch (gameSession.marketClick(slotIndex)) {
            case 'buy':
                return 'Click to buy'
            case 'gemMarket':
                return 'Click to use this card (2 gems)'
            case 'swap':
                return gameSession.swapPickSlot === undefined ? 'Click, then click a neighbour to swap' : 'Click to swap'
            default:
                return 'Click to enlarge'
        }
    }

    function cardPlacement(box: MarketSlotBox) {
        const height = box.width
        const width = Math.round((height * 369) / 516)
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        return { x: cx - width / 2, y: cy - height / 2, width, height, cx, cy }
    }

    function ownerColor(site: MineSite): string | undefined {
        return site.ownerPlayerId ? gameSession.colors.getPlayerUiColor(site.ownerPlayerId) : undefined
    }

    // Value slots still covered by a cube: everything above the slots already uncovered by cubes on
    // the map (slot 0, value 1, is the setup cube and is never covered).
    function coveredSlotIndices(cubesOnMap: number): number[] {
        const indices: number[] = []
        for (let index = Math.max(cubesOnMap, 1); index < TrackValueByCubeCount.length; index += 1) {
            indices.push(index)
        }
        return indices
    }
</script>

<svg
    bind:this={boardSvg}
    viewBox="0 0 {BoardArtSize.width} {BoardArtSize.height}"
    width={BoardArtSize.width}
    height={BoardArtSize.height}
    xmlns="http://www.w3.org/2000/svg"
    class="select-none"
>
    <image href={boardArt} x="0" y="0" width={BoardArtSize.width} height={BoardArtSize.height} />
    <GridArtOverrides artUrl={boardArt} idPrefix="board" />

    <!-- Company boards: share stacks, value-track cubes, delivered mines -->
    {#each CompanyIds as companyId (companyId)}
        {@const layout = CompanyBoardLayouts[companyId]}
        {@const company = companies.find((candidate) => candidate.id === companyId)}
        {#if company}
            {#if company.sharesRemaining > 0}
                {@const topShareIndex = SharesPerCompany - company.sharesRemaining}
                {@const shareUrl = shareImageUrl(companyId, topShareIndex, company.sharesFlipped)}
                {#each Array.from({ length: company.sharesRemaining - 1 }) as _, stackIndex (stackIndex)}
                    <rect
                        x={layout.shareBoxX - 6 + (company.sharesRemaining - 1 - stackIndex) * 1.5}
                        y={layout.shareBoxY - (company.sharesRemaining - 1 - stackIndex) * 1.5}
                        width={ShareCardWidth}
                        height={ShareCardHeight}
                        rx="3"
                        fill={CompanyColors[companyId]}
                        stroke="#111"
                        stroke-width="1"
                    />
                {/each}
                {#if shareUrl}
                    <image
                        href={shareUrl}
                        x={layout.shareBoxX - 6}
                        y={layout.shareBoxY}
                        width={ShareCardWidth}
                        height={ShareCardHeight}
                        preserveAspectRatio="xMidYMid meet"
                        class="share-stack"
                        role="button"
                        tabindex="0"
                        onclick={() => toggleShareSplay(companyId)}
                        onkeydown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                toggleShareSplay(companyId)
                            }
                        }}
                    >
                        <title>{company.sharesRemaining} share{company.sharesRemaining === 1 ? '' : 's'} left - click to fan out</title>
                    </image>
                {/if}
            {/if}
            {#each coveredSlotIndices(company.cubesOnMap) as slotIndex (slotIndex)}
                <rect
                    x={layout.slotX - CubeSize / 2}
                    y={layout.bottomY - slotIndex * layout.slotSpacing - CubeSize / 2}
                    width={CubeSize}
                    height={CubeSize}
                    rx="3"
                    fill={CompanyColors[companyId]}
                    stroke="#111"
                    stroke-width="2"
                />
            {/each}
            {#each company.deliveredMineTokenIds as tokenId, deliveryIndex (tokenId)}
                {@const deliveredUrl = deliveredTokenImageUrl(tokenId)}
                {@const animation = gameSession.extractAnimation}
                {@const animating = animation !== undefined && animation.goldTokenId === tokenId}
                {@const targetX = layout.circleX - 19}
                {@const targetY = layout.bottomY - deliveryIndex * layout.circleSpacing - 19}
                {@const sourceNode = animating ? BoardNodesById[animation.nodeId] : undefined}
                {#if deliveredUrl && !(animating && animation.phase === 'flip')}
                    <image
                        href={deliveredUrl}
                        class={animating ? 'fly-token' : undefined}
                        style={animating && sourceNode
                            ? `--dx: ${sourceNode.x - 19 - targetX}px; --dy: ${sourceNode.y - 19 - targetY}px;`
                            : undefined}
                        x={targetX}
                        y={targetY}
                        width="38"
                        height="38"
                    />
                {/if}
            {/each}
            {#if company.connectedToDornochDur}
                <rect
                    x={layout.dornochDurBoxX - 18}
                    y={layout.dornochDurBoxY - 18}
                    width="36"
                    height="36"
                    rx="4"
                    fill="none"
                    stroke="#ffd36e"
                    stroke-width="4"
                />
            {:else}
                <rect
                    x={layout.dornochDurBoxX - CubeSize / 2}
                    y={layout.dornochDurBoxY - CubeSize / 2}
                    width={CubeSize}
                    height={CubeSize}
                    rx="3"
                    fill={CompanyColors[companyId]}
                    stroke="#111"
                    stroke-width="2"
                />
            {/if}
        {/if}
    {/each}

    <!-- Track cubes on the map -->
    {#each BoardBoxLocations as location (location.box.id)}
        {@const companyId = board.trackByBoxId[location.box.id]}
        {#if companyId}
            <rect
                x={location.x - BoxSize / 2}
                y={location.y - BoxSize / 2}
                width={BoxSize}
                height={BoxSize}
                rx="2"
                fill={CompanyColors[companyId]}
                stroke="#111"
                stroke-width="2"
                transform="rotate({location.angle} {location.x} {location.y})"
            />
        {/if}
    {/each}

    {#each gameSession.buildableTrackBoxes as buildable (buildable.boxId)}
        {@const location = BoardBoxLocations.find((candidate) => candidate.box.id === buildable.boxId)}
        {#if location}
            {@const glow = gameSession.trackGlowCompanyId === CompanyId.GoblinCentral ? '#000000' : CompanyColors[gameSession.trackGlowCompanyId ?? CompanyIds[0]]}
            <g
                class="buildable-box"
                role="button"
                tabindex="0"
                onclick={() => gameSession.layTrack(buildable.boxId)}
                onkeydown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        gameSession.layTrack(buildable.boxId)
                    }
                }}
            >
                <rect
                    x={location.x - BoxSize / 2 - 1}
                    y={location.y - BoxSize / 2 - 1}
                    width={BoxSize + 2}
                    height={BoxSize + 2}
                    rx="2"
                    fill="transparent"
                    stroke={glow}
                    stroke-width="3"
                    transform="rotate({location.angle} {location.x} {location.y})"
                    class="glow-box"
                    style="--glow: {glow};"
                />
            </g>
        {/if}
    {/each}

    {#each gameSession.extractRoutePreviews as preview (preview.cityId)}
        {@const points = routePolylinePoints(preview.routeNodeIds)}
        {@const color = CityRouteColors[preview.cityId] ?? '#ffd166'}
        <polyline
            {points}
            fill="none"
            stroke={color}
            stroke-width="16"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.35"
            class="pulse-soft"
            style="--glow: {color};"
            pointer-events="none"
        />
        <polyline
            {points}
            fill="none"
            stroke={color}
            stroke-width="5"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-dasharray="10 8"
            pointer-events="none"
        />
    {/each}

    <!-- Mine tokens -->
    {#each mineNodes as node (node.id)}
        {@const site = mineSite(node)}
        {@const owner = ownerColor(site)}
        {@const imageUrl = mineImageUrl(node, site)}
        {@const claimable = gameSession.claimableNodeIds.includes(node.id)}
        {@const extractable = gameSession.extractableNodeIds.includes(node.id)}
        {@const extractSelected = gameSession.extractNodeId === node.id}
        {@const newlyRevealed = newMineIds.includes(node.id)}
        {@const flipAnimation = gameSession.extractAnimation}
        {@const flipping =
            flipAnimation !== undefined && flipAnimation.nodeId === node.id && flipAnimation.phase === 'flip'}
        <g>
            {#if extractable}
                <circle
                    cx={node.x}
                    cy={node.y}
                    r={MineTokenRadius + 8}
                    fill="transparent"
                    class="claimable-mine"
                    role="button"
                    tabindex="0"
                    onclick={() => gameSession.selectExtractMine(node.id)}
                    onmouseenter={() => (gameSession.extractHoverNodeId = node.id)}
                    onmouseleave={() => (gameSession.extractHoverNodeId = undefined)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            gameSession.selectExtractMine(node.id)
                        }
                    }}
                />
            {/if}
            {#if claimable}
                <circle
                    cx={node.x}
                    cy={node.y}
                    r={MineTokenRadius + 8}
                    fill="transparent"
                    class="claimable-mine"
                    role="button"
                    tabindex="0"
                    onclick={() => gameSession.claimMine(node.id)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            gameSession.claimMine(node.id)
                        }
                    }}
                />
            {/if}
            {#if extractSelected}
                <circle
                    cx={node.x}
                    cy={node.y}
                    r={MineTokenRadius + 5}
                    fill="none"
                    stroke={activePlayerColor}
                    stroke-width="7"
                    pointer-events="none"
                />
            {/if}
            {#if imageUrl && !flipping}
                <image
                    href={imageUrl}
                    class={claimable || extractable || newlyRevealed ? 'pulse-mine' : undefined}
                    style={claimable || extractable || newlyRevealed
                        ? `pointer-events: none; --glow: ${claimable || extractable ? activePlayerColor : '#ffd166'};${extractSelected ? ' filter: none; animation: none;' : ''}`
                        : undefined}
                    x={node.x - MineTokenRadius}
                    y={node.y - MineTokenRadius}
                    width={MineTokenRadius * 2}
                    height={MineTokenRadius * 2}
                />
            {/if}
            {#if flipping && flipAnimation}
                {@const silverToken = flipAnimation.silverTokenId
                    ? MineTokensById[flipAnimation.silverTokenId]
                    : undefined}
                {@const silverFace = silverToken ? mineTokenImageUrl(silverToken) : undefined}
                <image
                    href={mineTokenBackImageUrl(OreKind.Silver, flipAnimation.tier === 'A' ? MineTier.A : MineTier.B)}
                    class="flip-back"
                    x={node.x - MineTokenRadius}
                    y={node.y - MineTokenRadius}
                    width={MineTokenRadius * 2}
                    height={MineTokenRadius * 2}
                    pointer-events="none"
                />
                {#if silverFace}
                    <image
                        href={silverFace}
                        class="flip-face"
                        x={node.x - MineTokenRadius}
                        y={node.y - MineTokenRadius}
                        width={MineTokenRadius * 2}
                        height={MineTokenRadius * 2}
                        pointer-events="none"
                    />
                {/if}
            {/if}
            {#if owner}
                <circle cx={node.x + 20} cy={node.y + 20} r="18" fill={owner} stroke="#111" stroke-width="3" />
            {/if}
        </g>
    {/each}

    <!-- Development card market (right edge of the board) -->
    {#if drawPileImageUrl}
        {@const placement = cardPlacement(DrawPileBox)}
        <image
            href={drawPileImageUrl}
            x={placement.x}
            y={placement.y}
            width={placement.width}
            height={placement.height}
            transform="rotate(90 {placement.cx} {placement.cy})"
        />
        <text x={DrawPileBox.x + 6} y={DrawPileBox.y + DrawPileBox.height - 6} font-size="14" fill="#f1e6cf" opacity="0.9"
            >{market.drawPile.length} left</text
        >
    {/if}
    {#each MarketSlotBoxes as box, index (index)}
        {@const cardId = market.slots[index]}
        {@const imageUrl = cardId ? cardImageUrl(cardId) : undefined}
        {#if cardId && imageUrl}
            {@const placement = cardPlacement(box)}
            <g transform="rotate(90 {placement.cx} {placement.cy})">
                <image
                    href={imageUrl}
                    x={placement.x}
                    y={placement.y}
                    width={placement.width}
                    height={placement.height}
                    class="{newCardIds.includes(cardId) ? 'market-card card-enter' : 'market-card'} {gameSession.marketClick(index)
                        ? 'market-card-actionable'
                        : ''} {gameSession.swapPickSlot === index ? 'market-card-picked' : ''}"
                    role="button"
                    tabindex="0"
                    onclick={() => gameSession.clickMarketCard(index, cardId, imageUrl)}
                    onpointerenter={(event) => gameSession.previewCard(event, cardId, imageUrl)}
                    onpointerleave={() => gameSession.clearCardPreview()}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            gameSession.clickMarketCard(index, cardId, imageUrl)
                        }
                    }}
                >
                    <title>{marketClickTitle(index)}</title>
                </image>
            </g>
        {/if}
    {/each}

    {#each GemTrackFillOrder as spot, index (index)}
        {#if index < gameSession.gameState.gemsSpent}
            <polygon
                points={hexagonPoints(spot, GemHexRadius)}
                fill="#b3122b"
                stroke="#3d0710"
                stroke-width="2"
                style="pointer-events: none;"
            />
        {/if}
    {/each}

    <!-- Player discs: weapon/tool grid -->
    {#each players as player (player.playerId)}
        {@const group = gridGroups.get(`${player.weaponLevel},${player.toolLevel}`) ?? []}
        {@const offset = stackOffset(group.indexOf(player.playerId), group.length)}
        {@const cell = gridCellPosition(player.weaponLevel, player.toolLevel)}
        <circle
            cx={cell.x + offset.dx}
            cy={cell.y + offset.dy}
            r={PlayerDiscRadius}
            fill={player.color}
            stroke="#111"
            stroke-width="2"
        />
    {/each}

    {#each gameSession.acquirePlans as plan (plan.choice)}
        {@const target = gridCellPosition(plan.destination.weapon, plan.destination.tool)}
        <circle
            cx={target.x}
            cy={target.y}
            r={PlayerDiscRadius + 8}
            fill={activePlayerColor}
            fill-opacity="0.18"
            stroke={activePlayerColor}
            stroke-width="4"
            class="pulse-soft"
            style="--glow: {activePlayerColor}; cursor: pointer;"
            role="button"
            tabindex="0"
            onclick={() => gameSession.acquire(plan.choice)}
            onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    gameSession.acquire(plan.choice)
                }
            }}
        />
    {/each}

    <!-- Player discs: victory point track -->
    {#each players as player (player.playerId)}
        {@const key = ((player.victoryPoints % 100) + 100) % 100}
        {@const group = victoryPointGroups.get(key) ?? []}
        {@const offset = stackOffset(group.indexOf(player.playerId), group.length, 2)}
        {@const spot = victoryPointPosition(player.victoryPoints)}
        <circle
            cx={spot.x + offset.dx}
            cy={spot.y + offset.dy}
            r={VictoryPointDiscRadius}
            fill={player.color}
            stroke="#111"
            stroke-width="3"
        />
    {/each}

    <!-- Agreement stacks beside the delivery cities (face up; rotated like the printed boxes) -->
    {#each [DeliveryCityId.Dornoch, DeliveryCityId.Manor] as cityId (cityId)}
        {@const box = AgreementBoxes[cityId]}
        {@const stack = gameSession.gameState.agreementStacks[cityId] ?? []}
        {@const topLetter = stack[0]}
        {@const topUrl = topLetter ? agreementImageUrl(cityId, topLetter) : undefined}
        {@const cardHeight = box.width}
        {@const cardWidth = Math.round(cardHeight * 1.66)}
        {@const cx = box.x + box.width / 2}
        {@const cy = box.y + box.height / 2}
        {#if topLetter && topUrl}
            {#each Array.from({ length: stack.length - 1 }) as _, stackIndex (stackIndex)}
                <g transform="rotate(90 {cx} {cy}) translate({-(stack.length - 1 - stackIndex) * 1.5}, {(stack.length - 1 - stackIndex) * 1.5})">
                    <rect
                        x={cx - cardWidth / 2}
                        y={cy - cardHeight / 2}
                        width={cardWidth}
                        height={cardHeight}
                        rx="3"
                        fill={cityId === DeliveryCityId.Dornoch ? '#9a753b' : '#324a54'}
                        stroke="#111"
                        stroke-width="1"
                    />
                </g>
            {/each}
            <g transform="rotate(90 {cx} {cy})">
                <image
                    href={topUrl}
                    x={cx - cardWidth / 2}
                    y={cy - cardHeight / 2}
                    width={cardWidth}
                    height={cardHeight}
                    preserveAspectRatio="xMidYMid meet"
                    class="market-card"
                    role="button"
                    tabindex="0"
                    onclick={() => gameSession.zoomCard(`${cityId} agreement ${topLetter}`, topUrl)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            gameSession.zoomCard(`${cityId} agreement ${topLetter}`, topUrl)
                        }
                    }}
                >
                    <title>{agreementTooltip(cityId, topLetter)} ({stack.length} left)</title>
                </image>
            </g>
            <text x={box.x + box.width - 4} y={box.y + box.height - 6} text-anchor="end" font-size="14" font-weight="700" fill="#fff" stroke="#000" stroke-width="0.6"
                >{stack.length}</text
            >
        {/if}
    {/each}

    <!-- Scourges per region: card art splayed inside each region's printed box -->
    {#each RegionIds as region (region)}
        {@const box = ScourgeBoxes[region]}
        {@const scourges = board.scourgesByRegion[region] ?? []}
        {#each scourges as scourge, index (scourge.scourgeId)}
            {@const imageUrl = scourgeImageUrl(scourge.scourgeId)}
            {@const definition = ScourgeDefinitionsById[scourge.scourgeId]}
            {@const cx = box.landscape
                ? box.x + ScourgeCardHeight / 2 + 4
                : box.x + ScourgeCardWidth / 2 + 5 + (scourges.length - 1 - index) * ScourgeSplayStep}
            {@const cy = box.landscape
                ? box.y + ScourgeCardWidth / 2 + 6 + (scourges.length - 1 - index) * ScourgeSplayStep
                : box.y + ScourgeCardHeight / 2 + 9}
            {#if imageUrl}
                <image
                    href={imageUrl}
                    x={cx - ScourgeCardWidth / 2}
                    y={cy - ScourgeCardHeight / 2}
                    width={ScourgeCardWidth}
                    height={ScourgeCardHeight}
                    transform={box.landscape ? `rotate(90, ${cx}, ${cy})` : undefined}
                    data-scourge-id={scourge.scourgeId}
                    data-landscape={box.landscape ? 'true' : 'false'}
                    opacity={gameSession.revealScourgeId === scourge.scourgeId ? 0 : 1}
                    class="scourge-card {gameSession.landedScourgeId === scourge.scourgeId ? 'scourge-landed' : ''}"
                    role="button"
                    tabindex="0"
                    onclick={() => (gameSession.scourgeOverlayRegion = region)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            gameSession.scourgeOverlayRegion = region
                        }
                    }}
                >
                    <title>{definition?.name ?? scourge.scourgeId} - level {scourge.level}, {scourge.hits} hit{scourge.hits === 1 ? '' : 's'}</title>
                </image>
            {/if}
            {#if scourge.hits > 0}
                <g transform="translate({cx + (box.landscape ? 55 : 38)}, {cy - (box.landscape ? 38 : 58)})">
                    <circle r="13" fill="#d3342f" stroke="#111" stroke-width="2" />
                    <text y="5" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">{scourge.hits}</text>
                </g>
            {/if}
        {/each}
    {/each}
    <!-- Fanned-out share stack (click the stack again, or anywhere on the fan, to close) -->
    {#if gameSession.splayedShareCompanyId}
        {@const companyId = gameSession.splayedShareCompanyId}
        {@const layout = CompanyBoardLayouts[companyId]}
        {@const company = companies.find((candidate) => candidate.id === companyId)}
        {#if company}
            {@const firstIndex = SharesPerCompany - company.sharesRemaining}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <g onclick={() => (gameSession.splayedShareCompanyId = undefined)} class="share-fan">
                <rect
                    x={layout.shareBoxX + ShareSplayStep - 12}
                    y={layout.shareBoxY - 10}
                    width={company.sharesRemaining * ShareSplayStep + 12}
                    height={ShareCardHeight + 20}
                    rx="8"
                    fill="#0b0e1a"
                    opacity="0.85"
                />
                {#each Array.from({ length: company.sharesRemaining }) as _, offset (offset)}
                    {@const shareIndex = firstIndex + offset}
                    {@const url = shareImageUrl(companyId, shareIndex, company.sharesFlipped)}
                    {#if url}
                        <image
                            href={url}
                            x={layout.shareBoxX + ShareSplayStep * (offset + 1)}
                            y={layout.shareBoxY}
                            width={ShareCardWidth}
                            height={ShareCardHeight}
                            preserveAspectRatio="xMidYMid meet"
                        />
                    {/if}
                {/each}
            </g>
        {/if}
    {/if}
    {#if gameSession.extractCustomRoute}
        {@const route = gameSession.extractCustomRoute}
        {@const routeColor = gameSession.extractCustomCityId ? (CityRouteColors[gameSession.extractCustomCityId] ?? '#3ddc84') : '#3ddc84'}
        {#if route.length > 1}
            <polyline
                points={routePolylinePoints(route)}
                fill="none"
                stroke={routeColor}
                stroke-width="16"
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.35"
                pointer-events="none"
            />
            <polyline
                points={routePolylinePoints(route)}
                fill="none"
                stroke={routeColor}
                stroke-width="6"
                stroke-linecap="round"
                stroke-linejoin="round"
                pointer-events="none"
            />
        {/if}
        {#each route.slice(1) as nodeId (nodeId)}
            {@const node = BoardNodesById[nodeId]}
            {#if node}
                <circle
                    cx={node.x}
                    cy={node.y}
                    r="12"
                    fill={routeColor}
                    stroke="#1a120b"
                    stroke-width="3"
                    role="button"
                    tabindex="0"
                    style="cursor: pointer;"
                    onclick={() => gameSession.stepCustomRoute(nodeId)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            gameSession.stepCustomRoute(nodeId)
                        }
                    }}
                >
                    <title>Cut the route back to {node.name}</title>
                </circle>
            {/if}
        {/each}
        {#each gameSession.extractRouteChoices as nodeId (nodeId)}
            {@const node = BoardNodesById[nodeId]}
            {#if node}
                {@const choiceColor = CityRouteColors[nodeId] ?? '#3ddc84'}
                <circle
                    cx={node.x}
                    cy={node.y}
                    r="24"
                    fill={choiceColor}
                    fill-opacity="0.25"
                    stroke={choiceColor}
                    stroke-width="5"
                    class="pulse-soft"
                    style="--glow: {choiceColor}; cursor: pointer;"
                    role="button"
                    tabindex="0"
                    onclick={() => gameSession.stepCustomRoute(nodeId)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            gameSession.stepCustomRoute(nodeId)
                        }
                    }}
                >
                    <title>{node.name}</title>
                </circle>
            {/if}
        {/each}
    {/if}

    {#if huntPickRegions.length > 0}
        <g pointer-events="none" filter="url(#hunt-region-soften)">
            {#each huntPickRegions as region (region)}
                {@const hovered = huntHoverRegion === region}
                <g fill={hovered ? '#ff5a3c' : '#ffb347'} opacity={hovered ? 0.36 : 0.18}>
                    {#each RegionRuns[region] as run, index (index)}
                        <rect x={run.x} y={run.y} width={run.width + 0.5} height={run.height + 0.5} />
                    {/each}
                </g>
            {/each}
        </g>
        <filter id="hunt-region-soften" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="6" />
        </filter>
        {#each huntPickRegions as region (region)}
            {@const label = regionLabelPoint(region)}
            {@const hovered = huntHoverRegion === region}
            <g transform="translate({label.x}, {label.y})" pointer-events="none">
                <rect
                    x="-90"
                    y="-22"
                    width="180"
                    height="40"
                    rx="10"
                    fill={hovered ? '#b3261e' : '#2a1a0e'}
                    stroke="#ffd166"
                    stroke-width={hovered ? 3 : 1.5}
                    opacity="0.92"
                />
                <text y="7" text-anchor="middle" font-size="22" font-weight="700" fill="#fff4dc">
                    {RegionNames[region]} · {remainingHuntValue(region)}
                </text>
            </g>
        {/each}
        <rect
            x={RegionMapBounds.x}
            y={RegionMapBounds.y}
            width={RegionMapBounds.width}
            height={RegionMapBounds.height}
            fill="transparent"
            role="button"
            tabindex="-1"
            aria-label="Choose a region to hunt"
            style="cursor: {huntHoverRegion ? 'crosshair' : 'default'};"
            onpointermove={(event) => (huntHoverRegion = huntRegionAt(event))}
            onpointerleave={() => (huntHoverRegion = undefined)}
            onclick={(event) => {
                const region = huntRegionAt(event)
                if (region) {
                    huntHoverRegion = undefined
                    gameSession.hunt(region)
                }
            }}
            onkeydown={() => undefined}
        />
    {/if}
</svg>

<style>
    .scourge-landed {
        animation: scourge-landed 0.6s ease-out both;
    }
    @keyframes scourge-landed {
        0% {
            filter: brightness(2.2) drop-shadow(0 0 14px rgba(255, 90, 79, 1));
        }
        100% {
            filter: none;
        }
    }
    .market-card,
    .scourge-card,
    .share-stack,
    .share-fan {
        cursor: pointer;
    }
    .buildable-box,
    .claimable-mine {
        cursor: pointer;
    }
    .buildable-box,
    .buildable-box *,
    .claimable-mine {
        outline: none;
    }
    .buildable-box:focus,
    .claimable-mine:focus {
        outline: none;
    }
    .card-enter {
        transform-box: fill-box;
        transform-origin: center;
        animation: card-enter 1.1s cubic-bezier(0.2, 0.8, 0.3, 1) both;
    }
    @keyframes card-enter {
        0% {
            opacity: 0;
            transform: translateX(-160px) scale(1.35);
            filter: drop-shadow(0 0 0 rgba(255, 214, 110, 0));
        }
        55% {
            opacity: 1;
            transform: translateX(0) scale(1.12);
            filter: drop-shadow(0 0 18px rgba(255, 214, 110, 1));
        }
        100% {
            opacity: 1;
            transform: none;
            filter: drop-shadow(0 0 0 rgba(255, 214, 110, 0));
        }
    }
    .flip-back,
    .flip-face,
    .fly-token {
        transform-box: fill-box;
        transform-origin: center;
    }
    .flip-back {
        animation: flip-back 2.4s ease-in-out forwards;
    }
    .flip-face {
        animation: flip-face 2.4s ease-in-out forwards;
    }
    @keyframes flip-back {
        0% {
            transform: scale(1, 1);
        }
        20% {
            transform: scale(2.4, 2.4);
        }
        45%,
        100% {
            transform: scale(0, 2.4);
        }
    }
    @keyframes flip-face {
        0%,
        45% {
            transform: scale(0, 2.4);
        }
        70% {
            transform: scale(2.4, 2.4);
        }
        100% {
            transform: scale(1, 1);
        }
    }
    .fly-token {
        animation: fly-token 2.3s ease-in-out both;
    }
    @keyframes fly-token {
        from {
            transform: translate(var(--dx), var(--dy)) scale(1.9);
        }
        to {
            transform: translate(0, 0) scale(1);
        }
    }
    .pulse-soft {
        filter: drop-shadow(0 0 2px var(--glow));
        animation: pulse-soft 1.8s ease-in-out infinite;
    }
    @keyframes pulse-soft {
        0%,
        100% {
            opacity: 0.7;
        }
        50% {
            opacity: 1;
        }
    }
    .pulse-mine {
        filter: drop-shadow(0 0 3px var(--glow)) drop-shadow(0 0 3px var(--glow))
            drop-shadow(0 0 6px var(--glow)) drop-shadow(0 0 10px var(--glow));
        animation: pulse-mine 1.4s ease-in-out infinite;
    }
    @keyframes pulse-mine {
        0%,
        100% {
            filter: drop-shadow(0 0 3px var(--glow)) drop-shadow(0 0 3px var(--glow))
                drop-shadow(0 0 5px var(--glow)) drop-shadow(0 0 8px var(--glow));
        }
        50% {
            filter: drop-shadow(0 0 5px var(--glow)) drop-shadow(0 0 5px var(--glow))
                drop-shadow(0 0 10px var(--glow)) drop-shadow(0 0 18px var(--glow))
                drop-shadow(0 0 26px var(--glow));
        }
    }
    .glow-box {
        filter: drop-shadow(0 0 6px var(--glow)) drop-shadow(0 0 12px var(--glow));
        animation: glow-box-pulse 1.4s ease-in-out infinite;
    }
    @keyframes glow-box-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 4px var(--glow)) drop-shadow(0 0 8px var(--glow));
        }
        50% {
            filter: drop-shadow(0 0 9px var(--glow)) drop-shadow(0 0 20px var(--glow));
        }
    }
    .market-card-actionable {
        outline: 3px solid #ffd166;
        outline-offset: -3px;
    }
    .market-card-picked {
        outline: 4px solid #7fd1ff;
        outline-offset: -4px;
    }
    .market-card:hover {
        animation: market-card-pulse 1.2s ease-in-out infinite;
    }
    @keyframes market-card-pulse {
        0% {
            filter: drop-shadow(0 0 0 rgba(255, 214, 110, 0.9));
        }
        50% {
            filter: drop-shadow(0 0 14px rgba(255, 214, 110, 1));
        }
        100% {
            filter: drop-shadow(0 0 0 rgba(255, 214, 110, 0.9));
        }
    }
</style>
