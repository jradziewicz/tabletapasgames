<script lang="ts">
    import {
        BugReportStatus,
        bugReportVersionsLabel,
        bugReportViewLabel,
        type BugReport
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    const { api } = getAppContext()

    let showClosed = $state(false)
    let reports = $state<BugReport[]>([])
    let busy = $state(false)
    let error = $state('')
    let updating = $state<string | undefined>()
    let request = 0

    const dateFormat = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    })

    async function load(includeClosed: boolean) {
        const current = ++request
        busy = true
        error = ''
        try {
            const results = await api.getBugReports(
                includeClosed ? undefined : BugReportStatus.Open
            )
            if (current !== request) return
            reports = results
        } catch (failure) {
            if (current === request)
                error = failure instanceof Error ? failure.message : 'Could not load bug reports'
        } finally {
            if (current === request) busy = false
        }
    }

    $effect(() => {
        void load(showClosed)
    })

    async function setStatus(report: BugReport, status: BugReportStatus) {
        updating = report.id
        error = ''
        try {
            const updated = await api.setBugReportStatus(report.id, status)
            reports =
                status === BugReportStatus.Closed && !showClosed
                    ? reports.filter((other) => other.id !== report.id)
                    : reports.map((other) => (other.id === report.id ? updated : other))
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not update the bug report'
        } finally {
            updating = undefined
        }
    }

    function details(report: BugReport): { label: string; value: string }[] {
        const { context } = report
        return [
            { label: 'Seat', value: context.seat ?? 'Unknown' },
            { label: 'Game status', value: context.gameStatus },
            { label: 'Actions', value: context.liveActionCount?.toString() ?? 'Not started' },
            {
                label: 'Viewing',
                value: bugReportViewLabel(context.view, context.liveActionCount)
            },
            {
                label: 'Active players',
                value: context.activePlayers.length ? context.activePlayers.join(', ') : 'None'
            },
            { label: 'Versions', value: bugReportVersionsLabel(context.versions) },
            {
                label: 'Client',
                value: `${context.client.userAgent} · ${context.client.viewport}${
                    context.client.installedApp ? ' · installed app' : ''
                }`
            }
        ]
    }
</script>

<label class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
    <input
        type="checkbox"
        bind:checked={showClosed}
        class="rounded border-gray-300 text-[#7165ad] focus:ring-[#7165ad] dark:border-gray-600 dark:bg-gray-800"
    />
    Show closed reports
</label>
{#if error}<p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>{/if}
<div class="mt-5" aria-busy={busy}>
    {#if busy && !reports.length}
        <div class="flex justify-center py-10" role="status">
            <span class="sr-only">Loading bug reports</span>
            <span
                aria-hidden="true"
                class="size-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-700 dark:border-t-gray-400 motion-reduce:animate-none"
            ></span>
        </div>
    {:else if !reports.length && !error}
        <p class="text-sm text-gray-500 dark:text-gray-400">
            {showClosed ? 'No bug reports yet.' : 'No open bug reports.'}
        </p>
    {:else}
        <ul class="flex flex-col gap-3">
            {#each reports as report (report.id)}
                <li
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                >
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div class="min-w-0">
                            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {report.titleName} · {report.gameName}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                {report.reporterName} · {dateFormat.format(report.createdAt)}
                                {#if report.status === BugReportStatus.Closed}
                                    · Closed{report.closedBy ? ` by ${report.closedBy}` : ''}{report.closedAt
                                        ? ` ${dateFormat.format(report.closedAt)}`
                                        : ''}
                                {/if}
                            </p>
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                            <a
                                href={`/game/${encodeURIComponent(report.gameId)}?admin=1`}
                                class="rounded-md bg-[#7165ad] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5b4f95]"
                                >Open game</a
                            >
                            {#if report.status === BugReportStatus.Open}
                                <button
                                    type="button"
                                    disabled={updating === report.id}
                                    onclick={() => setStatus(report, BugReportStatus.Closed)}
                                    class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >Close</button
                                >
                            {:else}
                                <button
                                    type="button"
                                    disabled={updating === report.id}
                                    onclick={() => setStatus(report, BugReportStatus.Open)}
                                    class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >Reopen</button
                                >
                            {/if}
                        </div>
                    </div>
                    <p
                        class="mt-3 whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-200"
                    >
                        {report.description}
                    </p>
                    <details class="mt-3 text-xs text-gray-600 dark:text-gray-400">
                        <summary class="cursor-pointer select-none">Details</summary>
                        <dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
                            {#each details(report) as detail (detail.label)}
                                <dt class="text-gray-500 dark:text-gray-400">{detail.label}</dt>
                                <dd class="break-words text-gray-800 dark:text-gray-200">
                                    {detail.value}
                                </dd>
                            {/each}
                        </dl>
                    </details>
                </li>
            {/each}
        </ul>
    {/if}
</div>
