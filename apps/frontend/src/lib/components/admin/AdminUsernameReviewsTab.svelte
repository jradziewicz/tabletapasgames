<script lang="ts">
    import { UsernameReviewStatus, type UsernameReview } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    const { api } = getAppContext()

    let showResolved = $state(false)
    let reviews = $state<UsernameReview[]>([])
    let busy = $state(false)
    let error = $state('')
    let updating = $state<string | undefined>()
    let request = 0

    const dateFormat = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    })

    async function load(includeResolved: boolean) {
        const current = ++request
        busy = true
        error = ''
        try {
            const results = await api.getUsernameReviews(
                includeResolved ? undefined : UsernameReviewStatus.Open
            )
            if (current !== request) return
            reviews = results
        } catch (failure) {
            if (current === request)
                error = failure instanceof Error ? failure.message : 'Could not load username reviews'
        } finally {
            if (current === request) busy = false
        }
    }

    $effect(() => {
        void load(showResolved)
    })

    async function setStatus(review: UsernameReview, status: UsernameReviewStatus) {
        updating = review.id
        error = ''
        try {
            const updated = await api.setUsernameReviewStatus(review.id, status)
            reviews =
                status !== UsernameReviewStatus.Open && !showResolved
                    ? reviews.filter((other) => other.id !== review.id)
                    : reviews.map((other) => (other.id === review.id ? updated : other))
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not update the review'
        } finally {
            updating = undefined
        }
    }

    const statusLabel: Record<UsernameReviewStatus, string> = {
        [UsernameReviewStatus.Open]: 'Open',
        [UsernameReviewStatus.Approved]: 'Approved',
        [UsernameReviewStatus.Dismissed]: 'Dismissed'
    }
</script>

<p class="text-sm text-gray-600 dark:text-gray-300">
    Usernames the offensive-language filter blocked, sent in by people who think it got it wrong.
    Approving one lets that exact name through from then on.
</p>
<label class="mt-3 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
    <input
        type="checkbox"
        bind:checked={showResolved}
        class="rounded border-gray-300 text-[#7165ad] focus:ring-[#7165ad] dark:border-gray-600 dark:bg-gray-800"
    />
    Show approved and dismissed
</label>
{#if error}<p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>{/if}
<div class="mt-5" aria-busy={busy}>
    {#if busy && !reviews.length}
        <p class="text-sm text-gray-500 dark:text-gray-400" role="status">Loading…</p>
    {:else if !reviews.length && !error}
        <p class="text-sm text-gray-500 dark:text-gray-400">
            {showResolved ? 'No username reviews yet.' : 'No open username reviews.'}
        </p>
    {:else}
        <ul class="flex flex-col gap-3">
            {#each reviews as review (review.id)}
                <li
                    class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                >
                    <div class="min-w-0">
                        <p class="break-all text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {review.username}
                        </p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            {review.requesterEmail ?? 'Signed-out visitor'} · {dateFormat.format(
                                review.createdAt
                            )} · {statusLabel[review.status]}
                        </p>
                        {#if review.note}
                            <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{review.note}</p>
                        {/if}
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        {#if review.status !== UsernameReviewStatus.Approved}
                            <button
                                type="button"
                                disabled={updating === review.id}
                                onclick={() => setStatus(review, UsernameReviewStatus.Approved)}
                                class="rounded-md bg-[#7165ad] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5b4f95] disabled:opacity-50"
                                >Approve</button
                            >
                        {/if}
                        {#if review.status !== UsernameReviewStatus.Dismissed}
                            <button
                                type="button"
                                disabled={updating === review.id}
                                onclick={() => setStatus(review, UsernameReviewStatus.Dismissed)}
                                class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                >Dismiss</button
                            >
                        {/if}
                    </div>
                </li>
            {/each}
        </ul>
    {/if}
</div>
