<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { OreCapacityByToolLevel, HuntDrawRuleByWeaponLevel } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import GridView from '$lib/components/GridView.svelte'

    const gameSession = getGameSession()
    const players = $derived(gameSession.gameState.players)
</script>

<div class="h-full overflow-y-auto p-4 text-[#f1e6cf]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#c9a961]">Weapon / tool grid</h2>
    <div class="mx-auto w-full max-w-[900px]">
        <button
            type="button"
            class="block w-full cursor-zoom-in"
            title="Click to enlarge"
            onclick={() => (gameSession.gridZoomOpen = true)}
        >
            <GridView idPrefix="grid-panel" class="w-full" />
        </button>
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
