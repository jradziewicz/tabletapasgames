<script lang="ts">
    import { isScoreRegion, RegionLabels, ScoringCount } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ColonyChip from './ColonyChip.svelte'

    const session = getGameSession()

    let dismissedActionId: string | undefined = $state()

    const latestScoring = $derived.by(() => {
        if (session.isViewingHistory) return undefined
        const actions = session.actions
        const last = actions.at(-1)
        const recent = actions.slice(-6).findLast((action) => isScoreRegion(action))
        if (!recent || !isScoreRegion(recent) || !recent.metadata) return undefined
        if (recent.id === dismissedActionId) return undefined
        return last?.id === recent.id || actions.slice(actions.indexOf(recent) + 1).every((action) => !action.playerId)
            ? recent
            : undefined
    })
</script>

{#if latestScoring?.metadata}
    {@const result = latestScoring.metadata}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation" onclick={() => (dismissedActionId = latestScoring.id)}>
        <div
            class="score-card w-full max-w-lg rounded-2xl border-2 border-[#c9a961] bg-[#22170e] p-6 text-[#f1e6cf] shadow-2xl"
            role="presentation"
            onclick={(event) => event.stopPropagation()}
        >
            <div class="mb-1 text-center text-xs uppercase tracking-[0.4em] text-[#c9a961]">
                Scoring {Math.min(session.gameState.scoringsDone, ScoringCount)} of {ScoringCount}
            </div>
            <div class="mb-4 text-center text-2xl font-black text-[#ffd166]">
                Region {RegionLabels[result.scoredRegion]} is dry
            </div>
            <div class="mb-3">
                <div class="mb-1 text-[11px] uppercase tracking-widest text-[#c9a961]">Vigor Points</div>
                <div class="flex flex-wrap gap-3">
                    {#each result.vigor as entry (entry.color)}
                        <span class="inline-flex items-center gap-1"
                            ><ColonyChip color={entry.color} showPlayer={false} />
                            <b class="font-mono text-[#ffd166]">+{entry.amount}</b></span
                        >
                    {/each}
                </div>
            </div>
            <div class="mb-3">
                <div class="mb-1 text-[11px] uppercase tracking-widest text-[#c9a961]">Majorities</div>
                <ul class="space-y-0.5">
                    {#each result.majorities as majority (majority.habitatId)}
                        <li class="flex items-center gap-2">
                            <span class="w-12 font-mono text-[#e0cfae]">{majority.habitatId}</span>
                            {#if majority.winner}
                                <ColonyChip color={majority.winner} showPlayer={false} />
                                {#if majority.runnerUp}
                                    <span class="text-[12px] text-[#a88d5a]">runner-up</span>
                                    <ColonyChip color={majority.runnerUp} showPlayer={false} />
                                {/if}
                            {:else}
                                <span class="text-[#a88d5a]">empty</span>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </div>
            {#if result.killed.length > 0}
                <div class="mb-3 text-[#ff9b8f]">
                    The Killing Zone claimed
                    {result.killed.map((entry) => `${entry.amount} ${entry.color}`).join(', ')}.
                </div>
            {/if}
            <div class="text-center">
                <button type="button" class="lc-btn lc-primary" onclick={() => (dismissedActionId = latestScoring.id)}
                    >Continue</button
                >
            </div>
        </div>
    </div>
{/if}

<style>
    .score-card {
        animation: score-in 450ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
    }
    @keyframes score-in {
        from {
            opacity: 0;
            transform: translateY(24px) scale(0.94);
        }
        to {
            opacity: 1;
            transform: none;
        }
    }
</style>
