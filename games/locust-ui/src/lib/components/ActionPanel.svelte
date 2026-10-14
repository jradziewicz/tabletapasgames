<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionKind,
        InsectKind,
        InsectKinds,
        MachineState,
        isOpponent,
        isPlaceCube,
        requiredVictims
    } from '@tabletop/locust'
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

    function chosenVictims(habitatId: string, color: Color, kind: InsectKind) {
        const attack = session.attacks.find((candidate) => candidate.habitatId === habitatId)
        return (
            attack?.victims.find((victim) => victim.color === color && victim.kind === kind)
                ?.count ?? 0
        )
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

    const canConfirm = $derived(
        session.hasManualSelection &&
            session.draftError === undefined &&
            session.hopOrigin === undefined
    )
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
            <span class="text-[11px] uppercase tracking-[0.3em] text-[#c9a961]"
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
                        {ActionNames[pending.kind].toUpperCase()}
                        <span class="text-[#c9a961]">· LEVEL {pending.level}</span>
                        {#if pending.alternative}
                            <span class="text-[#ffd166]">· ALTERNATIVE (any colour)</span>
                        {:else if pending.color}
                            <span class="capitalize text-[#c9a961]">· {pending.color}</span>
                        {/if}
                    </div>
                    <div class="text-[12px] text-[#a88d5a]">{ActionBlurbs[pending.kind]}</div>
                </div>

                {#if pending.kind === ActionKind.JumpOrBreed}
                    <div class="flex flex-wrap items-center gap-2">
                        {#each [JumpOrBreedMode.Jump, JumpOrBreedMode.Breed] as mode (mode)}
                            <button
                                type="button"
                                class="lc-btn {session.jumpOrBreedMode === mode
                                    ? 'lc-selected'
                                    : ''} text-[13px]"
                                onclick={() => session.setJumpOrBreedMode(mode)}
                                >{mode === JumpOrBreedMode.Jump ? 'Jump' : 'Breed'}</button
                            >
                        {/each}
                        <span class="text-[#e0cfae]">
                            {#if session.jumpOrBreedMode === JumpOrBreedMode.Jump}
                                {session.hopOrigin
                                    ? 'Now click a linked habitat (click the same habitat to cancel).'
                                    : 'Click a highlighted habitat to pick up a grasshopper.'}
                                <span class="font-mono text-[#ffd166]"
                                    >{session.hops.length}/{pending.level}</span
                                >
                                jumps
                            {:else}
                                Click highlighted habitats to lay nymphs
                                <span class="font-mono text-[#ffd166]"
                                    >{session.breedHabitatIds.length}/{breedLimit}</span
                                >
                            {/if}
                        </span>
                    </div>
                {:else if pending.kind === ActionKind.Cannibalize}
                    <div class="text-[#e0cfae]">
                        Click up to <span class="font-mono text-[#ffd166]">{pending.level}</span>
                        habitat{pending.level > 1 ? 's' : ''} where you have locusts. Adjust the victims
                        below if you like.
                    </div>
                    <div class="flex flex-wrap gap-2">
                        {#each session.attacks as attack (attack.habitatId)}
                            {@const occupants = state.board
                                .habitat(attack.habitatId)
                                .occupants.filter(
                                    (occupant) =>
                                        session.actingColor !== undefined &&
                                        isOpponent(state, session.actingColor, occupant.color)
                                )}
                            <div class="rounded-lg border border-[#4a3620] bg-black/20 px-3 py-2">
                                <div
                                    class="mb-1 text-[11px] uppercase tracking-widest text-[#c9a961]"
                                >
                                    {attack.habitatId} · eat {session.actingColor
                                        ? requiredVictims(
                                              state,
                                              session.actingColor,
                                              attack.habitatId
                                          )
                                        : 0}
                                </div>
                                {#each occupants as occupant (occupant.color)}
                                    <div class="flex flex-wrap items-center gap-2 py-0.5">
                                        <ColonyChip color={occupant.color} showPlayer={false} />
                                        {#each InsectKinds.filter((kind) => occupant[kind] > 0) as kind (kind)}
                                            <span
                                                class="inline-flex items-center gap-1 rounded border border-[#4a3620] px-1"
                                            >
                                                <button
                                                    type="button"
                                                    class="px-1 text-[#c9a961] hover:text-white"
                                                    aria-label="Spare one {KindLabels[kind]}"
                                                    onclick={() =>
                                                        session.adjustVictim(
                                                            attack.habitatId,
                                                            occupant.color,
                                                            kind,
                                                            -1
                                                        )}>−</button
                                                >
                                                <span class="font-mono"
                                                    >{chosenVictims(
                                                        attack.habitatId,
                                                        occupant.color,
                                                        kind
                                                    )}/{occupant[kind]}</span
                                                >
                                                <span class="text-[12px]">{KindLabels[kind]}</span>
                                                <button
                                                    type="button"
                                                    class="px-1 text-[#c9a961] hover:text-white"
                                                    aria-label="Eat one more {KindLabels[kind]}"
                                                    onclick={() =>
                                                        session.adjustVictim(
                                                            attack.habitatId,
                                                            occupant.color,
                                                            kind,
                                                            1
                                                        )}>+</button
                                                >
                                            </span>
                                        {/each}
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    </div>
                {:else if pending.kind === ActionKind.Swarm}
                    <div class="text-[#e0cfae]">
                        Click up to <span class="font-mono text-[#ffd166]">{pending.level}</span>
                        crowded habitat{pending.level > 1 ? 's' : ''} in the Swarming Zone (red counters).
                    </div>
                {/if}

                {#if session.draftError && session.hasManualSelection}
                    <div
                        class="rounded border border-red-500/70 bg-red-900/40 px-2 py-1 text-red-100"
                    >
                        {session.draftError}
                    </div>
                {/if}
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="lc-btn {pending.kind === ActionKind.Swarm
                            ? 'lc-swarm'
                            : 'lc-primary'}"
                        disabled={!canConfirm}
                        onclick={() => session.confirmAction()}>Confirm</button
                    >
                    <button
                        type="button"
                        class="lc-quiet"
                        disabled={!session.hasManualSelection}
                        onclick={() => session.clearLocalSelection()}>Clear</button
                    >
                    <button type="button" class="lc-quiet" onclick={() => session.doNothing()}
                        >Do nothing</button
                    >
                </div>
            </div>
        </div>
    {:else if state.machineState === MachineState.RelocateLocusts && state.swarm}
        <div class="space-y-2">
            <div>
                <span class="font-semibold text-[#e7b3f5]">SWARM!</span>
                Fly <span class="font-mono text-[#ffd166]">{session.requiredRelocationCount}</span>
                locust{session.requiredRelocationCount === 1 ? '' : 's'} out of {state.swarm
                    .habitatId} to any uncrowded habitat on the board
                <span class="font-mono text-[#ffd166]"
                    >({session.relocationDestinations
                        .length}/{session.requiredRelocationCount})</span
                >. Locusts with nowhere to land die.
            </div>
            <div class="flex gap-2">
                <button
                    type="button"
                    class="lc-btn lc-swarm"
                    disabled={session.draftError !== undefined}
                    onclick={() => session.confirmRelocation()}>Confirm</button
                >
                <button
                    type="button"
                    class="lc-quiet"
                    disabled={!session.hasManualSelection}
                    onclick={() => session.clearLocalSelection()}>Clear</button
                >
            </div>
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
