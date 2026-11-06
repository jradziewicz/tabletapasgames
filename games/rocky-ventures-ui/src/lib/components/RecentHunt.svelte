<script lang="ts">
    import { GameEngine } from '@tabletop/common'
    import {
        ActionType,
        Definition,
        DragonHuntRegion,
        RegionIds,
        RegionNames,
        WeaponTokenKind,
        type HydratedRockyVenturesGameState,
        type RockyVenturesGameState
    } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { DragonTileImageUrl, weaponTokenImageUrl } from '$lib/utils/dragonImages.js'
    import { scourgeImageUrl } from '$lib/utils/scourgeImages.js'

    // What another player's last hunt drew and did. It stays up through the rest of their
    // turn and until the next player acts, so nobody misses it when the turn passes.
    const gameSession = getGameSession()
    const engine = new GameEngine(Definition.runtime)

    type HuntResult = {
        playerId: string
        region: string
        tokens: { kind: WeaponTokenKind; applied: boolean }[]
        hitTargets: string[]
        gains: string[]
    }

    const result = $derived.by((): HuntResult | undefined => {
        const gameState = gameSession.gameState
        if (gameSession.isViewingHistory || gameState.pendingHunt) return undefined
        const actions = gameSession.actions
        const huntIndex = actions.findLastIndex((action) => action.type === ActionType.ResolveHunt)
        const hunt = actions[huntIndex] as (typeof actions)[number] & { tokenIndexes: number[]; hitTargets: string[] }
        if (!hunt?.playerId || hunt.playerId === gameSession.myPlayer?.id) return undefined
        if (actions.slice(huntIndex + 1).some((action) => action.playerId && action.playerId !== hunt.playerId)) return undefined

        try {
            // The drawn tokens are cleared once a hunt resolves, so step back to read them.
            let state = gameState.dehydrate() as RockyVenturesGameState
            for (let index = actions.length - 1; index > huntIndex; index--) {
                state = engine.undoProcessedAction({ action: actions[index]!, state })
            }
            const after = hydrate(state).getPlayerState(hunt.playerId)
            const beforeState = hydrate(engine.undoProcessedAction({ action: hunt, state }))
            const before = beforeState.getPlayerState(hunt.playerId)
            const pending = beforeState.pendingHunt
            if (!pending) return undefined

            const gains = [
                gain(after.victoryPoints - before.victoryPoints, 'VP'),
                gain(after.money - before.money, undefined, '$'),
                gain(after.gems - before.gems, 'gem'),
                gain(after.weaponLevel - before.weaponLevel, 'weapon level')
            ].filter((text) => text !== undefined)
            return {
                playerId: hunt.playerId,
                region: pending.region,
                tokens: pending.drawn.map((kind, index) => ({ kind, applied: hunt.tokenIndexes.includes(index) })),
                hitTargets: hunt.hitTargets,
                gains
            }
        } catch (error) {
            console.warn('Could not read the last hunt', error)
            return undefined
        }
    })

    function hydrate(state: RockyVenturesGameState) {
        return Definition.runtime.hydrator.hydrateState(structuredClone(state)) as HydratedRockyVenturesGameState
    }

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
