<script lang="ts">
    import { onDestroy } from 'svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    let { reportId, count }: { reportId: string; count: number } = $props()

    const { api } = getAppContext()

    type Thumbnail = { index: number; url?: string; failed?: boolean }

    // Screenshots are admin-only API responses, so they are fetched with the session and shown
    // from object URLs rather than linked to directly.
    let thumbnails = $state<Thumbnail[]>([])
    let urls: string[] = []
    let destroyed = false

    async function load(id: string, total: number) {
        // Only reads plain values before the first await, so the effect that calls this tracks
        // reportId and count alone.
        const indices = Array.from({ length: total }, (_, index) => index)
        thumbnails = indices.map((index) => ({ index }))
        await Promise.all(
            indices.map(async (index) => {
                try {
                    const blob = await api.getBugReportScreenshot(id, index)
                    if (destroyed) return
                    const url = URL.createObjectURL(blob)
                    urls.push(url)
                    thumbnails = thumbnails.map((thumbnail) =>
                        thumbnail.index === index ? { index, url } : thumbnail
                    )
                } catch (error) {
                    console.error('Could not load the bug report screenshot', error)
                    thumbnails = thumbnails.map((thumbnail) =>
                        thumbnail.index === index ? { index, failed: true } : thumbnail
                    )
                }
            })
        )
    }

    $effect(() => {
        void load(reportId, count)
    })

    onDestroy(() => {
        destroyed = true
        for (const url of urls) URL.revokeObjectURL(url)
        urls = []
    })
</script>

<div class="mt-3 flex flex-wrap gap-3">
    {#each thumbnails as thumbnail (thumbnail.index)}
        {#if thumbnail.url}
            <a
                href={thumbnail.url}
                target="_blank"
                rel="noopener"
                title="Open screenshot {thumbnail.index + 1} full size"
            >
                <img
                    src={thumbnail.url}
                    alt="Screenshot {thumbnail.index + 1}"
                    class="h-20 w-auto rounded border border-gray-300 hover:border-[#7165ad] dark:border-gray-600"
                />
            </a>
        {:else}
            <div
                class="flex h-20 w-28 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400"
            >
                {thumbnail.failed ? 'Unavailable' : 'Loading…'}
            </div>
        {/if}
    {/each}
</div>
