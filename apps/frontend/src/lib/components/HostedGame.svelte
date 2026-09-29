<script lang="ts">
    import {
        ExplorationPanel,
        GameSession,
        HotseatPanel,
        setGameSession,
        HistoryKeyControls,
        getAppContext,
        AdminPanel,
        GameUI,
        attachGlobalCssVarFromRect
    } from '@tabletop/frontend-components'
    import NextGameButton from '$lib/components/NextGameButton.svelte'

    import { onMount, untrack } from 'svelte'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    // One instance per game session: the route keys this component on the session so that
    // moving from one game to another (e.g. via "Next game") tears the old session down and
    // sets the new one up, instead of leaving the previous game on screen under a new URL.
    let props: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const gameSession = untrack(() => props.gameSession)
    const { isExploring, gameHotseat } = gameSession.bridge

    setGameSession(gameSession)

    let { gameService, notificationService, authorizationService, chatService } = getAppContext()

    onMount(() => {
        gameService.currentGameSession = gameSession

        if (!gameSession.game.hotseat) {
            setTimeout(() => {
                notificationService.showPrompt()
            }, 2000)

            gameSession.listenToGame()
        }
        return () => {
            gameSession.stopListeningToGame()
            gameSession.dispose()
            gameService.currentGameSession = undefined
            chatService.clear()
        }
    })
</script>

<HistoryKeyControls />

<div class="flex flex-col w-screen overflow-auto">
    <div {@attach attachGlobalCssVarFromRect('--app-banner-height')}>
        {#if $isExploring}
            <ExplorationPanel />
        {:else if $gameHotseat}
            <HotseatPanel />
        {:else if authorizationService.actAsAdmin}
            <AdminPanel />
        {/if}
    </div>
    <GameUI {gameSession} />
</div>

<NextGameButton {gameSession} />
