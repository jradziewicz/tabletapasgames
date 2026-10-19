<script lang="ts">
    import { BoardArtSize } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { GridRegion, gridCellPosition } from '$lib/utils/trackLayout.js'
    import boardArt from '$lib/images/board.jpg'
    import GridArtOverrides from '$lib/components/GridArtOverrides.svelte'

    // The weapon / tool grid cut out of the board art, with each player's disc on it.
    let { idPrefix, class: className = '' }: { idPrefix: string; class?: string } = $props()

    const gameSession = getGameSession()
    const players = $derived(gameSession.gameState.players)

    const view = GridRegion

    const groups = $derived.by(() => {
        const map = new Map<string, string[]>()
        for (const player of players) {
            const key = `${player.weaponLevel},${player.toolLevel}`
            map.set(key, [...(map.get(key) ?? []), player.playerId])
        }
        return map
    })

    function offset(playerId: string, weapon: number, tool: number) {
        const group = groups.get(`${weapon},${tool}`) ?? []
        const index = group.indexOf(playerId)
        const spread = 9
        return { dx: (index - (group.length - 1) / 2) * spread, dy: (index - (group.length - 1) / 2) * -spread * 0.6 }
    }
</script>

<svg viewBox="{view.x} {view.y} {view.width} {view.height}" class="select-none {className}" xmlns="http://www.w3.org/2000/svg">
    <image href={boardArt} x="0" y="0" width={BoardArtSize.width} height={BoardArtSize.height} />
    <GridArtOverrides artUrl={boardArt} {idPrefix} />
    {#each players as player (player.playerId)}
        {@const cell = gridCellPosition(player.weaponLevel, player.toolLevel)}
        {@const shift = offset(player.playerId, player.weaponLevel, player.toolLevel)}
        <circle
            cx={cell.x + shift.dx}
            cy={cell.y + shift.dy}
            r="11"
            fill={gameSession.colors.getPlayerUiColor(player.playerId)}
            stroke="#111"
            stroke-width="2"
        />
    {/each}
</svg>
