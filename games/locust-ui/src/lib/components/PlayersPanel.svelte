<script lang="ts">
    import {
        colonyBonusTotal,
        colonyVigorTotal,
        InsectKind,
        spacesInTurnOrder
    } from '@tabletop/locust'
    import type { Color } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { isLightColonyColor } from '$lib/definitions/colorizer.js'

    const session = getGameSession()
    const state = $derived(session.gameState)

    const TokenFill: Record<string, string> = {
        grey: '#8d8d8d',
        orange: '#d98a10',
        cream: '#efe6c8',
        blue: '#58c3d4',
        red: '#f0907a',
        yellow: '#f2cf6b',
        green: '#55c25a'
    }

    const orderedPlayerIds = $derived.by(() => {
        const order = [...state.turnManager.turnOrder]
        const myId = session.myPlayer?.id
        if (myId && !session.primaryGame.hotseat) {
            while (order[0] !== myId && order.includes(myId)) order.push(order.shift() ?? myId)
        }
        return order
    })

    function insectsOnBoard(color: Color) {
        let grasshopper = 0
        let locust = 0
        let nymph = 0
        for (const habitat of state.board.habitats) {
            const occupant = habitat.occupants.find((candidate) => candidate.color === color)
            grasshopper += occupant?.[InsectKind.Grasshopper] ?? 0
            locust += occupant?.[InsectKind.Locust] ?? 0
            nymph += occupant?.[InsectKind.Nymph] ?? 0
        }
        return { grasshopper, locust, nymph }
    }

    function cubesWaiting(color: Color): number {
        return spacesInTurnOrder(state.activeRegion).filter(
            (space) => state.board.cubeOn(space.id) === color
        ).length
    }
</script>

<div class="space-y-2 p-2 text-left">
    <h2 class="mb-1 px-1 text-xs font-semibold tracking-widest uppercase" style="color: #7f88ad;">
        Players
    </h2>
    {#each orderedPlayerIds as playerId (playerId)}
        {@const player = state.getPlayerState(playerId)}
        {#each state.coloniesOf(playerId) as colony (colony.color)}
            {@const isTurn = session.actingColor === colony.color && !state.result}
            {@const fill = session.colors.getUiColor(colony.color)}
            {@const insects = insectsOnBoard(colony.color)}
            <div
                class="overflow-hidden rounded-lg border text-sm"
                style="background-color: #12162b; color: #e6e9f5; border-color: {isTurn
                    ? '#ffd166'
                    : '#2a3155'};"
            >
                <div
                    class="flex items-center justify-between border-b px-3 py-2"
                    style="background-color: {fill}; color: {isLightColonyColor(colony.color)
                        ? '#111'
                        : '#fff'}; border-color: #2a3155;"
                >
                    <div class="flex items-center gap-2 font-semibold">
                        <span
                            >{playerId === session.myPlayer?.id
                                ? 'You'
                                : session.getPlayerName(playerId)}</span
                        >
                        {#if state.isDuel}
                            <span class="text-[11px] uppercase opacity-80">{colony.color}</span>
                        {/if}
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="font-mono text-sm font-semibold">{colony.vigor} VP</span>
                        {#if isTurn}
                            <span
                                class="rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
                                >Active</span
                            >
                        {/if}
                    </div>
                </div>

                <div class="grid grid-cols-3 border-b" style="border-color: #2a3155;">
                    <div class="px-3 py-1.5" title="Discs you can breed with">
                        <div class="text-[10px] tracking-widest uppercase" style="color: #7f88ad;">
                            Supply
                        </div>
                        <div class="font-mono font-semibold">{colony.supply}</div>
                    </div>
                    <div
                        class="border-l px-3 py-1.5"
                        style="border-color: #2a3155;"
                        title="Dead discs in the general pool"
                    >
                        <div class="text-[10px] tracking-widest uppercase" style="color: #7f88ad;">
                            Dead
                        </div>
                        <div class="font-mono font-semibold">{colony.dead}</div>
                    </div>
                    <div
                        class="border-l px-3 py-1.5"
                        style="border-color: #2a3155;"
                        title="Cubes still waiting in the Active Region"
                    >
                        <div class="text-[10px] tracking-widest uppercase" style="color: #7f88ad;">
                            Cubes
                        </div>
                        <div class="font-mono font-semibold">{cubesWaiting(colony.color)}</div>
                    </div>
                </div>

                <div
                    class="flex items-center gap-3 border-b px-3 py-1.5"
                    style="border-color: #2a3155;"
                >
                    <span class="flex items-center gap-1" title="Grasshoppers (2 VP)">
                        <span
                            class="inline-block h-3 w-3 rounded-full border border-black/60"
                            style:background-color={fill}
                        ></span>
                        <span class="font-mono">{insects.grasshopper}</span>
                    </span>
                    <span class="flex items-center gap-1" title="Locusts (1 VP)">
                        <span
                            class="relative inline-block h-3 w-3 rounded-full border border-black/60"
                            style:background-color={fill}
                        >
                            <span
                                class="absolute top-0 right-0 h-1.5 w-1.5 rounded-full border border-black/60 bg-white"
                            ></span>
                        </span>
                        <span class="font-mono">{insects.locust}</span>
                    </span>
                    <span class="flex items-center gap-1" title="Nymphs (0 VP, grow up next turn)">
                        <span
                            class="inline-block h-3 w-3 rounded-full border-2"
                            style:border-color={fill}
                        ></span>
                        <span class="font-mono">{insects.nymph}</span>
                    </span>
                    <span
                        class="ml-auto text-[10px] tracking-widest uppercase"
                        style="color: #7f88ad;">on board</span
                    >
                </div>

                <div class="flex min-h-8 flex-wrap items-center gap-1 px-3 py-1.5">
                    <span class="mr-1 text-[10px] tracking-widest uppercase" style="color: #7f88ad;"
                        >Tokens</span
                    >
                    {#each colony.tokens as token, index (index)}
                        <span
                            class="inline-block h-4 w-4 rounded-full border border-black/50 shadow"
                            style:background-color={TokenFill[token] ?? '#999'}
                            title="{token} bonus token"
                        ></span>
                    {:else}
                        <span class="text-[11px]" style="color: #4a5175;">none yet</span>
                    {/each}
                </div>

                {#if colony.finalScore}
                    <div class="border-t px-3 py-1.5 text-[12px]" style="border-color: #2a3155;">
                        Vigor <b class="font-mono">{colonyVigorTotal(state, colony.color)}</b> ·
                        Bonus
                        <b class="font-mono">{colonyBonusTotal(state, colony.color)}</b>
                        {#if player.vigorColor}
                            <span style="color: #ffd166;"
                                >· counts {player.vigorColor === colony.color
                                    ? 'Vigor'
                                    : 'Bonus'}</span
                            >
                        {/if}
                        {#if player.score !== undefined && colony === state.coloniesOf(playerId)[0]}
                            <span class="float-right font-mono font-bold" style="color: #ffd166;"
                                >{player.score} pts</span
                            >
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}
    {/each}
</div>
