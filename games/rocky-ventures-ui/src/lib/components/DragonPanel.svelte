<script lang="ts">
    import { BonusTokensToSummonDragon, DragonLevel, WeaponTokenKind } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        DragonTileImageUrl,
        DragonTrackerImageUrl,
        DragonTrackerSize,
        DragonTrackerSlots,
        weaponTokenImageUrl
    } from '$lib/utils/dragonImages.js'

    const gameSession = getGameSession()
    const dragon = $derived(gameSession.gameState.dragon)
    const bag = $derived(gameSession.gameState.weaponBag)

    const bagRows: { kind: WeaponTokenKind; label: string }[] = [
        { kind: WeaponTokenKind.Hit, label: 'Hit' },
        { kind: WeaponTokenKind.Miss, label: 'Miss' },
        { kind: WeaponTokenKind.BonusGold, label: '+3 gold' },
        { kind: WeaponTokenKind.BonusWeaponLevel, label: '+1 weapon level' },
        { kind: WeaponTokenKind.BonusGem, label: '+1 gem' },
        { kind: WeaponTokenKind.BonusInvest, label: 'Invest action' }
    ]
</script>

<div class="h-full overflow-y-auto p-4 text-[#f1e6cf]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#c9a961]">Dragon</h2>
    <div class="flex flex-wrap items-start gap-8">
        <div class="w-[300px]">
            <div class="mb-1 text-xs text-[#c9a961]">
                Dragon tracker · {dragon.trackerTokens.length}/{BonusTokensToSummonDragon} bonus tokens
            </div>
            <svg viewBox="0 0 {DragonTrackerSize.width} {DragonTrackerSize.height}" class="w-full" xmlns="http://www.w3.org/2000/svg">
                <image href={DragonTrackerImageUrl} x="0" y="0" width={DragonTrackerSize.width} height={DragonTrackerSize.height} />
                {#each dragon.trackerTokens as kind, index (index)}
                    {@const slot = DragonTrackerSlots[index]}
                    {@const url = weaponTokenImageUrl(kind)}
                    {#if slot && url}
                        <image href={url} x={slot.x - 42} y={slot.y - 42} width="84" height="84" />
                    {/if}
                {/each}
            </svg>
        </div>
        <div class="w-[300px]">
            <div class="mb-1 text-xs text-[#c9a961]">
                {#if dragon.killed}
                    The Dragon has been slain
                {:else if dragon.summoned}
                    The Dragon is loose · {dragon.hits}/{DragonLevel} hits · +$8 on every delivery
                {:else}
                    The Dragon sleeps until the sixth bonus token is placed
                {/if}
            </div>
            <div class="relative w-full" class:opacity-30={!dragon.summoned} class:grayscale={dragon.killed}>
                <img src={DragonTileImageUrl} alt="Dragon" class="block w-full" draggable="false" />
                {#if dragon.summoned && !dragon.killed}
                    <div class="absolute bottom-3 right-3 rounded-full bg-[#d3342f] px-3 py-1 font-mono text-lg font-bold text-white shadow">
                        {dragon.hits}/{DragonLevel}
                    </div>
                {/if}
            </div>
        </div>
        <div class="min-w-[220px]">
            <div class="mb-1 text-xs text-[#c9a961]">Weapon bag</div>
            <table class="text-sm">
                <tbody>
                    {#each bagRows as row (row.kind)}
                        {@const url = weaponTokenImageUrl(row.kind)}
                        <tr class="border-t border-[#4a3620]">
                            <td class="py-1 pr-2">
                                {#if url}<img src={url} alt="" class="h-8 w-8 rounded" />{/if}
                            </td>
                            <td class="pr-4">{row.label}</td>
                            <td class="text-right font-mono font-semibold">{bag[row.kind] ?? 0}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</div>
