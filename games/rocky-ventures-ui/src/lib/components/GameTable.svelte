<script lang="ts">
    import {
        ScalingWrapper,
        DefaultTableLayout,
        GameSession,
        HistoryControls,
        DefaultTabs,
        TabWorkspace,
        DebouncedLayout,
        type WorkspaceTab
    } from '@tabletop/frontend-components'

    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import CompaniesPanel from '$lib/components/CompaniesPanel.svelte'
    import History from '$lib/components/History.svelte'
    import TableauPanel from '$lib/components/TableauPanel.svelte'
    import MarketPanel from '$lib/components/MarketPanel.svelte'
    import GridPanel from '$lib/components/GridPanel.svelte'
    import DragonPanel from '$lib/components/DragonPanel.svelte'
    import CardZoom from '$lib/components/CardZoom.svelte'
    import CardHoverPreview from '$lib/components/CardHoverPreview.svelte'
    import GameOverOverlay from '$lib/components/GameOverOverlay.svelte'
    import DragonOverlay from '$lib/components/DragonOverlay.svelte'
    import DragonBonusOverlay from '$lib/components/DragonBonusOverlay.svelte'
    import ScourgeOverlay from '$lib/components/ScourgeOverlay.svelte'
    import ScourgeRevealOverlay from '$lib/components/ScourgeRevealOverlay.svelte'

    import type { RockyVenturesGameSession } from '$lib/model/session.svelte'
    import { BonusTokensToSummonDragon, RegionIds, type WeaponTokenKind } from '@tabletop/rocky-ventures'
    import type { HydratedRockyVenturesGameState, RockyVenturesGameState } from '@tabletop/rocky-ventures'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import { chooseBotMoves } from '$lib/bots/rockyBots.js'

    let {
        gameSession
    }: { gameSession: GameSession<RockyVenturesGameState, HydratedRockyVenturesGameState> } =
        $props()
    const session = gameSession as RockyVenturesGameSession
    setGameSession(session)

    const BotThinkMs = 900
    let botTimer: ReturnType<typeof setTimeout> | undefined
    let botRunning = false

    $effect(() => {
        session.loadBotSeats()
    })

    $effect(() => {
        const state = session.gameState
        const actionCount = state.actionCount
        const playerId = state.activePlayerIds[0]
        const profile = playerId ? session.botSeats[playerId] : undefined
        clearTimeout(botTimer)
        const presenting =
            session.revealScourgeId !== undefined ||
            session.extractAnimation !== undefined ||
            session.holdScourgeOverlay ||
            pendingScourge !== undefined ||
            bonusOverlayTokens !== undefined ||
            dragonOverlayOpen
        if (!profile || !playerId || !session.primaryGame.hotseat || state.result || session.isViewingHistory || presenting) {
            return
        }
        botTimer = setTimeout(async () => {
            if (botRunning || session.gameState.actionCount !== actionCount || session.busy) {
                return
            }
            botRunning = true
            try {
                session.clearLocalSelection()
                const moves = chooseBotMoves(session.gameState, playerId, profile, session.validActionTypes)
                for (const move of moves) {
                    await session.executeBotMove(move)
                    if (session.gameState.actionCount !== actionCount) {
                        break
                    }
                }
            } finally {
                botRunning = false
            }
        }, BotThinkMs)
    })

    const workspaceTabs: WorkspaceTab[] = [
        { id: 'board', label: 'Map', closable: false },
        { id: 'tableau', label: 'Tableau' },
        { id: 'market', label: 'Market' },
        { id: 'grid', label: 'Weapon / Tool Grid' },
        { id: 'dragon', label: 'Dragon' },
        { id: 'railroads', label: 'Railroads' }
    ]

    // Each player's workspace layout follows their account via the title preferences system.
    const workspaceLayoutPreference = new DebouncedLayout(
        () => ({
            ready: session.preferences.ready,
            key: session.preferences.storageKey('title'),
            value: session.preferences.values.workspaceLayout
        }),
        (value) => session.preferences.save({ workspaceLayout: value })
    )

    // The top section fits its content by default; dragging the handle overrides that until the
    // next game update or action-panel change, which restores the full-content fit.
    const MIN_TOP_SECTION_HEIGHT_PX = 96
    const MIN_WORKSPACE_HEIGHT_PX = 240

    let topSectionHeightPx: number | undefined = $state()
    let frozenTopSectionPx: number | undefined = $state()

    $effect(() => {
        if (session.layoutFrozen || session.revealScourgeId !== undefined || pendingScourge !== undefined) {
            if (frozenTopSectionPx === undefined) {
                frozenTopSectionPx = topSectionEl?.getBoundingClientRect().height
            }
        } else {
            frozenTopSectionPx = undefined
        }
    })
    let previousScourgeIds: Set<string> | undefined
    let pendingScourge: { region: (typeof RegionIds)[number]; scourgeId: string } | undefined = $state()
    let scourgeOverlayTimer: ReturnType<typeof setTimeout> | undefined
    let previousDragonSummoned: boolean | undefined
    let dragonOverlayOpen = $state(false)
    let gameOverOpen = $state(false)
    let gameOverShown = false

    $effect(() => {
        if (session.gameState.result && !gameOverShown && !session.isViewingHistory) {
            gameOverShown = true
            gameOverOpen = true
        }
    })
    let dragonOverlayTimer: ReturnType<typeof setTimeout> | undefined

    let workspaceTab: string | undefined = $state()

    $effect(() => {
        if (session.huntActive && session.isMyTurn && !session.isViewingHistory) {
            workspaceTab = 'board'
        }
    })

    let previousTrackerCount: number | undefined
    let bonusOverlayTokens: WeaponTokenKind[] | undefined = $state()
    let bonusOverlayTimer: ReturnType<typeof setTimeout> | undefined

    $effect(() => {
        const tokens = session.gameState.dragon.trackerTokens
        const previous = previousTrackerCount
        previousTrackerCount = tokens.length
        if (
            previous !== undefined &&
            tokens.length > previous &&
            tokens.length < BonusTokensToSummonDragon &&
            !session.isViewingHistory
        ) {
            bonusOverlayTokens = [...tokens]
            clearTimeout(bonusOverlayTimer)
            bonusOverlayTimer = setTimeout(() => {
                bonusOverlayTokens = undefined
            }, 2600 + tokens.length * 350)
        }
    })

    $effect(() => {
        const summoned = session.gameState.dragon.summoned
        const previous = previousDragonSummoned
        previousDragonSummoned = summoned
        if (previous === false && summoned && !session.isViewingHistory) {
            dragonOverlayOpen = true
            clearTimeout(dragonOverlayTimer)
            dragonOverlayTimer = setTimeout(() => {
                dragonOverlayOpen = false
            }, 6500)
        }
    })

    $effect(() => {
        const current = new Map<string, (typeof RegionIds)[number]>()
        for (const region of RegionIds) {
            for (const scourge of session.gameState.board.scourgesByRegion[region] ?? []) {
                current.set(scourge.scourgeId, region)
            }
        }
        const previous = previousScourgeIds
        previousScourgeIds = new Set(current.keys())
        if (!previous || session.isViewingHistory) {
            return
        }
        for (const [scourgeId, region] of current) {
            if (!previous.has(scourgeId)) {
                pendingScourge = { region, scourgeId }
            }
        }
    })

    $effect(() => {
        if (session.holdScourgeOverlay || !pendingScourge) {
            return
        }
        const { region, scourgeId } = pendingScourge
        pendingScourge = undefined
        if (!(session.gameState.board.scourgesByRegion[region] ?? []).some((scourge) => scourge.scourgeId === scourgeId)) {
            return
        }
        clearTimeout(scourgeOverlayTimer)
        session.landedScourgeId = undefined
        session.revealScourgeId = scourgeId
    })

    function finishScourgeReveal() {
        const scourgeId = session.revealScourgeId
        session.revealScourgeId = undefined
        session.landedScourgeId = scourgeId
        clearTimeout(scourgeOverlayTimer)
        scourgeOverlayTimer = setTimeout(() => {
            session.landedScourgeId = undefined
        }, 600)
    }
    let layoutColumnEl: HTMLDivElement | undefined
    let topSectionEl: HTMLDivElement | undefined
    let resizeDragStartY = 0
    let resizeDragStartHeightPx = 0
    let resizingTopSection = $state(false)

    function clampTopSectionHeight(candidatePx: number) {
        const availableHeightPx = layoutColumnEl?.clientHeight ?? Infinity
        const maxPx = Math.max(MIN_TOP_SECTION_HEIGHT_PX, availableHeightPx - MIN_WORKSPACE_HEIGHT_PX)
        return Math.min(Math.max(candidatePx, MIN_TOP_SECTION_HEIGHT_PX), maxPx)
    }

    function currentTopSectionHeight() {
        return topSectionEl?.getBoundingClientRect().height ?? MIN_TOP_SECTION_HEIGHT_PX
    }

    // Window-level move/up listeners rather than pointer capture: iOS Safari drops captured
    // gestures that leave the 24px handle before capture takes effect.
    function onResizeHandlePointerDown(event: PointerEvent) {
        resizingTopSection = true
        resizeDragStartY = event.clientY
        resizeDragStartHeightPx = currentTopSectionHeight()
        const handle = event.currentTarget
        if (handle instanceof HTMLElement) {
            try {
                handle.setPointerCapture(event.pointerId)
            } catch {
                // Some WebKit versions throw for touch-originated pointer ids; the window listeners suffice.
            }
        }
        window.addEventListener('pointermove', onResizeHandlePointerMove)
        window.addEventListener('pointerup', onResizeHandlePointerUp)
        window.addEventListener('pointercancel', onResizeHandlePointerUp)
        event.preventDefault()
    }

    function onResizeHandlePointerMove(event: PointerEvent) {
        if (!resizingTopSection) return
        topSectionHeightPx = clampTopSectionHeight(resizeDragStartHeightPx + (event.clientY - resizeDragStartY))
        event.preventDefault()
    }

    function onResizeHandlePointerUp() {
        if (!resizingTopSection) return
        resizingTopSection = false
        window.removeEventListener('pointermove', onResizeHandlePointerMove)
        window.removeEventListener('pointerup', onResizeHandlePointerUp)
        window.removeEventListener('pointercancel', onResizeHandlePointerUp)
    }

    function resetTopSectionHeight() {
        topSectionHeightPx = undefined
    }

    $effect(() => {
        void session.gameState.actionCount
        void session.investPickerOpen
        void session.extractMode
        void session.trackMode
        void session.moveTargetIndex
        topSectionHeightPx = undefined
    })

    function onResizeHandleKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowUp') {
            topSectionHeightPx = clampTopSectionHeight(currentTopSectionHeight() - 24)
        } else if (event.key === 'ArrowDown') {
            topSectionHeightPx = clampTopSectionHeight(currentTopSectionHeight() + 24)
        } else if (event.key === 'Enter' || event.key === ' ') {
            resetTopSectionHeight()
        } else {
            return
        }
        event.preventDefault()
    }
</script>

<div data-game-ui="rocky-ventures" class="bg-[#1a120b]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#f1e6cf]"
                disabledColor="text-[#5a4630]"
                borderClass="border-[#4a3620] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls enabledColor="text-[#f1e6cf]" disabledColor="text-[#5a4630]" />
            </div>
            <DefaultTabs
                playersTitle="Players"
                activeTabClass="py-1 px-3 bg-[#b8700a] border-2 border-transparent rounded-lg text-white"
                inactiveTabClass="text-[#e0cfae] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#b8700a]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                <!-- History sits beside Players and Chat in the left panel, like other Board
                     Together games, rather than as a tab in the board workspace. -->
                {#snippet history()}
                    <History />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div bind:this={layoutColumnEl} data-rocky-game-column class="flex h-full min-h-0 w-full flex-col">
                <div
                    bind:this={topSectionEl}
                    class="pb-3 {(topSectionHeightPx ?? frozenTopSectionPx) === undefined ? 'shrink-0' : 'shrink-0 overflow-y-auto'}"
                    style={(topSectionHeightPx ?? frozenTopSectionPx) !== undefined ? `height: ${topSectionHeightPx ?? frozenTopSectionPx}px;` : undefined}
                >
                    <Header />
                    <ActionPanel />
                </div>

                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <div
                    class="group flex h-6 shrink-0 cursor-row-resize touch-none items-center justify-center select-none resize-handle max-sm:hidden {resizingTopSection ? 'bg-[#b8700a]/10' : ''}"
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize the space above the tabs"
                    tabindex="0"
                    onpointerdown={onResizeHandlePointerDown}
                    ondblclick={resetTopSectionHeight}
                    onkeydown={onResizeHandleKeydown}
                    title="Drag to resize - double-click to reset"
                >
                    <div class="h-1 w-10 rounded-full bg-[#5a4630] transition-colors group-hover:bg-[#b8700a]"></div>
                </div>

                <div class="overflow-x-hidden overflow-y-auto workspace-shell" style="flex:1; min-height: 320px;">
                    {#if session.preferences.ready && workspaceLayoutPreference.ready}
                        <TabWorkspace
                            bind:selected={workspaceTab}
                            tabs={workspaceTabs}
                            label="Rocky Ventures"
                            savedLayout={workspaceLayoutPreference.value}
                            onLayoutChange={(value) => workspaceLayoutPreference.change(value)}
                        >
                            {#snippet children(id, _active)}
                                {#if id === 'board'}
                                    <ScalingWrapper justify="center" controls="bottom-left" dragToPan>
                                        <Board />
                                    </ScalingWrapper>
                                {:else if id === 'tableau'}
                                    <TableauPanel />
                                {:else if id === 'market'}
                                    <MarketPanel />
                                {:else if id === 'grid'}
                                    <GridPanel />
                                {:else if id === 'dragon'}
                                    <DragonPanel />
                                {:else if id === 'railroads'}
                                    <div class="p-2">
                                        <CompaniesPanel />
                                    </div>
                                {/if}
                            {/snippet}
                        </TabWorkspace>
                    {/if}
                </div>
            </div>
        {/snippet}
    </DefaultTableLayout>
    {#if session.scourgeOverlayRegion}
        <ScourgeOverlay region={session.scourgeOverlayRegion} highlightId={session.newScourgeId} onclose={() => { session.scourgeOverlayRegion = undefined; session.newScourgeId = undefined }} />
    {/if}
    {#if session.revealScourgeId}
        {#key session.revealScourgeId}
            <ScourgeRevealOverlay scourgeId={session.revealScourgeId} onclose={finishScourgeReveal} />
        {/key}
    {/if}
    {#if gameOverOpen}
        <GameOverOverlay onclose={() => (gameOverOpen = false)} />
    {:else if session.gameState.result}
        <button
            type="button"
            class="rv-btn fixed bottom-3 right-3 z-40 text-sm"
            onclick={() => (gameOverOpen = true)}
        >
            Final scores
        </button>
    {/if}
    {#if bonusOverlayTokens && !dragonOverlayOpen}
        <DragonBonusOverlay tokens={bonusOverlayTokens} onclose={() => (bonusOverlayTokens = undefined)} />
    {/if}
    {#if dragonOverlayOpen}
        <DragonOverlay onclose={() => (dragonOverlayOpen = false)} />
    {/if}
    {#if session.hoveredCard && !session.zoomedImage}
        <CardHoverPreview imageUrl={session.hoveredCard.url} alt={session.hoveredCard.alt} />
    {/if}
    {#if session.zoomedImage}
        <CardZoom imageUrl={session.zoomedImage.url} alt={session.zoomedImage.alt} onclose={() => (session.zoomedImage = undefined)} />
    {/if}
</div>

<style>
    :global([data-game-ui='rocky-ventures'] .rv-btn) {
        --accent: #c9a961;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        border: 2px solid var(--accent);
        border-radius: 0.5rem;
        padding: 0.35rem 0.8rem;
        font-weight: 600;
        color: #f6ecd8;
        background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 30%, transparent), #2a1d10 72%);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
    }
    :global([data-game-ui='rocky-ventures'] .rv-btn:not(:disabled):hover),
    :global([data-game-ui='rocky-ventures'] .rv-lift:not(:disabled):hover) {
        transform: translateY(-1px);
        filter: brightness(1.15);
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
    }
    :global([data-game-ui='rocky-ventures'] .rv-btn:disabled),
    :global([data-game-ui='rocky-ventures'] .rv-quiet:disabled) {
        opacity: 0.4;
        cursor: not-allowed;
    }
    :global([data-game-ui='rocky-ventures'] .rv-primary) {
        --accent: #e0902a;
    }
    :global([data-game-ui='rocky-ventures'] .rv-gem) {
        --accent: #4f9be0;
    }
    :global([data-game-ui='rocky-ventures'] .rv-danger) {
        --accent: #e0574a;
    }
    :global([data-game-ui='rocky-ventures'] .rv-go) {
        --accent: #3ddc84;
    }
    :global([data-game-ui='rocky-ventures'] .rv-quiet) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #8a6d3b;
        border-radius: 0.5rem;
        padding: 0.3rem 0.75rem;
        color: #e0cfae;
        background: rgba(0, 0, 0, 0.15);
        transition: background-color 120ms ease, border-color 120ms ease;
    }
    :global([data-game-ui='rocky-ventures'] .rv-quiet:not(:disabled):hover) {
        background: rgba(255, 255, 255, 0.08);
        border-color: #c9a961;
    }
    :global([data-game-ui='rocky-ventures'] .rv-lift) {
        border-radius: 0.5rem;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
    }

    /* Phones: the shared table layout gives the game 90vw and leaves the players column peeking in
       from the left. Let the game fill the screen (players stay one swipe right) and hide that
       scroller's scrollbar. */
    @media (width < 640px) {
        :global([data-game-ui='rocky-ventures'] div:has(> [data-rocky-game-column])) {
            min-width: calc(100vw - 8px);
        }
        :global([data-game-ui='rocky-ventures'] div:has(> div > div > [data-rocky-game-column])) {
            scrollbar-width: none;
        }
        :global([data-game-ui='rocky-ventures'] div:has(> div > div > [data-rocky-game-column])::-webkit-scrollbar) {
            display: none;
        }
    }

    .resize-handle {
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
    }

    .workspace-shell {
        --workspace-text: #f1e6cf;
        --workspace-muted: #c9a961;
        --workspace-inactive: #6b563a;
        --workspace-border: #4a3620;
        --workspace-focus: #b8700a;
        --workspace-hover: rgba(184, 112, 10, 0.18);
        --workspace-surface: #22170e;
    }
</style>
