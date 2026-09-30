<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { BoardArtSize, OreCapacityByToolLevel, HuntDrawRuleByWeaponLevel } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { gridCellPosition } from '$lib/utils/trackLayout.js'
    import boardArt from '$lib/images/board.jpg'
    import GridArtOverrides from '$lib/components/GridArtOverrides.svelte'

    const gameSession = getGameSession()
    const players = $derived(gameSession.gameState.players)

    // The printed grid's region of the board art.
    const view = { x: 1580, y: 1188, width: 410, height: 215 }

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

<div class="h-full overflow-y-auto p-4 text-[#f1e6cf]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#c9a961]">Weapon / tool grid</h2>
    <div class="mx-auto w-full max-w-[900px]">
        <svg viewBox="{view.x} {view.y} {view.width} {view.height}" class="w-full select-none" xmlns="http://www.w3.org/2000/svg">
            <image href={boardArt} x="0" y="0" width={BoardArtSize.width} height={BoardArtSize.height} />
            <GridArtOverrides artUrl={boardArt} idPrefix="grid-panel" />
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
    </div>
    <table class="mt-4 w-full max-w-[900px] text-sm">
        <thead class="text-[#c9a961]">
            <tr>
                <th class="text-left">Player</th>
                <th>Weapon</th>
                <th>Hunt draw / apply</th>
                <th>Tool</th>
                <th>Gold / silver ore</th>
                <th>Restricted mines</th>
            </tr>
        </thead>
        <tbody>
            {#each players as player (player.playerId)}
                {@const hunt = HuntDrawRuleByWeaponLevel[player.weaponLevel]}
                {@const ore = OreCapacityByToolLevel[player.toolLevel]}
                <tr class="border-t border-[#4a3620]">
                    <td class="py-1"><PlayerName playerId={player.playerId} /></td>
                    <td class="text-center">{player.weaponLevel}</td>
                    <td class="text-center">{hunt.draw} / {hunt.apply}</td>
                    <td class="text-center">{player.toolLevel}</td>
                    <td class="text-center">{ore.gold} / {ore.silver}</td>
                    <td class="text-center">
                        {#if player.blueMinesUnlocked}red + blue{:else if player.redMinesUnlocked}red{:else}—{/if}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
