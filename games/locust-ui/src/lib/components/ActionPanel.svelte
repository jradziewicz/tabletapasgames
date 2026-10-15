<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionKind, InsectKind, MachineState, isPlaceCube } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { JumpOrBreedMode } from '$lib/model/session.svelte.js'
    import { ActionBlurbs, ActionNames } from '$lib/utils/describe.js'
    import ActionBadge from './ActionBadge.svelte'
    import ColonyChip from './ColonyChip.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const pending = $derived(session.pendingAction)
    const actingColony = $derived(
        session.actingColor ? state.colony(session.actingColor) : undefined
    )
    const breedLimit = $derived(
        pending && actingColony ? Math.min(pending.level, actingColony.supply) : 0
    )

    const KindLabels: Record<InsectKind, string> = {
        [InsectKind.Grasshopper]: 'grasshopper',
        [InsectKind.Locust]: 'locust',
        [InsectKind.Nymph]: 'nymph'
    }

    // HATCH resolves automatically, so the result is shown until the next player move.
    const lastHatch = $derived.by(() => {
        const lastPlayerAction = session.actions.findLast((action) => action.playerId !== undefined)
        if (
            !lastPlayerAction ||
            !isPlaceCube(lastPlayerAction) ||
            lastPlayerAction.metadata?.hatched === undefined
        ) {
            return undefined
        }
        return { playerId: lastPlayerAction.playerId, hatched: lastPlayerAction.metadata.hatched }
    })

    const progress = $derived.by(() => {
        if (!pending) return ''
        switch (pending.kind) {
            case ActionKind.JumpOrBreed:
                if (session.jumpOrBreedMode === JumpOrBreedMode.Jump) {
                    return `Jumps ${session.hops.length}/${pending.level}`
                }
                if (session.jumpOrBreedMode === JumpOrBreedMode.Breed) {
                    return `Nymphs ${session.breedHabitatIds.length}/${breedLimit}`
                }
                return ''
            case ActionKind.Cannibalize:
                return `Habitats ${session.attacks.length}/${pending.level}`
            case ActionKind.Swarm:
                return `Swarms ${session.swarmHabitatIds.length}/${pending.level}`
            default:
                return ''
        }
    })

    const instruction = $derived.by(() => {
        if (!pending) return ''
        switch (pending.kind) {
            case ActionKind.JumpOrBreed:
                if (session.hopOrigin) {
                    return 'Click a glowing linked habitat to land (click the grasshopper again to put it back).'
                }
                if (session.jumpOrBreedMode === JumpOrBreedMode.Jump)
                    return 'Click a glowing grasshopper to keep jumping.'
                if (session.jumpOrBreedMode === JumpOrBreedMode.Breed) {
                    return 'Click a glowing nymph circle to lay another nymph.'
                }
                return 'Click a glowing grasshopper to JUMP, or a glowing nymph circle to BREED.'
            case ActionKind.Cannibalize:
                if (session.pickingAttack) {
                    return `Choose who gets eaten in ${session.pickingAttack.habitatId}:`
                }
                return session.attacks.length > 0
                    ? 'Marked habitats will be eaten as labelled. Click another glowing habitat, or End action to eat now.'
                    : 'Click a glowing habitat where your locusts can feed.'
            case ActionKind.Swarm:
                return 'Click a glowing crowded habitat to make it swarm.'
            default:
                return ''
        }
    })
</script>

<div class="px-4 py-2 text-sm text-[#f1e6cf]">
    {#if lastHatch && !session.isViewingHistory}
        <div
            class="hatch-note mb-2 inline-flex items-center gap-2 rounded-full border border-[#efe6c8]/60 bg-[#efe6c8]/10 px-3 py-0.5 text-[13px]"
        >
            <ActionBadge kind={ActionKind.Hatch} level={lastHatch.hatched} size={20} />
            <PlayerName playerId={lastHatch.playerId} />
            <span
                >hatched <b class="font-mono text-[#ffd166]">{lastHatch.hatched}</b>
                disc{lastHatch.hatched === 1 ? '' : 's'} back to supply</span
            >
        </div>
    {/if}

    {#if state.result && !session.isViewingHistory}
        <div class="flex flex-wrap items-center gap-2 text-base">
            <span class="text-[11px] tracking-[0.3em] text-[#c9a961] uppercase"
                >{state.result === 'Draw' ? 'Shared victory' : 'Winner'}</span
            >
            {#each state.winningPlayerIds as playerId (playerId)}
                <span class="font-bold text-[#ffd166]"><PlayerName {playerId} /></span>
                <span class="text-[#e0cfae]">{state.getPlayerState(playerId).score} pts</span>
            {/each}
        </div>
    {:else if session.isViewingHistory}
        <div class="text-[#a88d5a]">Viewing history. Use the arrows to step through the game.</div>
    {:else if !session.canAct}
        <div class="text-[#a88d5a]">Waiting for the other players…</div>
    {:else if state.machineState === MachineState.ChooseSpace}
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div>
                <span class="font-semibold">Move your glowing cube</span>
                <span class="text-[#c9a961]">to any empty space right of the Active Region.</span>
            </div>
            {#if state.isAlternativeActionAvailable()}
                <button
                    type="button"
                    class="lc-btn {session.useAlternative ? 'lc-selected' : ''} text-[13px]"
                    onclick={() => (session.useAlternative = !session.useAlternative)}
                    title="Do JUMP/BREED level 1 in any colour instead of the space's action"
                >
                    {session.useAlternative ? '✓ ' : ''}Alternative Action
                </button>
            {/if}
        </div>
    {:else if state.machineState === MachineState.PerformAction && pending}
        <div class="flex items-start gap-3">
            <ActionBadge
                kind={pending.kind}
                level={pending.level}
                color={pending.color}
                size={44}
            />
            <div class="min-w-0 flex-1 space-y-2">
                <div>
                    <div class="font-semibold tracking-wide">
                        {#if pending.kind === ActionKind.JumpOrBreed && session.jumpOrBreedMode}
                            {session.jumpOrBreedMode === JumpOrBreedMode.Jump ? 'JUMP' : 'BREED'}
                        {:else}
                            {ActionNames[pending.kind].toUpperCase()}
                        {/if}
                        <span class="text-[#c9a961]">· LEVEL {pending.level}</span>
                        {#if pending.alternative}
                            <span class="text-[#ffd166]">· ALTERNATIVE (any colour)</span>
                        {:else if pending.color}
                            <span class="text-[#c9a961] capitalize">· {pending.color}</span>
                        {/if}
                        {#if progress}
                            <span
                                class="ml-2 rounded border border-[#4a3620] px-1.5 font-mono text-[12px] text-[#ffd166]"
                                >{progress}</span
                            >
                        {/if}
                    </div>
                    <div class="text-[12px] text-[#a88d5a]">{ActionBlurbs[pending.kind]}</div>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <span class="text-[#e0cfae]">{instruction}</span>
                    <button
                        type="button"
                        class="lc-quiet text-[12px]"
                        onclick={() => session.endAction()}
                        title="Stop here; actions are 'up to' their level">End action</button
                    >
                </div>
                {#if session.pickingAttack}
                    <div class="flex flex-wrap gap-2">
                        {#each session.victimChoices as option (`${option.color}-${option.kind}`)}
                            <button
                                type="button"
                                class="lc-btn lc-danger text-[13px]"
                                onclick={() => session.pickVictim(option.color, option.kind)}
                            >
                                <ColonyChip color={option.color} showPlayer={false} />
                                {KindLabels[option.kind]}
                                <span class="font-mono text-[11px] opacity-70"
                                    >×{option.remaining}</span
                                >
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    {:else if state.machineState === MachineState.RelocateLocusts && state.swarm}
        <div>
            <span class="font-semibold text-[#e7b3f5]">SWARM!</span>
            Click glowing habitats to fly
            <span class="font-mono text-[#ffd166]">{session.requiredRelocationCount}</span>
            locust{session.requiredRelocationCount === 1 ? '' : 's'} out of {state.swarm.habitatId}
            <span class="font-mono text-[#ffd166]"
                >({session.relocationDestinations.length}/{session.requiredRelocationCount})</span
            >. Locusts with nowhere to land die.
        </div>
    {:else if state.machineState === MachineState.AssignDuelScoring}
        <div class="space-y-2">
            <div>
                Pick the colour whose <b>Vigor Points</b> count. Your other colour scores its
                <b>Bonus Points</b>.
            </div>
            <div class="flex flex-wrap gap-2">
                {#each state.coloniesOf(state.activePlayerIds[0] ?? '') as colony (colony.color)}
                    <button
                        type="button"
                        class="lc-btn"
                        onclick={() => session.assignVigorColor(colony.color)}
                    >
                        <ColonyChip color={colony.color} showPlayer={false} />
                        <span class="font-mono">{colony.vigor} VP</span>
                    </button>
                {/each}
            </div>
        </div>
    {/if}
    {#if session.lastActionError}
        <div class="mt-2 rounded border border-red-500/70 bg-red-900/40 px-2 py-1 text-red-100">
            {session.lastActionError}
        </div>
    {/if}
</div>

<style>
    .hatch-note {
        animation: hatch-in 400ms ease-out both;
    }
    @keyframes hatch-in {
        from {
            opacity: 0;
            transform: translateY(-6px);
        }
        to {
            opacity: 1;
            transform: none;
        }
    }
</style>
