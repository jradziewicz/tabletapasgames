<script lang="ts">
    import { ActionType, DragonHuntRegion, RegionIds, RegionNames, WeaponTokenKind } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { DragonTileImageUrl, weaponTokenImageUrl } from '$lib/utils/dragonImages.js'
    import { recentOtherPlayerAction } from '$lib/utils/recentAction.js'
    import { scourgeImageUrl } from '$lib/utils/scourgeImages.js'

    // What another player's last hunt drew, what they picked, and what it did.
    const gameSession = getGameSession()

    type HuntResult = {
        playerId: string
        region: string
        tokens: { kind: WeaponTokenKind; applied: boolean }[]
        hitTargets: string[]
        gains: string[]
    }

    const result = $derived.by((): HuntResult | undefined => {
        if (gameSession.gameState.pendingHunt) return undefined
        const recent = recentOtherPlayerAction<{ tokenIndexes: number[]; hitTargets: string[] }>(
            gameSession,
            ActionType.ResolveHunt
        )
        // The drawn tokens are cleared once a hunt resolves, so they come from the state before it.
        const pending = recent?.before.pendingHunt
        if (!recent || !pending) return undefined
        const before = recent.before.getPlayerState(recent.playerId)
        const after = recent.after.getPlayerState(recent.playerId)
        return {
            playerId: recent.playerId,
            region: pending.region,
            tokens: pending.drawn.map((kind, index) => ({ kind, applied: recent.action.tokenIndexes.includes(index) })),
            hitTargets: recent.action.hitTargets,
            gains: [
                gain(after.victoryPoints - before.victoryPoints, 'VP'),
                gain(after.money - before.money, undefined, '$'),
                gain(after.gems - before.gems, 'gem'),
                gain(after.weaponLevel - before.weaponLevel, 'weapon level')
            ].filter((text) => text !== undefined)
        }
    })

    function gain(amount: number, word?: string, prefix = '') {
        if (amount <= 0) return undefined
        return `+${prefix}${amount}${word ? ` ${word}${word === 'gem' && amount > 1 ? 's' : ''}` : ''}`
    }

    function regionLabel(region: string): string {
        if (region === DragonHuntRegion) return 'the Dragon'
        const id = RegionIds.find((candidate) => candidate === region)
        return id ? RegionNames[id] : region
    }
</script>

{#if result}
    <div class="mb-2 rounded border border-[#8a6d3b] bg-black/20 px-2 py-1.5">
        <div class="text-xs text-[#c9a961]">
            <strong class="capitalize text-[#f1e6cf]">{gameSession.getPlayerName(result.playerId)}</strong>
            hunted {regionLabel(result.region)}{#if result.gains.length}: {result.gains.join(', ')}{/if}
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-1.5">
            {#each result.tokens as token, index (index)}
                {@const url = weaponTokenImageUrl(token.kind)}
                {#if url}
                    <img
                        src={url}
                        alt={token.kind}
                        title={token.applied ? 'Applied' : 'Not applied'}
                        class="block h-10 w-10 {token.applied ? '' : 'opacity-35 grayscale'}"
                        draggable="false"
                    />
                {/if}
            {/each}
            {#each result.hitTargets as target, index (index)}
                {@const url = target === DragonHuntRegion ? DragonTileImageUrl : scourgeImageUrl(target)}
                {#if url}
                    <img src={url} alt={target} title="Hit" class="ml-1 block h-12 w-auto rounded" draggable="false" />
                {/if}
            {/each}
        </div>
    </div>
{/if}
