<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { ActionKind, InsectKind, InsectKinds, MachineState, isOpponent, requiredVictims } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { JumpOrBreedMode } from '$lib/model/session.svelte.js'
    import { describePendingAction } from '$lib/utils/describe.js'
    import { PlayerName } from '@tabletop/frontend-components'
    import ColonyChip from './ColonyChip.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const pending = $derived(session.pendingAction)
    const actingColony = $derived(session.actingColor ? state.colony(session.actingColor) : undefined)
    const hatchMax = $derived(pending && actingColony ? Math.min(pending.level, actingColony.dead) : 0)

    const KindLabels: Record<InsectKind, string> = {
        [InsectKind.Grasshopper]: 'grasshopper',
        [InsectKind.Locust]: 'locust',
        [InsectKind.Nymph]: 'nymph'
    }

    function chosenVictims(habitatId: string, color: Color, kind: InsectKind) {
        const attack = session.attacks.find((candidate) => candidate.habitatId === habitatId)
        return attack?.victims.find((victim) => victim.color === color && victim.kind === kind)?.count ?? 0
    }

    const buttonClass =
        'rounded-md px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40'
    const primaryClass = `${buttonClass} bg-[#7165ad] text-white hover:bg-[#5b4f95]`
    const secondaryClass = `${buttonClass} border border-[#a99f8c] text-[#f3ead6] hover:bg-white/10`
</script>

<div class="flex flex-col gap-2 border-b border-[#5a4c38] bg-[#2b2418] px-4 py-3 text-sm text-[#f3ead6]">
    {#if state.result && !session.isViewingHistory}
        <div class="flex flex-wrap items-center gap-2 text-base">
            <span class="font-semibold">{state.result === 'Draw' ? 'Shared victory:' : 'Winner:'}</span>
            {#each state.winningPlayerIds as playerId (playerId)}
                <PlayerName {playerId} additionalClasses="font-semibold" />
                <span>({state.getPlayerState(playerId).score} pts)</span>
            {/each}
        </div>
    {:else if session.isViewingHistory}
        <span class="opacity-70">Viewing history</span>
    {:else if !session.canAct}
        <span class="opacity-80">Waiting for the other players…</span>
    {:else if state.machineState === MachineState.ChooseSpace}
        <div>Move your highlighted cube to any empty action space right of the Active Region.</div>
        {#if state.isAlternativeActionAvailable()}
            <label class="inline-flex items-center gap-2">
                <input type="checkbox" bind:checked={session.useAlternative} class="rounded" />
                <span>Alternative Action: take JUMP/BREED level 1 of any colour instead of the space's action</span>
            </label>
        {/if}
    {:else if state.machineState === MachineState.PerformAction && pending}
        <div class="font-semibold">{describePendingAction(pending)}</div>
        {#if pending.kind === ActionKind.JumpOrBreed}
            <div class="flex gap-2">
                {#each [JumpOrBreedMode.Jump, JumpOrBreedMode.Breed] as mode}
                    <button
                        type="button"
                        class={session.jumpOrBreedMode === mode ? primaryClass : secondaryClass}
                        onclick={() => session.setJumpOrBreedMode(mode)}>{mode === JumpOrBreedMode.Jump ? 'Jump' : 'Breed'}</button
                    >
                {/each}
            </div>
            {#if session.jumpOrBreedMode === JumpOrBreedMode.Jump}
                <div>
                    {session.hopOrigin
                        ? 'Click a linked habitat to jump to (click the grasshopper again to cancel).'
                        : 'Click a habitat with one of your grasshoppers to jump from.'}
                    Jumps used: {session.hops.length}/{pending.level}
                </div>
            {:else}
                <div>
                    Click habitats to add a nymph ({session.breedHabitatIds.length}/{Math.min(
                        pending.level,
                        actingColony?.supply ?? 0
                    )}).
                </div>
            {/if}
        {:else if pending.kind === ActionKind.Hatch}
            <div class="flex flex-wrap items-center gap-2">
                <span>Discs to hatch:</span>
                {#each Array.from({ length: hatchMax + 1 }, (_, count) => count) as count}
                    <button
                        type="button"
                        class={session.hatchCount === count ? primaryClass : secondaryClass}
                        onclick={() => session.setHatchCount(count)}>{count}</button
                    >
                {/each}
            </div>
        {:else if pending.kind === ActionKind.Cannibalize}
            <div>Click up to {pending.level} habitat{pending.level > 1 ? 's' : ''} where you have locusts.</div>
            {#each session.attacks as attack (attack.habitatId)}
                {@const occupants = state.board
                    .habitat(attack.habitatId)
                    .occupants.filter((occupant) => session.actingColor && isOpponent(state, session.actingColor, occupant.color))}
                <div class="rounded border border-[#5a4c38] p-2">
                    <div class="mb-1">
                        {attack.habitatId}: remove {session.actingColor
                            ? requiredVictims(state, session.actingColor, attack.habitatId)
                            : 0}
                    </div>
                    {#each occupants as occupant (occupant.color)}
                        <div class="flex flex-wrap items-center gap-2">
                            <ColonyChip color={occupant.color} showPlayer={false} />
                            {#each InsectKinds.filter((kind) => occupant[kind] > 0) as kind}
                                <span class="inline-flex items-center gap-1">
                                    <button
                                        type="button"
                                        class="px-1"
                                        onclick={() => session.adjustVictim(attack.habitatId, occupant.color, kind, -1)}
                                        >−</button
                                    >
                                    {chosenVictims(attack.habitatId, occupant.color, kind)}/{occupant[kind]}
                                    {KindLabels[kind]}
                                    <button
                                        type="button"
                                        class="px-1"
                                        onclick={() => session.adjustVictim(attack.habitatId, occupant.color, kind, 1)}
                                        >+</button
                                    >
                                </span>
                            {/each}
                        </div>
                    {/each}
                </div>
            {/each}
        {:else if pending.kind === ActionKind.Swarm}
            <div>Click up to {pending.level} crowded habitat{pending.level > 1 ? 's' : ''} in the Swarming Zone.</div>
        {/if}
        {#if session.draftError && session.hasManualSelection}
            <div class="text-[#ff9b8f]">{session.draftError}</div>
        {/if}
        <div class="flex gap-2">
            <button
                type="button"
                class={primaryClass}
                disabled={!session.hasManualSelection || session.draftError !== undefined || session.hopOrigin !== undefined}
                onclick={() => session.confirmAction()}>Confirm</button
            >
            <button
                type="button"
                class={secondaryClass}
                disabled={!session.hasManualSelection}
                onclick={() => session.clearLocalSelection()}>Clear</button
            >
            <button type="button" class={secondaryClass} onclick={() => session.doNothing()}>Do nothing</button>
        </div>
    {:else if state.machineState === MachineState.RelocateLocusts && state.swarm}
        <div>
            Move {session.requiredRelocationCount} locust{session.requiredRelocationCount === 1 ? '' : 's'} out of
            {state.swarm.habitatId}: click uncrowded habitats ({session.relocationDestinations.length}/{session.requiredRelocationCount}).
            Locusts that cannot move die.
        </div>
        <div class="flex gap-2">
            <button
                type="button"
                class={primaryClass}
                disabled={session.draftError !== undefined}
                onclick={() => session.confirmRelocation()}>Confirm</button
            >
            <button
                type="button"
                class={secondaryClass}
                disabled={!session.hasManualSelection}
                onclick={() => session.clearLocalSelection()}>Clear</button
            >
        </div>
    {:else if state.machineState === MachineState.AssignDuelScoring}
        <div>Pick the colour whose Vigor Points count. Your other colour scores its Bonus Points.</div>
        <div class="flex gap-2">
            {#each state.colonies.filter((colony) => colony.playerId === state.activePlayerIds[0]) as colony (colony.color)}
                <button type="button" class={secondaryClass} onclick={() => session.assignVigorColor(colony.color)}>
                    <ColonyChip color={colony.color} showPlayer={false} />
                    · {colony.vigor} VP
                </button>
            {/each}
        </div>
    {/if}
    {#if session.lastActionError}
        <div class="text-[#ff9b8f]">{session.lastActionError}</div>
    {/if}
</div>
