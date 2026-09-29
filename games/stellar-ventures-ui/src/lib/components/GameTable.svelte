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
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import ShipyardPanel from '$lib/components/ShipyardPanel.svelte'
    import CharterPanel from '$lib/components/CharterPanel.svelte'
    import InvestorBoardPanel from '$lib/components/InvestorBoardPanel.svelte'
    import RoundTrackerPanel from '$lib/components/RoundTrackerPanel.svelte'
    import AgreementPanel from '$lib/components/AgreementPanel.svelte'
    import DividendChartPanel from '$lib/components/DividendChartPanel.svelte'
    import HistoryPanel from '$lib/components/HistoryPanel.svelte'
    import FirstShipOrderedRevealOverlay from '$lib/components/FirstShipOrderedRevealOverlay.svelte'
    import HostileTakeoverRevealOverlay from '$lib/components/HostileTakeoverRevealOverlay.svelte'
    import BorderClosedRevealOverlay from '$lib/components/BorderClosedRevealOverlay.svelte'
    import PayTaxesRevealOverlay from '$lib/components/PayTaxesRevealOverlay.svelte'

    import type { StellarVenturesGameSession } from '$lib/model/session.svelte'
    import type {
        HydratedStellarVenturesGameState,
        StellarVenturesGameState
    } from '@tabletop/stellar-ventures'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<StellarVenturesGameState, HydratedStellarVenturesGameState> } =
        $props()
    const session = gameSession as StellarVenturesGameSession
    setGameSession(session)

    // The board and its reference views (Shipyard, Charter, Investor Board, The Agreement,
    // Dividend Chart) plus a readable action History live in a single draggable/resizable/closable
    // TabWorkspace (from @tabletop/frontend-components, ported from the 18xx branch's shared
    // workspace component - it has no game-specific dependency of its own). The Board is the
    // only tab that can't be closed, since it's the primary view; the rest can be split off into
    // their own pane, closed, and reopened via each pane's Add tab menu.
    const workspaceTabs: WorkspaceTab[] = [
        { id: 'board', label: 'Map', closable: false },
        { id: 'dividendChart', label: 'Dividend Chart' },
        { id: 'charter', label: 'Charter' },
        { id: 'agreement', label: 'The Agreement' },
        { id: 'investorBoard', label: 'Investor Board' },
        { id: 'roundTracker', label: 'Round Tracker' },
        { id: 'history', label: 'History' },
        { id: 'shipyard', label: 'Shipyard' }
    ]

    // Each player's own custom layout (which panes exist, how they're split/sized, which tabs
    // live where) is saved per account via the title preferences system (session.preferences),
    // so it follows a player between browsers on the same account rather than resetting on
    // reload. DebouncedLayout is the same "type freely, save after a pause" wrapper the 18xx
    // family uses for its own workspace layout - it also backs up an in-flight change to
    // localStorage so a page refresh mid-save doesn't lose it. There's no dedicated "reset
    // layout" action; a player gets back to a from-scratch layout by closing panes and
    // re-adding the tabs they want via each pane's own Add tab menu.
    const workspaceLayoutPreference = new DebouncedLayout(
        () => ({
            ready: session.preferences.ready,
            key: session.preferences.storageKey('title'),
            value: session.preferences.values.workspaceLayout
        }),
        (value) => session.preferences.save({ workspaceLayout: value })
    )

    // Lets a player drag the boundary between the fixed Header/Action area above and the
    // TabWorkspace below, so the Dividend Chart (or any other tab) gets more room on a short
    // window instead of being clipped by however tall that Era's own Action panel happens to be.
    // This is a plain per-browser convenience (localStorage, like DebouncedLayout's own
    // in-flight backup above) rather than a title preference - unlike the TabWorkspace split,
    // there's nothing here worth following a player between browsers or devices.
    const TOP_SECTION_HEIGHT_STORAGE_KEY = 'stellarVentures.topSectionHeightPx'
    const MIN_TOP_SECTION_HEIGHT_PX = 96
    const MIN_WORKSPACE_HEIGHT_PX = 240

    function loadSavedTopSectionHeight(): number | undefined {
        try {
            const raw = localStorage.getItem(TOP_SECTION_HEIGHT_STORAGE_KEY)
            const value = raw ? Number(raw) : NaN
            return Number.isFinite(value) && value > 0 ? value : undefined
        } catch {
            return undefined
        }
    }

    // undefined means "auto" - the top section sizes to its own content, exactly like before
    // this feature existed. Once a player drags the handle it becomes a fixed pixel height
    // (with its own scrollbar if content no longer fits) until they double-click the handle to
    // go back to auto.
    let topSectionHeightPx: number | undefined = $state(loadSavedTopSectionHeight())
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

    // iOS Safari's element-level setPointerCapture is unreliable mid-drag (a finger moving even
    // slightly can end up "outside" the 24px-tall handle before Safari has actually captured it,
    // silently dropping the rest of the gesture) - so the move/up listeners go on window instead
    // of relying on capture to keep delivering them to the handle. setPointerCapture is still
    // attempted as a progressive enhancement (it helps desktop browsers keep the right cursor
    // and avoids selecting page text mid-drag) but wrapped in try/catch since some WebKit
    // versions throw when it's called with a touch-originated pointerId.
    function onResizeHandlePointerDown(event: PointerEvent) {
        resizingTopSection = true
        resizeDragStartY = event.clientY
        resizeDragStartHeightPx =
            topSectionEl?.getBoundingClientRect().height ?? MIN_TOP_SECTION_HEIGHT_PX
        try {
            ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
        } catch {
            // Best-effort only, see comment above - window-level listeners below don't depend on it.
        }
        window.addEventListener('pointermove', onResizeHandlePointerMove)
        window.addEventListener('pointerup', onResizeHandlePointerUp)
        window.addEventListener('pointercancel', onResizeHandlePointerUp)
        // Stops the page/either adjacent scrollable pane from also treating this touch as a
        // scroll gesture underneath the drag - belt-and-suspenders alongside the handle's own
        // touch-action: none, which some WebKit versions don't fully honor next to two scrollable
        // siblings.
        event.preventDefault()
    }

    function onResizeHandlePointerMove(event: PointerEvent) {
        if (!resizingTopSection) return
        topSectionHeightPx = clampTopSectionHeight(
            resizeDragStartHeightPx + (event.clientY - resizeDragStartY)
        )
        event.preventDefault()
    }

    function onResizeHandlePointerUp() {
        if (!resizingTopSection) return
        resizingTopSection = false
        window.removeEventListener('pointermove', onResizeHandlePointerMove)
        window.removeEventListener('pointerup', onResizeHandlePointerUp)
        window.removeEventListener('pointercancel', onResizeHandlePointerUp)
        try {
            if (topSectionHeightPx !== undefined) {
                localStorage.setItem(TOP_SECTION_HEIGHT_STORAGE_KEY, String(topSectionHeightPx))
            }
        } catch {
            // Best-effort only - a private window or blocked storage just means this doesn't
            // stick around for next time, same as DebouncedLayout's own localStorage backup.
        }
    }

    function resetTopSectionHeight() {
        topSectionHeightPx = undefined
        try {
            localStorage.removeItem(TOP_SECTION_HEIGHT_STORAGE_KEY)
        } catch {
            // Best-effort only, see above.
        }
    }
</script>

<div class="bg-[#0b0e1a]">
    <FirstShipOrderedRevealOverlay />
    <HostileTakeoverRevealOverlay />
    {#if gameSession.gameState.usesTaxes}
        <BorderClosedRevealOverlay />
        <PayTaxesRevealOverlay />
    {/if}
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#e6e9f5]"
                disabledColor="text-[#3a4166]"
                borderClass="border-[#2a2f45] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls enabledColor="text-[#e6e9f5]" disabledColor="text-[#3a4166]" />
            </div>
            <DefaultTabs
                playersTitle="Players"
                activeTabClass="py-1 px-3 bg-[#2f6fed] border-2 border-transparent rounded-lg text-white"
                inactiveTabClass="text-[#c3c9e6] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#2f6fed]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div bind:this={layoutColumnEl} class="flex h-full min-h-0 w-full flex-col">
                <!-- pb-3 here (rather than inside ActionPanel/GameEndPanel themselves) gives every
                     machineState's own bespoke panel - and the generic fallback - a consistent gap
                     above the TabWorkspace's own tab strip just below, since several panels
                     (SparePartsPanel, FinePrintPanel) end in a button row with no bottom margin of
                     their own and were otherwise sitting flush against that tab strip. When a
                     player has dragged the resize handle below, this switches from its natural
                     content height to a fixed one (with its own scrollbar) so the TabWorkspace
                     underneath can claim the space it gave up. -->
                <div
                    bind:this={topSectionEl}
                    class="pb-3 {topSectionHeightPx === undefined ? 'shrink-0' : 'shrink-0 overflow-y-auto'}"
                    style={topSectionHeightPx !== undefined
                        ? `height: ${topSectionHeightPx}px;`
                        : undefined}
                >
                    <Header />
                    {#if gameSession.gameState.result}
                        <GameEndPanel />
                    {:else}
                        <ActionPanel />
                    {/if}
                </div>

                <!-- Drag to trade vertical space between the Header/Action area above and the
                     TabWorkspace below; double-click to go back to the automatic height. A
                     keyboard-focusable separator is the standard accessible pattern for a resize
                     handle, which is exactly what the two ignored a11y rules below object to. -->
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <div
                    class="group flex h-6 shrink-0 cursor-row-resize touch-none items-center justify-center select-none resize-handle {resizingTopSection ? 'bg-[#2f6fed]/10' : ''}"
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize the space above the tabs"
                    tabindex="0"
                    onpointerdown={onResizeHandlePointerDown}
                    ondblclick={resetTopSectionHeight}
                    onkeydown={(event) => {
                        if (event.key === 'ArrowUp') {
                            topSectionHeightPx = clampTopSectionHeight(
                                (topSectionEl?.getBoundingClientRect().height ?? MIN_TOP_SECTION_HEIGHT_PX) - 24
                            )
                        } else if (event.key === 'ArrowDown') {
                            topSectionHeightPx = clampTopSectionHeight(
                                (topSectionEl?.getBoundingClientRect().height ?? MIN_TOP_SECTION_HEIGHT_PX) + 24
                            )
                        } else if (event.key === 'Enter' || event.key === ' ') {
                            resetTopSectionHeight()
                        } else {
                            return
                        }
                        event.preventDefault()
                    }}
                    title="Drag to resize - double-click to reset"
                >
                    <div
                        class="h-1 w-10 rounded-full bg-[#3a4166] transition-colors group-hover:bg-[#2f6fed]"
                    ></div>
                </div>

                <div class="overflow-x-hidden overflow-y-auto workspace-shell" style="flex:1; min-height: 320px;">
                {#if session.preferences.ready && workspaceLayoutPreference.ready}
                    <TabWorkspace
                        tabs={workspaceTabs}
                        label="Stellar Ventures"
                        savedLayout={workspaceLayoutPreference.value}
                        onLayoutChange={(value) => workspaceLayoutPreference.change(value)}
                    >
                        {#snippet children(id, active)}
                            {#if id === 'board'}
                                <ScalingWrapper justify="center" controls="bottom-left" dragToPan expandable>
                                    <Board />
                                </ScalingWrapper>
                            {:else if id === 'shipyard'}
                                <ShipyardPanel />
                            {:else if id === 'charter'}
                                <CharterPanel />
                            {:else if id === 'investorBoard'}
                                <InvestorBoardPanel />
                            {:else if id === 'roundTracker'}
                                <RoundTrackerPanel />
                            {:else if id === 'agreement'}
                                <AgreementPanel />
                            {:else if id === 'dividendChart'}
                                <DividendChartPanel />
                            {:else if id === 'history'}
                                <HistoryPanel />
                            {/if}
                        {/snippet}
                    </TabWorkspace>
                {/if}
                </div>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    /* iOS Safari shows a text-selection callout/highlight on a long-press even with
       user-select: none applied via Tailwind's select-none class - these two properties are the
       actual fix and have no Tailwind utility equivalent, hence the plain CSS here. */
    .resize-handle {
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
    }

    /* Neutral defaults for TabWorkspace's own theme variables (see its README) - dark to match
       the rest of the Stellar Ventures chrome instead of its light-mode default. */
    .workspace-shell {
        --workspace-text: #e6e9f5;
        --workspace-muted: #7f88ad;
        --workspace-inactive: #4c5478;
        --workspace-border: #2a2f45;
        --workspace-focus: #2f6fed;
        --workspace-hover: rgba(47, 111, 237, 0.15);
        --workspace-surface: #10142a;
    }
</style>
