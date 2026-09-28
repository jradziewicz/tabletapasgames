<script lang="ts">
    import { onMount } from 'svelte'
    import { GameStatusCategory, GameStatus, GameResult, type GameWithoutState } from '@tabletop/common'
    import { createTimeAgo, getAppContext } from '@tabletop/frontend-components'

    const { api, libraryService } = getAppContext()
    const timeAgo = createTimeAgo()

    let category = $state<GameStatusCategory>(GameStatusCategory.Active)
    let games = $state<GameWithoutState[]>([])
    let cursor: string | undefined = undefined
    let exhausted = $state(false)
    let busy = $state(false)
    let failed = $state(false)

    async function loadPage(reset: boolean) {
        if (busy) return
        busy = true
        failed = false
        try {
            const page = await api.getAdminGames(category, reset ? undefined : cursor)
            games = reset ? page.games : [...games, ...page.games]
            cursor = page.nextCursor
            exhausted = cursor === undefined
        } catch {
            failed = true
        } finally {
            busy = false
        }
    }

    function selectCategory(next: GameStatusCategory) {
        if (category === next) return
        category = next
        games = []
        cursor = undefined
        exhausted = false
        void loadPage(true)
    }

    function titleName(typeId: string): string {
        return libraryService.getNameForTitle(typeId)
    }

    function statusLabel(game: GameWithoutState): string {
        switch (game.status) {
            case GameStatus.WaitingForPlayers:
                return 'Waiting for players'
            case GameStatus.WaitingToStart:
                return 'Waiting to start'
            case GameStatus.Started:
                return 'In progress'
            case GameStatus.Finished:
                return 'Finished'
            case GameStatus.Deleted:
                return 'Deleted'
            case GameStatus.Archived:
                return 'Archived'
            default:
                return game.status
        }
    }

    function progressLabel(game: GameWithoutState): string {
        if (game.status !== GameStatus.Started) return '—'
        if (!game.activePlayerIds || game.activePlayerIds.length === 0) return '—'
        const names = game.activePlayerIds
            .map((id) => game.players.find((player) => player.id === id)?.name)
            .filter((name): name is string => Boolean(name))
        if (names.length === 0) return '—'
        return `${names.join(', ')}'s turn`
    }

    function resultLabel(game: GameWithoutState): string {
        if (game.status !== GameStatus.Finished) return '—'
        if (game.result === GameResult.Abandoned) return 'Abandoned'
        if (game.winningPlayerIds.length === 0) return '—'
        const names = game.winningPlayerIds
            .map((id) => game.players.find((player) => player.id === id)?.name)
            .filter((name): name is string => Boolean(name))
        if (names.length === 0) return '—'
        const label = names.join(', ')
        return game.result === GameResult.Draw ? `Tied: ${label}` : label
    }

    function lastTouched(game: GameWithoutState): Date | undefined {
        if (game.status === GameStatus.Finished) return game.finishedAt
        return game.lastActionAt ?? game.updatedAt ?? game.createdAt
    }

    onMount(() => {
        void loadPage(true)
    })
</script>

<svelte:head><title>Admin: Games — TableTapas</title></svelte:head>

<main class="admin-games">
    <h1>All games</h1>
    <p class="subtitle">
        Every game on the site, not just your own. Open a game to watch its progress, or - once
        it's finished - to pull up its full scoring breakdown.
    </p>

    <div class="tabs" role="tablist">
        <button
            role="tab"
            aria-selected={category === GameStatusCategory.Active}
            class:active={category === GameStatusCategory.Active}
            onclick={() => selectCategory(GameStatusCategory.Active)}>Active</button
        >
        <button
            role="tab"
            aria-selected={category === GameStatusCategory.Completed}
            class:active={category === GameStatusCategory.Completed}
            onclick={() => selectCategory(GameStatusCategory.Completed)}>Completed</button
        >
    </div>

    {#if failed}
        <p class="message" role="alert">
            Games couldn't load. <button onclick={() => loadPage(games.length === 0)}
                >Try again</button
            >
        </p>
    {:else if busy && games.length === 0}
        <p class="message" role="status">Loading games…</p>
    {:else if games.length === 0}
        <p class="message">
            No {category === GameStatusCategory.Active ? 'active' : 'finished'} games right now.
        </p>
    {:else}
        <table>
            <thead>
                <tr>
                    <th>Game</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Players</th>
                    <th>{category === GameStatusCategory.Active ? "Turn / last active" : 'Winner'}</th>
                    <th>{category === GameStatusCategory.Active ? 'Last touched' : 'Finished'}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {#each games as game (game.id)}
                    {@const touched = lastTouched(game)}
                    <tr>
                        <td class="name">{game.name}</td>
                        <td>{titleName(game.typeId)}</td>
                        <td>{statusLabel(game)}</td>
                        <td>{game.players.map((player) => player.name ?? '(open seat)').join(', ')}</td>
                        <td>{category === GameStatusCategory.Active ? progressLabel(game) : resultLabel(game)}</td>
                        <td>{touched ? timeAgo.format(new Date(touched)) : '—'}</td>
                        <td>
                            {#if game.status === GameStatus.Started || game.status === GameStatus.Finished}
                                <a class="open-link" href={`/game/${game.id}?admin=1`}>Open</a>
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
        {#if !exhausted}
            <button class="load-more" disabled={busy} onclick={() => loadPage(false)}>
                {busy ? 'Loading…' : 'Load more games'}
            </button>
        {/if}
    {/if}
</main>

<style>
    .admin-games {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 16px 64px;
        color: var(--color-gray-200);
    }
    h1 {
        font-family: 'Inter', sans-serif;
        font-size: 28px;
        font-weight: 650;
    }
    .subtitle {
        margin-top: 8px;
        color: var(--color-gray-400);
        font-size: 14px;
        max-width: 640px;
    }
    .tabs {
        display: flex;
        gap: 8px;
        margin-top: 24px;
        border-bottom: 1px solid var(--color-gray-800);
    }
    .tabs button {
        padding: 8px 16px;
        color: var(--color-gray-400);
        font-size: 14px;
        font-weight: 500;
        border-bottom: 2px solid transparent;
    }
    .tabs button.active {
        color: white;
        border-bottom-color: #7165ad;
    }
    .message {
        margin-top: 24px;
        padding: 28px;
        border: 1px solid var(--color-gray-800);
        border-radius: 12px;
        color: var(--color-gray-400);
        font-size: 14px;
    }
    .message button {
        color: #a29ac9;
    }
    table {
        width: 100%;
        margin-top: 20px;
        border-collapse: collapse;
        font-size: 13px;
    }
    th {
        text-align: left;
        padding: 8px 12px;
        color: var(--color-gray-500);
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border-bottom: 1px solid var(--color-gray-800);
    }
    td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--color-gray-800);
        color: var(--color-gray-300);
        vertical-align: top;
    }
    td.name {
        color: white;
        font-weight: 500;
    }
    .open-link {
        color: #a29ac9;
        font-weight: 500;
        white-space: nowrap;
    }
    .open-link:hover {
        text-decoration: underline;
    }
    .load-more {
        display: block;
        margin: 24px auto 0;
        padding: 10px 20px;
        border: 1px solid var(--color-gray-700);
        border-radius: 8px;
        color: #a29ac9;
        font-size: 14px;
    }
</style>
