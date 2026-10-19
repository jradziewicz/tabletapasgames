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
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import History from '$lib/components/History.svelte'
    import GuidePanel from '$lib/components/GuidePanel.svelte'
    import GameOverOverlay from '$lib/components/GameOverOverlay.svelte'
    import ScoringOverlay from '$lib/components/ScoringOverlay.svelte'
    import { LocustGameSession } from '$lib/model/session.svelte.js'
    import type { HydratedLocustGameState, LocustGameState } from '@tabletop/locust'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<LocustGameState, HydratedLocustGameState> } =
        $props()
    if (!(gameSession instanceof LocustGameSession)) {
        throw Error('Locust needs a LocustGameSession')
    }
    const session: LocustGameSession = gameSession
    setGameSession(session)

    const workspaceTabs: WorkspaceTab[] = [
        { id: 'board', label: 'Board', closable: false },
        { id: 'guide', label: 'Rules guide' }
    ]
    let workspaceTab = $state('board')

    const workspaceLayoutPreference = new DebouncedLayout(
        () => ({
            ready: session.preferences.ready,
            key: session.preferences.storageKey('title'),
            value: session.preferences.values.workspaceLayout
        }),
        (value) => session.preferences.save({ workspaceLayout: value })
    )

    let gameOverDismissed = $state(false)
    const gameOverOpen = $derived(
        session.gameState.result !== undefined && !session.isViewingHistory && !gameOverDismissed
    )
</script>

<div data-game-ui="locust" class="bg-[#1a140c]">
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
                {#snippet history()}
                    <History />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="flex h-full min-h-0 w-full flex-col">
                <div class="shrink-0 pb-2">
                    <Header />
                    <ActionPanel />
                </div>
                <div
                    class="workspace-shell overflow-x-hidden overflow-y-auto"
                    style="flex:1; min-height: 320px;"
                >
                    {#if session.preferences.ready && workspaceLayoutPreference.ready}
                        <TabWorkspace
                            bind:selected={workspaceTab}
                            tabs={workspaceTabs}
                            label="Locust"
                            savedLayout={workspaceLayoutPreference.value}
                            onLayoutChange={(value) => workspaceLayoutPreference.change(value)}
                        >
                            {#snippet children(id, _active)}
                                {#if id === 'board'}
                                    <ScalingWrapper
                                        justify="center"
                                        controls="bottom-left"
                                        dragToPan
                                    >
                                        <Board />
                                    </ScalingWrapper>
                                {:else if id === 'guide'}
                                    <GuidePanel />
                                {/if}
                            {/snippet}
                        </TabWorkspace>
                    {/if}
                </div>
            </div>
        {/snippet}
    </DefaultTableLayout>
    <ScoringOverlay />
    {#if gameOverOpen}
        <GameOverOverlay onclose={() => (gameOverDismissed = true)} />
    {:else if session.gameState.result}
        <button
            type="button"
            class="lc-btn fixed right-3 bottom-3 z-40 text-sm"
            onclick={() => (gameOverDismissed = false)}
        >
            Final scores
        </button>
    {/if}
</div>

<style>
    :global([data-game-ui='locust'] .lc-btn) {
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
        background: linear-gradient(
            160deg,
            color-mix(in srgb, var(--accent) 30%, transparent),
            #2a1d10 72%
        );
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        transition:
            transform 120ms ease,
            filter 120ms ease,
            box-shadow 120ms ease;
    }
    :global([data-game-ui='locust'] .lc-btn:not(:disabled):hover) {
        transform: translateY(-1px);
        filter: brightness(1.15);
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
    }
    :global([data-game-ui='locust'] .lc-btn:disabled),
    :global([data-game-ui='locust'] .lc-quiet:disabled) {
        opacity: 0.4;
        cursor: not-allowed;
    }
    :global([data-game-ui='locust'] .lc-primary) {
        --accent: #e0902a;
    }
    :global([data-game-ui='locust'] .lc-go) {
        --accent: #3ddc84;
    }
    :global([data-game-ui='locust'] .lc-danger) {
        --accent: #e0574a;
    }
    :global([data-game-ui='locust'] .lc-swarm) {
        --accent: #b45bd6;
    }
    :global([data-game-ui='locust'] .lc-selected) {
        --accent: #ffd166;
        color: #1a140c;
        background: #ffd166;
    }
    :global([data-game-ui='locust'] .lc-quiet) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        border: 1px solid #8a6d3b;
        border-radius: 0.5rem;
        padding: 0.3rem 0.75rem;
        color: #e0cfae;
        background: rgba(0, 0, 0, 0.15);
        transition:
            background-color 120ms ease,
            border-color 120ms ease;
    }
    :global([data-game-ui='locust'] .lc-quiet:not(:disabled):hover) {
        background: rgba(255, 255, 255, 0.08);
        border-color: #c9a961;
    }

    /* Legal-target and selection cues, matching Stellar/Rocky's green glow and gold pulse but
       stronger, because the board art is pale yellow/salmon/blue. */
    :global([data-game-ui='locust'] .lc-target) {
        transform-box: fill-box;
        transform-origin: center;
        animation: lc-target-pulse 1.6s ease-in-out infinite;
    }
    :global([data-game-ui='locust'] .lc-target-go) {
        filter: drop-shadow(0 0 4px rgba(61, 220, 132, 1))
            drop-shadow(0 0 10px rgba(61, 220, 132, 0.9))
            drop-shadow(0 0 18px rgba(61, 220, 132, 0.6));
    }
    :global([data-game-ui='locust'] .lc-target-gold) {
        filter: drop-shadow(0 0 4px rgba(255, 214, 110, 1))
            drop-shadow(0 0 10px rgba(255, 214, 110, 0.9))
            drop-shadow(0 0 18px rgba(255, 214, 110, 0.6));
    }
    :global([data-game-ui='locust'] .lc-target-swarm) {
        filter: drop-shadow(0 0 4px rgba(208, 124, 240, 1))
            drop-shadow(0 0 10px rgba(208, 124, 240, 0.9))
            drop-shadow(0 0 18px rgba(180, 91, 214, 0.6));
    }
    /* Action spaces stay quiet so their printed numbers remain readable; hover brings the glow up. */
    :global([data-game-ui='locust'] .lc-space-ring) {
        filter: drop-shadow(0 0 2px rgba(61, 220, 132, 0.95))
            drop-shadow(0 0 5px rgba(61, 220, 132, 0.6));
        transition: filter 120ms ease;
    }
    :global([data-game-ui='locust'] .lc-space:hover .lc-space-ring) {
        stroke-width: 5;
        filter: drop-shadow(0 0 4px rgba(61, 220, 132, 1))
            drop-shadow(0 0 11px rgba(61, 220, 132, 0.9));
    }
    :global([data-game-ui='locust'] .lc-lift) {
        filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55));
    }
    @keyframes -global-lc-target-pulse {
        0%,
        100% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.07);
            opacity: 0.8;
        }
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
