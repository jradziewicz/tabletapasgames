<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedRockyVenturesPlayerState } from '@tabletop/rocky-ventures'
    import PlayerPanel from '$lib/components/PlayerPanel.svelte'
    import DummyPanel from '$lib/components/DummyPanel.svelte'
    import RailroadsPanel from '$lib/components/RailroadsPanel.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { GemSupplySize, gemSupplyLeft } from '@tabletop/rocky-ventures'
    import gemIcon from '$lib/images/icons/gem.png'

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
    <div class="mb-1 flex items-center justify-between px-1">
        <h2 class="text-xs font-semibold uppercase tracking-widest" style="color: #7f88ad;">Players</h2>
        <span
            class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
            style="border-color: {gemSupplyLeft(gameSession.gameState) > 0 ? '#2a3155' : '#e0b02a'}; color: {gemSupplyLeft(gameSession.gameState) > 0 ? '#c3c9e6' : '#ffd166'};"
            title="Gems left in the supply. Spent gems leave the game; no gem is gained once the supply is empty."
        >
            <img src={gemIcon} alt="" class="h-3.5 w-auto" />
            {gemSupplyLeft(gameSession.gameState)} / {GemSupplySize} in supply
        </span>
    </div>
    {#each playersAndStates as entry (entry.player.id)}
        <PlayerPanel player={entry.player} playerState={entry.playerState} />
    {/each}
    <DummyPanel />
</div>
<RailroadsPanel />
