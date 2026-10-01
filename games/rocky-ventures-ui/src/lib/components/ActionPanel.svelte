<script lang="ts">
    import { DummyName } from '$lib/utils/dummyDisplay.js'
    import {
        DummyPlayerId,
        finalScores,
        ActionType,
        BoardNodesById,
        CardActionKind,
        CardKind,
        CompanyAbbreviations,
        CompanyNames,
        DeliveryCityId,
        DragonHuntRegion,
        OreCapacityByToolLevel,
        HuntDrawRuleByWeaponLevel,
        isRedGemCell,
        isBlueGemCell,
        MaxGems,
        RegionIds,
        RegionNames,
        WeaponTokenKind,
        huntableRegions,
        huntTargets,
        OreKind,
        oreExtracted,
        planExtraction,
        reasonExtractInvalid,
        ImplementedActionKinds,
        MachineState,
        buildableBoxes,
        layTrackLimits,
        PawnSkipCost,
        taxIncomeFor,
        getCard,
        isDiscardable,
        marketCardCost,
        pawnMoveCost,
        reasonPawnMoveInvalid,
        remainingActionKinds,
        skippedIndexes
    } from '@tabletop/rocky-ventures'
    import { PlayerName } from '@tabletop/frontend-components'
    import { CityRouteColors } from '$lib/utils/routePath.js'
    import SellVictoryPointsControl from '$lib/components/SellVictoryPoints.svelte'
    import AgreementDiscard from '$lib/components/AgreementDiscard.svelte'
    import GemActions from '$lib/components/GemActions.svelte'
    import gemIcon from '$lib/images/icons/gem.png'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { shareImageUrl } from '$lib/utils/shareImages.js'
    import { CompanyColors, CompanyTextColors } from '$lib/utils/companyDisplay.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'
    import Pawn from '$lib/components/Pawn.svelte'
    import { scourgeImageUrl } from '$lib/utils/scourgeImages.js'
    import { DragonTileImageUrl, weaponTokenImageUrl } from '$lib/utils/dragonImages.js'

    const gameSession = getGameSession()

    const gameState = $derived(gameSession.gameState)
    const activeId = $derived(gameState.activePlayerIds[0])
    const player = $derived(activeId ? gameState.getPlayerState(activeId) : undefined)
    const canAct = $derived(gameSession.isMyTurn && !gameSession.isViewingHistory)
    const validTypes = $derived(gameSession.validActionTypes)
    const playerColor = $derived(activeId ? gameSession.colors.getPlayerBgColorValue(activeId) : '#888888')

    function regionLabel(region: string): string {
        if (region === DragonHuntRegion) {
            return 'Dragon'
        }
        const id = RegionIds.find((candidate) => candidate === region)
        return id ? RegionNames[id] : region
    }

    const actionLabels: Record<CardActionKind, string> = {
        [CardActionKind.Invest]: 'Invest',
        [CardActionKind.Tax]: 'Tax',
        [CardActionKind.ClaimMine]: 'Claim Mine',
        [CardActionKind.LayTrack]: 'Lay Track',
        [CardActionKind.ExtractAndSell]: 'Extract & Sell',
        [CardActionKind.Acquire]: 'Acquire',
        [CardActionKind.Hunt]: 'Hunt'
    }

    function thumbUrl(cardId: string): string | undefined {
        const card = getCard(cardId)
        return card.kind === CardKind.Player
            ? playerCardImageUrl(cardId, player?.color)
            : cardImageUrl(cardId)
    }

    function cardLabel(cardId: string): string {
        const card = getCard(cardId)
        switch (card.kind) {
            case CardKind.Player:
                return card.numeral
            case CardKind.Development:
                return `#${card.number}`
            case CardKind.EndOfEra:
                return `Era ${card.era}`
            case CardKind.GameOver:
                return 'Game Over'
        }
    }

    const moveTarget = $derived(gameSession.moveTargetIndex)
    const skipped = $derived(
        player && moveTarget !== undefined ? skippedIndexes(player, moveTarget) : undefined
    )
    const moveCost = $derived(
        player && skipped ? pawnMoveCost(player, skipped.length, gameSession.moveDiscardIndexes.length) : 0
    )
    const moveInvalidReason = $derived(
        player && moveTarget !== undefined
            ? reasonPawnMoveInvalid(player, moveTarget, gameSession.moveDiscardIndexes)
            : undefined
    )

    const remaining = $derived(canAct && player ? remainingActionKinds(gameState) : [])
    const comingLater = $derived(
        remaining.filter((kind) => !ImplementedActionKinds.includes(kind)).map((kind) => actionLabels[kind])
    )
    const taxIncome = $derived(player ? taxIncomeFor(player.tuckedCardIds.length + 1) : 0)

    const pointBuyCard = $derived.by(() => {
        const cardId = gameState.pointBuy?.cardId
        if (!cardId) return undefined
        const card = getCard(cardId)
        return card.kind === CardKind.EndOfEra ? card : undefined
    })

    const convertCash = $derived.by(() => {
        const selection = gameSession.pointBuyConvertShare
        if (!selection) return 0
        const company = gameState.getCompany(selection.companyId)
        return company.multiplierForShare(selection.shareIndex) * company.value
    })
    const maxBundles = $derived(
        player && pointBuyCard ? Math.floor((player.money + convertCash) / pointBuyCard.pointBuyCost) : 0
    )
    const bundles = $derived(Math.min(gameSession.pointBuyBundles, maxBundles))
</script>

<div class="px-4 py-2 text-[#f1e6cf] text-sm">
    {#if gameSession.lastActionError}
        <div class="mb-2 rounded border border-red-500 bg-red-900/40 px-2 py-1 text-red-100">
            {gameSession.lastActionError}
        </div>
    {/if}

    {#if gameSession.gameState.result}
        {@const scores = [...finalScores(gameState)].sort((left, right) => right.total - left.total)}
        <table class="text-sm">
            <thead>
                <tr class="text-left text-[11px] uppercase tracking-wide text-[#c9a961]">
                    <th class="pr-4">Player</th>
                    <th class="pr-4">VP</th>
                    <th class="pr-4">Cash</th>
                    <th class="pr-4">Shares cashed</th>
                    <th class="pr-4">Total cash</th>
                    <th class="pr-4">Cash ÷ 5 = VP</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {#each scores as score (score.playerId)}
                    <tr class={gameState.winningPlayerIds.includes(score.playerId) ? 'font-bold text-[#ffd166]' : ''}>
                        <td class="pr-4">{#if score.playerId === DummyPlayerId}{DummyName}{:else}<PlayerName playerId={score.playerId} />{/if}</td>
                        <td class="pr-4">{score.victoryPoints}</td>
                        <td class="pr-4">{`$${score.money}`}</td>
                        <td class="pr-4">+{`$${score.shareValue}`}</td>
                        <td class="pr-4">{`$${score.money + score.shareValue}`}</td>
                        <td class="pr-4">+{score.conversionVictoryPoints}</td>
                        <td>{score.total}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {:else if !canAct || !player}
        <div class="text-[#c9a961]">Waiting for the active player.</div>
    {:else if gameState.machineState === MachineState.AgreementPointBuy && gameState.pendingAgreementBuy}
        <div class="flex flex-wrap items-center gap-3">
            <span class="font-semibold">Sale earned {`$${gameState.pendingAgreementBuy.income}`}.</span>
            <button
                type="button"
                onclick={() => gameSession.buyAgreementPoints(true)}
                class="rv-btn text-sm"
            >
                Buy 3 VP · {`$${6}`}
            </button>
            <button
                type="button"
                onclick={() => gameSession.buyAgreementPoints(false)}
                class="rv-quiet"
            >
                No thanks
            </button>
        </div>
    {:else if gameState.machineState === MachineState.FreeTrack && gameState.freeTrack}
        {@const freeTrack = gameState.freeTrack}
        <div class="flex flex-wrap items-center gap-3">
            <span
                class="rounded px-2 py-1 text-xs font-semibold"
                style="background-color: {CompanyColors[freeTrack.companyId]}; color: {CompanyTextColors[freeTrack.companyId]};"
                >{CompanyNames[freeTrack.companyId]}</span
            >
            <span>Free track: <strong>{freeTrack.remaining}</strong> left</span>
            <button
                type="button"
                onclick={() => gameSession.stopFreeTrack()}
                class="rv-quiet"
            >
                Done
            </button>
        </div>
    {:else if gameSession.discardPick}
        <AgreementDiscard />
    {:else if gameSession.gemMode}
        <GemActions />
    {:else if gameState.machineState === MachineState.MovePawn}
        {#if player.gems > 0 && moveTarget === undefined}
            <GemActions />
        {/if}
        {#if moveTarget === undefined}
            <div class="flex flex-wrap items-start gap-x-4">
                <AgreementDiscard />
                <SellVictoryPointsControl />
            </div>
        {/if}
        <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="font-semibold">Move your action pawn.</span>
            <span class="text-xs text-[#c9a961]">
                {#if player.pawnIndex === undefined}
                    First move: place the pawn on any card, free.
                {:else}
                    Left goes all the way back to card I. Moving right, pay {`$${PawnSkipCost}`} per skipped card or discard it.
                {/if}
            </span>
        </div>
        <div class="flex flex-wrap items-end gap-3 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1 max-sm:*:shrink-0">
            {#if player.pawnIndex === undefined}
                <div class="flex flex-col items-center" style="margin-bottom: 26px;">
                    <Pawn fill={playerColor} height={72} />
                </div>
            {/if}
            {#each player.tableau as cardId, index (cardId)}
                {@const legal = skippedIndexes(player, index) !== undefined}
                {@const isTarget = moveTarget === index}
                {@const isSkipped = player.pawnIndex !== undefined && (skipped?.includes(index) ?? false)}
                {@const discarded = gameSession.moveDiscardIndexes.includes(index)}
                <div
                    class="flex flex-col items-center gap-1 overflow-hidden"
                    style="transition: max-width 1s ease-in-out 0.25s, opacity 0.6s ease-in, transform 0.9s ease-in, margin 1s ease-in-out 0.25s; max-width: {gameSession.discardAnimating && discarded ? 0 : 200}px; opacity: {gameSession.discardAnimating && discarded ? 0 : 1}; transform: {gameSession.discardAnimating && discarded ? 'scale(0.6) translateY(24px)' : 'none'}; margin-right: {gameSession.discardAnimating && discarded ? '-12px' : '0'}; pointer-events: {gameSession.discardAnimating ? 'none' : 'auto'};"
                >
                    <div class="relative">
                        {#if player.pawnIndex === index}
                            <div class="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
                                <Pawn fill={playerColor} height={72} />
                            </div>
                        {/if}
                    <button
                        type="button"
                        disabled={!legal}
                        onclick={() => gameSession.selectMoveTarget(index)}
                        class="relative z-10 block overflow-hidden rounded border-2 bg-white transition"
                        style="border-color: {isTarget ? '#ffd166' : isSkipped ? (discarded ? '#c9302c' : '#b8700a') : '#4a3620'}; filter: {legal ? 'none' : 'brightness(0.55)'};"
                        title={legal ? `Move to ${cardLabel(cardId)}` : 'Not a legal move'}
                    >
                        {#if thumbUrl(cardId)}
                            <img src={thumbUrl(cardId)} alt={cardLabel(cardId)} class="block h-[160px] w-auto max-sm:h-[112px]" draggable="false" />
                        {:else}
                            <div class="flex h-[160px] w-[106px] max-sm:h-[112px] max-sm:w-[74px] items-center justify-center bg-[#3d2c1a] font-bold">{cardLabel(cardId)}</div>
                        {/if}
                        {#if isSkipped && discarded}
                            <div class="absolute inset-0 flex items-center justify-center bg-red-900/60 text-xs font-bold">DISCARD</div>
                        {/if}
                    </button>
                    </div>
                    {#if isSkipped}
                        {@const paid = gameSession.movePaidIndexes.includes(index)}
                        {@const canPay = paid || player.money - gameSession.movePaidIndexes.length >= PawnSkipCost}
                        {@const chosen = paid ? 'pay' : discarded ? 'discard' : undefined}
                        <div class="flex w-full flex-col items-stretch gap-0.5 text-[11px] font-semibold">
                            <button
                                type="button"
                                disabled={!canPay}
                                class="rv-lift border-2 px-2 py-1 disabled:opacity-40"
                                style="background-color: {chosen === 'pay' ? '#2f8f57' : '#173d28'}; border-color: {chosen === 'pay' ? '#ffd166' : '#2f8f57'}; color: #fff; opacity: {chosen === 'discard' ? 0.45 : 1};"
                                onclick={() => gameSession.decideSkippedCard(index, false)}
                            >
                                {chosen === 'pay' ? '✓ ' : ''}{`Pay $${PawnSkipCost}`}
                            </button>
                            {#if isDiscardable(player, index)}
                                <span class="text-center text-[10px] uppercase tracking-wide text-[#c9a961]">or</span>
                                <button
                                    type="button"
                                    class="rv-lift border-2 px-2 py-1"
                                    style="background-color: {chosen === 'discard' ? '#c9302c' : '#4a1614'}; border-color: {chosen === 'discard' ? '#ffd166' : '#c9302c'}; color: #fff; opacity: {chosen === 'pay' ? 0.45 : 1};"
                                    onclick={() => gameSession.decideSkippedCard(index, true)}
                                >
                                    {chosen === 'discard' ? '✓ ' : ''}Discard
                                </button>
                            {/if}
                        </div>
                    {:else}
                        <span class="h-[22px]"></span>
                    {/if}
                </div>
            {/each}
        </div>
    {:else if gameState.machineState === MachineState.TakeActions}
        {#if player.gems > 0 && !gameSession.investPickerOpen}
            <GemActions />
        {/if}
        <div class="flex flex-wrap items-start gap-x-4">
            {#if !gameSession.investPickerOpen}
                <AgreementDiscard />
            {/if}
            <SellVictoryPointsControl />
        </div>
        {#if !gameSession.investPickerOpen}
        <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="text-xs text-[#c9a961]">
                Take any available action, or pass.
                {#if comingLater.length > 0}
                    Not playable yet: {comingLater.join(', ')}.
                {/if}
                {#if remaining.includes(CardActionKind.ExtractAndSell) && !validTypes.includes(ActionType.ExtractAndSell)}
                    You have no claimed mine to extract from.
                {/if}
                {#if remaining.includes(CardActionKind.LayTrack) && !validTypes.includes(ActionType.LayTrack)}
                    No track can be laid right now.
                {/if}
                {#if remaining.includes(CardActionKind.ClaimMine)}
                    {#if !validTypes.includes(ActionType.ClaimMine)}
                        No mine can be claimed right now.
                    {/if}
                    The card's bonus hunt is not playable yet.
                {/if}
            </span>
        </div>
        {/if}
        {#if gameSession.claimHuntNodeId}
            {@const claimNodeId = gameSession.claimHuntNodeId}
            {@const claimRegion = BoardNodesById[claimNodeId]?.region}
            <div class="flex flex-wrap items-center gap-3">
                {#if claimRegion}
                    <button
                        type="button"
                        onclick={() => gameSession.claimMine(claimNodeId, false)}
                        class="rv-btn text-sm"
                    >
                        Hunt {regionLabel(claimRegion)}
                    </button>
                {/if}
                <button
                    type="button"
                    onclick={() => gameSession.claimMine(claimNodeId, true)}
                    class="rv-btn rv-danger text-sm"
                >
                    Hunt {regionLabel(DragonHuntRegion)}
                </button>
                <button
                    type="button"
                    onclick={() => gameSession.clearLocalSelection()}
                    class="rv-quiet"
                >
                    Back
                </button>
            </div>
        {:else if gameSession.extractActive}
            {@const extractNodeId = gameSession.extractNodeId}
            {@const extractSite = extractNodeId ? gameState.board.mines[extractNodeId] : undefined}
            {@const extractToken = extractSite?.token}
            {@const extractPlan = gameSession.extractPlan}
            {@const extractProblem =
                extractNodeId && activeId
                    ? reasonExtractInvalid(gameState, activeId, {
                          nodeId: extractNodeId,
                          cityId: gameSession.extractCityId,
                          creditCompanyId: gameSession.extractCreditCompanyId,
                          routeNodeIds: gameSession.extractCustomCityId ? gameSession.extractCustomRoute : undefined
                      })
                    : undefined}
            <div class="flex flex-col gap-2">
                <div class="flex flex-wrap items-center gap-3">
                    {#if !extractNodeId || !extractToken}
                        {#if gameSession.extractableNodeIds.length === 0}
                            <span class="text-red-300">You have no claimed mine to extract from.</span>
                        {:else}
                            <span>Open the <strong>Map</strong> tab and click a glowing mine to extract &amp; sell.</span>
                        {/if}
                    {:else}
                        <span>
                            <strong>{BoardNodesById[extractNodeId]?.name}</strong>: level {extractToken.level}
                            {extractToken.ore}, extracting
                            <strong>{oreExtracted(gameState, activeId ?? '', extractNodeId)}</strong> ore.
                        </span>
                    {/if}
                    {#if gameSession.extractMode}
                        <button type="button" onclick={() => gameSession.clearLocalSelection()} class="rv-quiet">Back</button>
                    {/if}
                    <button type="button" onclick={() => gameSession.endTurn()} class="rv-quiet">Pass</button>
                </div>
                {#if extractNodeId && extractToken?.ore === OreKind.Silver && extractPlan}
                    <button
                        type="button"
                        disabled={extractProblem !== undefined}
                        onclick={() => gameSession.confirmExtract()}
                        class="rv-btn self-start text-sm"
                    >
                        Extract {extractPlan.oreCount} silver · +{`$${extractPlan.net}`}
                    </button>
                {/if}
                {#if extractNodeId && extractToken?.ore === OreKind.Gold && gameSession.extractCustomRoute}
                    {@const customCity = gameSession.extractCustomCityId}
                    <div class="flex flex-wrap items-center gap-2">
                        {#if customCity && extractPlan}
                            <button
                                type="button"
                                disabled={extractProblem !== undefined}
                                onclick={() => gameSession.confirmExtract()}
                                class="rv-btn text-sm"
                                style="--accent: {CityRouteColors[customCity]};"
                            >
                                Sell to {BoardNodesById[customCity]?.name} · {`+$${extractPlan.net}`}
                            </button>
                        {:else}
                            <span class="text-xs text-[#c9a961]">Click the next stop on the map.</span>
                        {/if}
                        <button
                            type="button"
                            disabled={gameSession.extractCustomRoute.length <= 1}
                            onclick={() => gameSession.undoCustomRouteStep()}
                            class="rv-quiet text-xs"
                        >
                            Undo step
                        </button>
                        <button
                            type="button"
                            onclick={() => gameSession.cancelModifyRoute()}
                            class="rv-quiet text-xs"
                        >
                            Cancel
                        </button>
                    </div>
                {:else if extractNodeId && extractToken?.ore === OreKind.Gold}
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs text-[#c9a961]">Sell to:</span>
                        {#each [DeliveryCityId.Dornoch, DeliveryCityId.Manor] as cityId (cityId)}
                            {@const preview = activeId
                                ? planExtraction(gameState, activeId, { nodeId: extractNodeId, cityId })
                                : undefined}
                            <button
                                type="button"
                                disabled={preview === undefined || typeof preview === 'string'}
                                onclick={() => gameSession.selectExtractCity(cityId)}
                                onmouseenter={() => (gameSession.extractHoverCityId = cityId)}
                                onmouseleave={() => (gameSession.extractHoverCityId = undefined)}
                                class="rv-btn text-xs"
                                style="--accent: {CityRouteColors[cityId]};"
                            >
                                {BoardNodesById[cityId]?.name}
                                {#if preview !== undefined && typeof preview !== 'string'}
                                    · {preview.net < 0 ? '-' : '+'}{`$${Math.abs(preview.net)}`}
                                {/if}
                            </button>
                        {/each}
                        <button
                            type="button"
                            onclick={() => gameSession.startModifyRoute()}
                            class="rv-quiet text-xs"
                        >
                            Modify
                        </button>
                    </div>
                {/if}
                {#if extractPlan && extractPlan.creditCandidates.length > 1}
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                        <span class="text-[#c9a961]">Credit the delivery to:</span>
                        {#each extractPlan.creditCandidates as companyId (companyId)}
                            <button
                                type="button"
                                onclick={() => gameSession.selectExtractCredit(companyId)}
                                class="rv-lift border-2 px-2 py-1 font-semibold"
                                style="background-color: {CompanyColors[companyId]}; color: {CompanyTextColors[companyId]}; border-color: transparent;"
                            >
                                {CompanyNames[companyId]}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        {:else if gameSession.acquireActive}
            <div class="flex flex-wrap items-center gap-3">
                <div class="inline-grid grid-flow-col auto-cols-fr gap-3">
                {#each gameSession.acquirePlans as plan (plan.choice)}
                    {@const isWeapon = plan.choice === 'weapon'}
                    {@const fromLevel = isWeapon ? (player?.weaponLevel ?? 0) : (player?.toolLevel ?? 0)}
                    {@const accent = isWeapon ? '#e0574a' : '#4fa3e0'}
                    {@const unlocksRed = isRedGemCell(plan.destination) && !player?.redMinesUnlocked}
                    {@const unlocksBlue = isBlueGemCell(plan.destination) && !player?.blueMinesUnlocked}
                    {@const hunt = HuntDrawRuleByWeaponLevel[plan.destination.weapon]}
                    {@const ore = OreCapacityByToolLevel[plan.destination.tool]}
                    <button
                        type="button"
                        onclick={() => gameSession.acquire(plan.choice)}
                        class="acquire-tile flex flex-col justify-start gap-0.5 whitespace-nowrap rounded-lg border-2 px-2.5 py-1 text-left transition"
                        style="border-color: {accent}; background: linear-gradient(160deg, {accent}33, #2a1d10 65%);"
                    >
                        <span class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style="color: {accent};">
                            {#if isWeapon}
                                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="m13 19 6-6" /><path d="m16 16 4 4" /><path d="m19 21 2-2" /></svg>
                                Weapon
                            {:else}
                                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4c3 0 6 2 7 5-3-1-6-1-9 1" /><path d="M14 4c-3 0-6 2-7 5 3-1 6-1 9 1" /><path d="m12 10-8 11" /></svg>
                                Tool
                            {/if}
                        </span>
                        {#if isWeapon}
                            {@const currentHunt = HuntDrawRuleByWeaponLevel[fromLevel]}
                            {@const drawUp = (hunt?.draw ?? 0) > (currentHunt?.draw ?? 0)}
                            {@const applyUp = (hunt?.apply ?? 0) > (currentHunt?.apply ?? 0)}
                            <span class="flex items-baseline gap-2 font-mono font-black">
                                <span class="text-xl text-[#f1e6cf]">{hunt?.draw ?? '?'}<span class="ml-0.5 text-[10px] font-semibold">draw</span>{#if drawUp}<span class="ml-0.5 text-sm text-[#3ddc84]">▲</span>{/if}</span>
                                <span class="text-sm" style="color: {accent};">·</span>
                                <span class="text-xl text-[#f1e6cf]">{hunt?.apply ?? '?'}<span class="ml-0.5 text-[10px] font-semibold">apply</span>{#if applyUp}<span class="ml-0.5 text-sm text-[#3ddc84]">▲</span>{/if}</span>
                            </span>
                        {:else}
                            {@const currentOre = OreCapacityByToolLevel[fromLevel]}
                            {@const goldUp = (ore?.gold ?? 0) > (currentOre?.gold ?? 0)}
                            {@const silverUp = (ore?.silver ?? 0) > (currentOre?.silver ?? 0)}
                            <span class="flex items-baseline gap-2 font-mono font-black">
                                <span class="text-xl text-[#ffd166]">{ore?.gold ?? '?'}<span class="ml-0.5 text-[10px] font-semibold">gold</span>{#if goldUp}<span class="ml-0.5 text-sm text-[#3ddc84]">▲</span>{/if}</span>
                                <span class="text-sm" style="color: {accent};">·</span>
                                <span class="text-xl text-[#d9dde3]">{ore?.silver ?? '?'}<span class="ml-0.5 text-[10px] font-semibold">silver</span>{#if silverUp}<span class="ml-0.5 text-sm text-[#3ddc84]">▲</span>{/if}</span>
                            </span>
                        {/if}
                        {#if unlocksRed || unlocksBlue || plan.victoryPoints > 0}
                            <span class="flex flex-wrap items-center gap-1">
                                {#if (unlocksRed || unlocksBlue) && (player?.gems ?? 0) < MaxGems}
                                    <span class="flex items-center gap-0.5 rounded-full border border-[#3ddc84] px-1.5 text-[10px] font-semibold text-[#3ddc84]">
                                        +<img src={gemIcon} alt="gem" class="h-3.5 w-auto" draggable="false" />
                                    </span>
                                {/if}
                                {#if unlocksRed}
                                    <span class="rounded-full border border-[#d3342f] px-1.5 text-[10px] font-semibold text-[#ff8a80]">Level 4 mines</span>
                                {/if}
                                {#if unlocksBlue}
                                    <span class="rounded-full border border-[#6c63d9] px-1.5 text-[10px] font-semibold text-[#b3adff]">Level 5 mines</span>
                                {/if}
                                {#if plan.victoryPoints > 0}
                                    <span class="rounded-full border border-[#ffd166] px-1.5 text-[10px] font-semibold text-[#ffd166]">+{plan.victoryPoints} VP</span>
                                {/if}
                            </span>
                        {/if}
                    </button>
                {/each}
                </div>
                {#if gameSession.acquireMode}
                    <button
                        type="button"
                        onclick={() => gameSession.clearLocalSelection()}
                        class="rv-quiet"
                    >
                        Back
                    </button>
                {/if}
                <button
                    type="button"
                    onclick={() => gameSession.endTurn()}
                    class="rv-quiet"
                >
                    Pass
                </button>
            </div>
        {:else if gameSession.huntActive}
            <div class="flex flex-wrap items-center gap-2">
                {#each huntableRegions(gameState) as region (region)}
                    {@const remaining = huntTargets(gameState, region).reduce((total, target) => total + Math.max(0, target.level - target.hits), 0)}
                    <button
                        type="button"
                        onclick={() => gameSession.hunt(region)}
                        class="rv-btn text-sm {region === DragonHuntRegion ? 'rv-danger' : 'sm:hidden'}"
                    >
                        {regionLabel(region)} · {remaining}
                    </button>
                {/each}
                {#if gameSession.huntMode}
                    <button
                        type="button"
                        onclick={() => gameSession.clearLocalSelection()}
                        class="rv-quiet"
                    >
                        Back
                    </button>
                {/if}
                <button
                    type="button"
                    onclick={() => gameSession.endTurn()}
                    class="rv-quiet"
                >
                    Pass
                </button>
            </div>
        {:else if gameSession.trackActive}
            {@const limits = layTrackLimits(gameState)}
            <div class="flex flex-wrap items-center gap-3">
                <span>
                    Lay Track: <strong>{limits.tracksLeft}</strong> left.
                    {#if gameSession.trackCompanyId}
                        Open the <strong>Map</strong> tab and click a glowing box (cost comes from the company treasury).
                    {:else}
                        Choose a railroad.
                    {/if}
                </span>
                {#each limits.allowedCompanyIds as companyId (companyId)}
                    {@const company = gameState.getCompany(companyId)}
                    {@const options = buildableBoxes(gameState, companyId).length}
                    <button
                        type="button"
                        disabled={options === 0}
                        onclick={() => gameSession.selectTrackCompany(companyId)}
                        class="rv-lift border-2 px-2 py-1 text-xs font-semibold disabled:opacity-40"
                        style="background-color: {CompanyColors[companyId]}; color: {CompanyTextColors[companyId]}; border-color: {gameSession.trackCompanyId === companyId ? '#ffd166' : 'transparent'};"
                        title={options === 0 ? 'No affordable track to lay' : `${options} places to build`}
                    >
                        {CompanyNames[companyId]} · {`$${company.treasury}`}
                    </button>
                {/each}
                {#if gameSession.trackMode}
                    <button type="button" onclick={() => gameSession.clearLocalSelection()} class="rv-quiet">Back</button>
                {/if}
                <button type="button" onclick={() => gameSession.endTurn()} class="rv-quiet">Pass</button>
            </div>
        {:else if !gameSession.investPickerOpen}
        <div class="mb-3 flex flex-wrap items-end gap-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1 max-sm:*:shrink-0">
            {#if gameState.immediateCardId}
                <div class="flex flex-col items-center gap-1">
                    <button
                        type="button"
                        class="block overflow-hidden rounded border-2 border-[#ffd166] shadow-[0_0_14px_rgba(255,209,102,0.6)]"
                        onclick={() => gameSession.zoomCard(gameState.immediateCardId ?? '', cardImageUrl(gameState.immediateCardId ?? ''))}
                    >
                        <img src={cardImageUrl(gameState.immediateCardId)} alt={gameState.immediateCardId} class="block h-[160px] w-auto max-sm:h-[112px]" draggable="false" />
                    </button>
                    <span class="text-[11px] font-semibold uppercase tracking-wide text-[#ffd166]">Bonus action</span>
                </div>
            {:else if gameState.borrowedCardId}
                <div class="flex flex-col items-center gap-1">
                    <button
                        type="button"
                        class="block overflow-hidden rounded border-2 border-[#3f7fb8]"
                        onclick={() => gameSession.zoomCard(gameState.borrowedCardId ?? '', cardImageUrl(gameState.borrowedCardId ?? ''))}
                    >
                        <img src={cardImageUrl(gameState.borrowedCardId)} alt={gameState.borrowedCardId} class="block h-[160px] w-auto max-sm:h-[112px]" draggable="false" />
                    </button>
                </div>
            {/if}
            {#each player.tableau as cardId, index (cardId)}
                {#if player.pawnIndex === index && !gameState.immediateCardId}
                    <div class="flex flex-col items-center gap-1">
                        <div class="relative">
                        {#if player.pawnIndex === index}
                            <div class="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
                                <Pawn fill={playerColor} height={72} />
                            </div>
                        {/if}
                            <button
                                type="button"
                                class="relative z-10 block overflow-hidden rounded border-2 border-[#4a3620]"
                                onclick={() => gameSession.zoomCard(cardId, thumbUrl(cardId))}
                            >
                                <img src={thumbUrl(cardId)} alt={cardLabel(cardId)} class="block h-[160px] w-auto max-sm:h-[112px]" draggable="false" />
                            </button>
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
        {#if gameSession.claimableNodeIds.length > 0}
            <div class="mb-2 text-xs text-[#c9a961]">
                Open the <strong>Map</strong> tab and click a glowing mine to claim it (cost = mine level).
            </div>
        {/if}
        <div class="flex flex-wrap items-center gap-2">
            {#if validTypes.includes(ActionType.Tax)}
                <button
                    type="button"
                    onclick={() => gameSession.tax()}
                    class="rv-btn rv-primary"
                    title="Tuck the $1 market card under card I and collect {`$${taxIncome}`}"
                >
                    Tax (+{`$${taxIncome}`})
                </button>
            {/if}
            {#if validTypes.includes(ActionType.Invest)}
                <button
                    type="button"
                    onclick={() => gameSession.toggleInvestPicker()}
                    class="rv-btn rv-primary"
                    style="filter: {gameSession.investPickerOpen ? 'brightness(0.75)' : 'none'};"
                >
                    Invest
                </button>
            {/if}
            {#if validTypes.includes(ActionType.LayTrack) && !gameSession.trackActive}
                <button
                    type="button"
                    onclick={() => gameSession.startTrackMode()}
                    class="rv-btn rv-primary"
                    title="Lay railroad track on the Map"
                >
                    Lay Track
                </button>
            {/if}
            {#if validTypes.includes(ActionType.ExtractAndSell) && !gameSession.extractActive}
                <button
                    type="button"
                    onclick={() => gameSession.startExtractMode()}
                    class="rv-btn rv-primary"
                    title="Extract and sell one of your mines"
                >
                    Extract &amp; Sell
                </button>
            {/if}
            {#if validTypes.includes(ActionType.Hunt) && !gameSession.huntActive}
                <button
                    type="button"
                    onclick={() => gameSession.startHuntMode()}
                    class="rv-btn rv-primary"
                    title="Hunt scourges"
                >
                    Hunt
                </button>
            {/if}
            {#if validTypes.includes(ActionType.Acquire) && !gameSession.acquireActive}
                <button
                    type="button"
                    onclick={() => gameSession.startAcquireMode()}
                    class="rv-btn rv-primary"
                    title="Advance your weapon or tool"
                >
                    Acquire
                </button>
            {/if}
            {#if validTypes.includes(ActionType.EndTurn)}
                <button
                    type="button"
                    onclick={() => gameSession.endTurn()}
                    class="rv-quiet"
                >
                    Pass
                </button>
            {/if}
        </div>
        {:else}
            <div class="flex flex-wrap items-end gap-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1 max-sm:*:shrink-0">
                {#each gameState.market.slots as cardId, slotIndex (cardId)}
                    {@const card = getCard(cardId)}
                    {@const cost = marketCardCost(card, slotIndex)}
                    {@const affordable = cost !== undefined && cost <= player.money}
                    <div class="flex flex-col items-center gap-1">
                        <button
                            type="button"
                            onclick={() => gameSession.clickMarketCard(slotIndex, cardId, cardImageUrl(cardId))}
                            onpointerenter={(event) => gameSession.previewCard(event, cardId, cardImageUrl(cardId))}
                            onpointerleave={() => gameSession.clearCardPreview()}
                            class="market-card block overflow-hidden rounded border-2 border-[#8a6d3b] shadow-md"
                            title={affordable ? 'Click to buy' : 'Not enough money'}
                        >
                            <img src={cardImageUrl(cardId)} alt={cardLabel(cardId)} class="block h-[266px] w-auto max-sm:h-[190px]" draggable="false" />
                        </button>
                        <button
                            type="button"
                            disabled={!affordable}
                            onclick={() => gameSession.invest(slotIndex)}
                            class="rv-btn rv-primary text-xs"
                            title={affordable ? 'Buy this card' : 'Not enough money'}
                        >
                            {`Buy $${cost ?? '?'}`}
                        </button>
                    </div>
                {/each}
                <button
                    type="button"
                    onclick={() => gameSession.clearLocalSelection()}
                    class="rv-quiet"
                >
                    Back
                </button>
            </div>
        {/if}
    {:else if gameState.machineState === MachineState.Hunt && gameState.pendingHunt}
        {@const pending = gameState.pendingHunt}
        {@const targets = gameSession.huntTargetsForPending}
        <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="font-semibold">Hunt: {regionLabel(pending.region)}</span>
            <span class="text-xs text-[#c9a961]">
                Apply up to {Math.min(pending.apply, pending.drawn.length)} of the {pending.drawn.length} drawn.
            </span>
        </div>
        <div class="flex flex-wrap items-center gap-3">
            {#each pending.drawn as kind, index (index)}
                {@const selected = gameSession.huntSelected.includes(index)}
                {@const focused = gameSession.huntFocusHit === index && selected}
                {@const url = weaponTokenImageUrl(kind)}
                {@const assignedIndex = targets.findIndex((target) => target.id === gameSession.huntHitTargets[index])}
                <button
                    type="button"
                    onclick={() => gameSession.toggleHuntToken(index)}
                    class="relative rounded-full border-4 p-0.5 transition"
                    style="border-color: {focused ? '#ff8a5c' : selected ? '#ffd166' : 'transparent'}; box-shadow: {focused ? '0 0 14px 3px rgba(255, 138, 92, 0.8)' : 'none'}; opacity: {selected || gameSession.huntSelected.length < Math.min(pending.apply, pending.drawn.length) ? 1 : 0.5};"
                >
                    {#if url}
                        <img src={url} alt={kind} class="block h-[72px] w-[72px]" draggable="false" />
                    {:else}
                        <span class="block h-[72px] w-[72px]">{kind}</span>
                    {/if}
                    {#if selected && kind === WeaponTokenKind.Hit && assignedIndex >= 0}
                        <span
                            class="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#1a120b] bg-[#ffd166] text-xs font-black text-[#1a120b]"
                        >
                            {assignedIndex + 1}
                        </span>
                    {/if}
                </button>
            {/each}
            <button
                type="button"
                disabled={!gameSession.huntReady}
                onclick={() => gameSession.resolveHunt()}
                class="rv-btn rv-primary"
            >
                Apply
            </button>
        </div>
        {#if pending.drawn.includes(WeaponTokenKind.Hit) && targets.length > 0}
            <div class="mt-3 flex flex-wrap items-end gap-3">
                {#each targets as target, targetIndex (target.id)}
                    {@const targetUrl = target.id === DragonHuntRegion ? DragonTileImageUrl : scourgeImageUrl(target.id)}
                    {@const assigned = gameSession.huntAssignedCount(target.id)}
                    {@const killed = target.hits + assigned >= target.level}
                    <button
                        type="button"
                        disabled={gameSession.huntFocusHit === undefined}
                        onclick={() => gameSession.assignFocusedHit(target.id)}
                        class="relative flex flex-col items-center gap-1 rounded border-2 p-1 transition enabled:hover:border-[#ffd166]"
                        style="border-color: {assigned > 0 ? '#ffd166' : '#8a6d3b'};"
                    >
                        <span
                            class="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#1a120b] bg-[#ffd166] text-xs font-black text-[#1a120b]"
                        >
                            {targetIndex + 1}
                        </span>
                        {#if targetUrl}
                            <img
                                src={targetUrl}
                                alt={target.id}
                                class="block h-[110px] w-auto rounded"
                                style="filter: {killed && assigned > 0 ? 'grayscale(0.6) brightness(0.7)' : 'none'};"
                                draggable="false"
                            />
                        {/if}
                        <span class="flex gap-0.5">
                            {#each Array.from({ length: target.level }, (_, pip) => pip) as pip (pip)}
                                <span
                                    class="block h-2.5 w-2.5 rounded-full border border-[#1a120b]"
                                    style="background-color: {pip < target.hits ? '#d3342f' : pip < target.hits + assigned ? '#ffd166' : '#3a2a17'};"
                                ></span>
                            {/each}
                        </span>
                        {#if killed && assigned > 0}
                            <span class="absolute inset-x-0 top-1/3 text-center text-sm font-black uppercase tracking-widest text-[#ff8a80]">Killed</span>
                        {/if}
                    </button>
                {/each}
            </div>
        {/if}
    {:else if gameState.machineState === MachineState.BonusInvest}
        <SellVictoryPointsControl />
        <div class="flex flex-wrap items-end gap-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1 max-sm:*:shrink-0">
            {#each gameState.market.slots as cardId, slotIndex (cardId)}
                {@const card = getCard(cardId)}
                {@const cost = marketCardCost(card, slotIndex)}
                {@const affordable = cost !== undefined && cost <= player.money}
                <div class="flex flex-col items-center gap-1">
                    <button
                        type="button"
                        onclick={() => gameSession.clickMarketCard(slotIndex, cardId, cardImageUrl(cardId))}
                        onpointerenter={(event) => gameSession.previewCard(event, cardId, cardImageUrl(cardId))}
                        onpointerleave={() => gameSession.clearCardPreview()}
                        class="market-card block overflow-hidden rounded border-2 border-[#8a6d3b] shadow-md"
                        title={affordable ? 'Click to buy' : 'Not enough money'}
                    >
                        <img src={cardImageUrl(cardId)} alt={cardLabel(cardId)} class="block h-[266px] w-auto max-sm:h-[190px]" draggable="false" />
                    </button>
                    <button
                        type="button"
                        disabled={!affordable}
                        onclick={() => gameSession.invest(slotIndex)}
                        class="rv-btn rv-primary text-xs"
                    >
                        {`Buy $${cost ?? '?'}`}
                    </button>
                </div>
            {/each}
            <button
                type="button"
                onclick={() => gameSession.skipBonusInvest()}
                class="rv-quiet"
            >
                Skip
            </button>
        </div>
    {:else if gameState.machineState === MachineState.ChooseShare && gameState.pendingShare}
        <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="font-semibold">Choose a railroad share.</span>
            <span class="text-xs text-[#c9a961]">
                The card's price ({`$${gameState.pendingShare.amount}`}) goes to that railroad's treasury.
            </span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            {#each gameState.pendingShare.companyIds as companyId (companyId)}
                {@const company = gameState.getCompany(companyId)}
                {@const url = shareImageUrl(companyId, company.nextShareIndex, company.sharesFlipped)}
                <button
                    type="button"
                    onclick={() => gameSession.chooseShare(companyId)}
                    class="flex flex-col items-center gap-1 rounded border-2 border-transparent p-1 hover:border-[#ffd166]"
                    title="{CompanyNames[companyId]} share #{company.nextShareIndex + 1} (×{company.multiplierForShare(company.nextShareIndex)})"
                >
                    {#if url}
                        <img src={url} alt="{CompanyNames[companyId]} share" class="block h-[106px] w-auto rounded shadow-md" draggable="false" />
                    {/if}
                </button>
            {/each}
        </div>
    {:else if gameState.machineState === MachineState.PointBuy && pointBuyCard}
        <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="font-semibold">End of Era {pointBuyCard.era}: buy victory points.</span>
            <span class="text-xs text-[#c9a961]">
                {`$${pointBuyCard.pointBuyCost}`} for {pointBuyCard.pointBuyVictoryPoints} VP, any number of times. You may first cash in one share (it leaves the game).
            </span>
        </div>
        {#if player.shares.length > 0}
            <div class="mb-2 flex flex-wrap items-center gap-2">
                <span class="text-xs text-[#c9a961]">Cash in a share:</span>
                {#each player.shares as share (`${share.companyId}-${share.shareIndex}`)}
                    {@const company = gameState.getCompany(share.companyId)}
                    {@const url = shareImageUrl(share.companyId, share.shareIndex, company.sharesFlipped)}
                    {@const selected =
                        gameSession.pointBuyConvertShare?.companyId === share.companyId &&
                        gameSession.pointBuyConvertShare?.shareIndex === share.shareIndex}
                    <button
                        type="button"
                        onclick={() => gameSession.toggleConvertShare({ companyId: share.companyId, shareIndex: share.shareIndex })}
                        class="flex flex-col items-center gap-1 rounded border-2 p-1"
                        style="border-color: {selected ? '#ffd166' : 'transparent'};"
                    >
                        {#if url}
                            <img src={url} alt="{CompanyNames[share.companyId]} share" class="block h-[106px] w-auto rounded shadow-md" draggable="false" />
                        {/if}
                        <span class="text-[11px] font-semibold">
                            {CompanyAbbreviations[share.companyId]} #{share.shareIndex + 1} → {`$${company.multiplierForShare(share.shareIndex) * company.value}`}
                        </span>
                    </button>
                {/each}
            </div>
        {/if}
        <div class="flex flex-wrap items-center gap-2">
            <button
                type="button"
                disabled={bundles <= 0}
                onclick={() => gameSession.setPointBuyBundles(bundles - 1)}
                class="rv-quiet px-2 py-0.5"
            >−</button>
            <span class="min-w-[9rem] text-center">
                {bundles} × {pointBuyCard.pointBuyVictoryPoints} VP for {`$${bundles * pointBuyCard.pointBuyCost}`}
            </span>
            <button
                type="button"
                disabled={bundles >= maxBundles}
                onclick={() => gameSession.setPointBuyBundles(bundles + 1)}
                class="rv-quiet px-2 py-0.5"
            >+</button>
            <span class="text-xs text-[#c9a961]">
                Money after: {`$${player.money + convertCash - bundles * pointBuyCard.pointBuyCost}`}
            </span>
            <button
                type="button"
                onclick={() => {
                    gameSession.setPointBuyBundles(bundles)
                    gameSession.submitPointBuy()
                }}
                class="rv-btn rv-primary"
            >
                {bundles === 0 && !gameSession.pointBuyConvertShare ? 'Pass' : 'Confirm'}
            </button>
        </div>
    {/if}
</div>

<style>
    .acquire-tile:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
        filter: brightness(1.12);
    }
</style>
