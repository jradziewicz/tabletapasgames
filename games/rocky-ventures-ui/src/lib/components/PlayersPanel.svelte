<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedRockyVenturesPlayerState } from '@tabletop/rocky-ventures'
    import PlayerPanel from '$lib/components/PlayerPanel.svelte'
    import DummyPanel from '$lib/components/DummyPanel.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    type PlayerAndState = { player: Player; playerState: HydratedRockyVenturesPlayerState }

    const playersAndStates: PlayerAndState[] = $derived.by(() => {
        const byId = new Map<string, PlayerAndState>()
        for (const playerState of gameSession.gameState.players) {
            const player = gameSession.game.players.find((candidate) => candidate.id === playerState.playerId)
            if (player) {
                byId.set(playerState.playerId, { player, playerState })
            }
        }
        const ordered = gameSession.gameState.turnManager.turnOrder
            .map((playerId) => byId.get(playerId))
            .filter((entry): entry is PlayerAndState => entry !== undefined)

        if (gameSession.myPlayer && !gameSession.primaryGame.hotseat) {
            const myPlayerId = gameSession.myPlayer.id
            while (ordered.length > 0 && ordered[0]!.player.id !== myPlayerId) {
                ordered.push(ordered.shift()!)
            }
        }
        return ordered
    })
</script>

<div class="space-y-2 p-2 text-left grow-0 shrink-0">
    <h2 class="mb-1 px-1 text-xs font-semibold uppercase tracking-widest" style="color: #7f88ad;">Players</h2>
    {#each playersAndStates as entry (entry.player.id)}
        <PlayerPanel player={entry.player} playerState={entry.playerState} />
    {/each}
    <DummyPanel />
</div>
