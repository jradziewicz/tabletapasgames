<script lang="ts">
    import { onMount } from 'svelte'
    import {
        addUtcDays,
        utcDayCount,
        utcDayOf,
        utcRangeProblem,
        type SiteStatsNow,
        type SiteStatsReport,
        type UtcDayRange
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { LatestRequest } from '$lib/utils/latestRequest'
    import {
        formatUtcDate,
        formatUtcRange,
        nowFigures,
        presetRange,
        RANGE_PRESETS,
        rangeFigures,
        slotsAreWeeks
    } from '$lib/utils/siteStats'
    import SiteStatsPanels from './stats/SiteStatsPanels.svelte'
    import StatFigures from './stats/StatFigures.svelte'

    const { api } = getAppContext()

    const yesterday = addUtcDays(utcDayOf(new Date()), -1)
    let range = $state<UtcDayRange>(presetRange(28, yesterday))
    let preset = $state<number | undefined>(28)
    let report = $state<SiteStatsReport>()
    let now = $state<SiteStatsNow>()
    let busy = $state(false)
    let error = $state('')
    let rebuildNote = $state('')
    const requests = new LatestRequest()

    const rolledThrough = $derived(report?.latest?.day)
    const daysBehind = $derived(
        rolledThrough && rolledThrough < yesterday ? utcDayCount(rolledThrough, yesterday) - 1 : 0
    )
    const computedAt = $derived(report?.latest?.computedAt)
    const startsBeforeHistory = $derived(
        report?.rolledFrom !== undefined && range.from < report.rolledFrom
    )

    async function load() {
        const request = requests.begin()
        busy = true
        error = ''
        try {
            const [loadedNow, loadedReport] = await Promise.all([
                api.getSiteStatsNow(),
                api.getSiteStatsReport(range)
            ])
            if (!request()) return
            now = loadedNow
            report = loadedReport
        } catch (failure) {
            if (request())
                error = failure instanceof Error ? failure.message : 'Could not load site stats'
        } finally {
            if (request()) busy = false
        }
    }

    function choosePreset(days: number) {
        preset = days
        range = presetRange(days, yesterday)
        void load()
    }

    function chooseDay(edge: keyof UtcDayRange, day: string) {
        const next = { ...range, [edge]: day }
        if (utcRangeProblem(next, yesterday)) return
        preset = undefined
        range = next
        void load()
    }

    async function rebuild() {
        if (!confirm('Roll up every day from the first game through yesterday?')) return
        try {
            const runId = await api.startSiteStatsRollup()
            rebuildNote = `Rebuild ${runId} started. Days fill in as it runs; press Refresh to see them.`
        } catch (failure) {
            rebuildNote = failure instanceof Error ? failure.message : 'Could not start the rebuild'
        }
    }

    onMount(() => {
        void load()
    })
</script>

<div class="site-stats" aria-busy={busy}>
    <div class="controls">
        <div class="presets" role="group" aria-label="Range">
            {#each RANGE_PRESETS as days (days)}
                <button
                    class:selected={preset === days}
                    aria-pressed={preset === days}
                    onclick={() => choosePreset(days)}
                    >{days === 365 ? '1 year' : `${days} days`}</button
                >
            {/each}
        </div>
        <label>
            From
            <input
                type="date"
                value={range.from}
                max={range.to}
                onchange={(event) => chooseDay('from', event.currentTarget.value)}
            />
        </label>
        <label>
            To
            <input
                type="date"
                value={range.to}
                min={range.from}
                max={yesterday}
                onchange={(event) => chooseDay('to', event.currentTarget.value)}
            />
        </label>
        <span class="spacer"></span>
        <button class="action" onclick={() => void load()} disabled={busy}>Refresh</button>
        <button class="action" onclick={() => void rebuild()}>Rebuild…</button>
    </div>
    <p class="status">
        Days are UTC days{slotsAreWeeks(range) ? ', shown by week' : ''}.
        {#if report?.rolledFrom && rolledThrough}
            History from {formatUtcDate(report.rolledFrom)} through {formatUtcDate(
                rolledThrough
            )}{#if computedAt}, last computed {new Date(computedAt).toLocaleString()}{/if}.
            {#if daysBehind > 0}<strong
                    >Behind by {daysBehind}
                    {daysBehind === 1 ? 'day' : 'days'}.</strong
                >{/if}
        {:else if report}
            <strong>Nothing has been rolled up yet. Use Rebuild to fill in history.</strong>
        {/if}
    </p>
    {#if rebuildNote}<p class="status">{rebuildNote}</p>{/if}
    {#if error}<p role="alert" class="error">{error}</p>{/if}

    {#if now}
        <h2>Right now</h2>
        <StatFigures figures={nowFigures(now)} />
    {/if}

    {#if report && now}
        <h2>
            {formatUtcRange(range)}{#if startsBeforeHistory && report.rolledFrom}
                · history starts {formatUtcDate(report.rolledFrom)}{/if}
        </h2>
        <StatFigures figures={rangeFigures(report)} />
        <SiteStatsPanels {report} {now} />
        <p class="footnote">
            Range figures leave out hotseat, forked and exploration games, and games since deleted.
            "Right now" counts every game. Undone actions are not counted.
        </p>
    {/if}
</div>

<style>
    /* The panels were drawn for a dark page; these tokens keep them readable in light mode too.
       --stats-gray-N is the dark-mode gray-N, mirrored on the gray scale in light mode. */
    .site-stats {
        --stats-gray-100: var(--color-gray-900);
        --stats-gray-200: var(--color-gray-800);
        --stats-gray-300: var(--color-gray-700);
        --stats-gray-400: var(--color-gray-600);
        --stats-gray-500: var(--color-gray-500);
        --stats-gray-600: var(--color-gray-400);
        --stats-gray-700: var(--color-gray-300);
        --stats-gray-800: var(--color-gray-100);
        --stats-gray-900: var(--color-gray-50);
        --stats-warning: var(--color-amber-700);
        --stats-error: var(--color-red-600);
        --stats-line: var(--color-gray-200);
        --stats-panel: var(--color-gray-50);
        --stats-scheme: light;
        color: var(--stats-gray-100);
    }
    :global(.dark) .site-stats {
        --stats-gray-100: var(--color-gray-100);
        --stats-gray-200: var(--color-gray-200);
        --stats-gray-300: var(--color-gray-300);
        --stats-gray-400: var(--color-gray-400);
        --stats-gray-500: var(--color-gray-500);
        --stats-gray-600: var(--color-gray-600);
        --stats-gray-700: var(--color-gray-700);
        --stats-gray-800: var(--color-gray-800);
        --stats-gray-900: var(--color-gray-900);
        --stats-warning: var(--color-amber-300);
        --stats-error: var(--color-red-300);
        --stats-line: rgb(54 65 83 / 0.6);
        --stats-panel: rgb(30 41 57 / 0.5);
        --stats-scheme: dark;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
    }
    .presets {
        display: inline-flex;
        border: 1px solid var(--stats-gray-700);
        border-radius: 8px;
        overflow: hidden;
    }
    .presets button {
        padding: 5px 12px;
        font-size: 13px;
        color: var(--stats-gray-300);
    }
    .presets button + button {
        border-left: 1px solid var(--stats-gray-700);
    }
    .presets button.selected {
        background: var(--stats-gray-700);
        color: var(--stats-gray-100);
    }
    label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--stats-gray-400);
    }
    input[type='date'] {
        border: 1px solid var(--stats-gray-700);
        border-radius: 6px;
        background: var(--stats-gray-800);
        color: var(--stats-gray-100);
        padding: 4px 8px;
        font-size: 13px;
        color-scheme: var(--stats-scheme);
    }
    .spacer {
        flex: 1;
    }
    .action {
        border: 1px solid var(--stats-gray-700);
        border-radius: 8px;
        padding: 5px 12px;
        font-size: 13px;
        color: var(--stats-gray-200);
    }
    .action:hover {
        background: var(--stats-gray-800);
    }
    .action:disabled {
        opacity: 0.5;
    }
    .status {
        margin-top: 10px;
        font-size: 13px;
        color: var(--stats-gray-400);
    }
    .status strong {
        font-weight: 500;
        color: var(--stats-warning);
    }
    .error {
        margin-top: 10px;
        font-size: 14px;
        color: var(--stats-error);
    }
    h2 {
        margin: 26px 0 12px;
        font-size: 13px;
        font-weight: 500;
        color: var(--stats-gray-400);
    }
    .footnote {
        margin-top: 12px;
        font-size: 12px;
        color: var(--stats-gray-500);
    }
</style>
