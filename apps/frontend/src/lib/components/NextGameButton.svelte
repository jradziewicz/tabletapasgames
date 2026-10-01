<script lang="ts">
    import { untrack } from 'svelte'
    import { fade } from 'svelte/transition'
    import { ArrowRightOutline, CloseOutline } from 'flowbite-svelte-icons'
    import { getAppContext, type GameSession } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { isUsersGameTurn, nextTurnGame, otherTurnGames } from '$lib/utils/dashboardGames'

    let props: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const gameSession = untrack(() => props.gameSession)
    const { gameService, authorizationService } = getAppContext()

    let sessionUser = $derived(authorizationService.getSessionUser())
    let game = $derived(gameSession.primaryGame)

    // The session's own turn flag is the live truth. It only misleads while browsing history or
    // viewing as another player (it reads false then), so only in those cases fall back to the
    // game record. The record must not be consulted otherwise: an action the player just took
    // doesn't refresh it (the server's updated record is dropped when the optimistic result is
    // kept), so it still lists them as active and the button never appeared after their turn.
    let takingTurn = $derived(
        gameSession.isMyTurn ||
            ((gameSession.isViewingHistory || gameSession.isViewingAsNonActivePlayer) &&
                isUsersGameTurn(game, sessionUser?.id))
    )

    // Only offer to move on once the user has actually had a turn in this game during this
    // visit and finished it (not merely opened a game they are waiting on), and let them wave
    // it away; it comes back the next time their turn here ends.
    let hadTurn = $state(false)
    let dismissed = $state(false)
    $effect(() => {
        if (takingTurn) {
            hadTurn = true
            dismissed = false
        }
    })

    let waitingGames = $derived(otherTurnGames(gameService.activeGames, game.id, sessionUser?.id))
    let next = $derived(nextTurnGame(gameService.activeGames, game.id, sessionUser?.id))

    let visible = $derived(
        hadTurn &&
            !dismissed &&
            !takingTurn &&
            !game.hotseat &&
            gameSession.myPlayer !== undefined &&
            next !== undefined
    )
</script>

{#if visible && next}
    <div
        class="fixed bottom-4 right-4 z-40 flex items-stretch overflow-hidden rounded-full bg-[#7165ad] text-white shadow-lg"
        style="margin-bottom: env(safe-area-inset-bottom, 0px)"
        transition:fade={{ duration: 150 }}
    >
        <a
            href={`/game/${next.id}`}
            class="flex items-center gap-2 py-2.5 pl-5 pr-3 text-sm font-semibold hover:bg-[#5b4f95] focus-visible:bg-[#5b4f95] focus-visible:outline-none"
            aria-label={`Go to your next game: ${next.name}. ${waitingGames.length} ${waitingGames.length === 1 ? 'game is' : 'games are'} waiting on you.`}
            title={next.name}
        >
            Next game
            <span
                class="inline-flex min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 py-0.5 text-xs font-semibold tabular-nums"
                >{waitingGames.length}</span
            >
            <ArrowRightOutline class="h-4 w-4" />
        </a>
        <button
            type="button"
            class="flex items-center border-l border-white/25 px-3 hover:bg-[#5b4f95] focus-visible:bg-[#5b4f95] focus-visible:outline-none"
            aria-label="Dismiss"
            onclick={() => (dismissed = true)}
        >
            <CloseOutline class="h-3.5 w-3.5" />
        </button>
    </div>
{/if}
