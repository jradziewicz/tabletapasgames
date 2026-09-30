<script lang="ts">
    import { onMount } from 'svelte'

    let { data } = $props()

    // On success the popup just closes; the opener already got the updated user over the
    // BroadcastChannel. On failure it stays open so the person can read why.
    onMount(() => {
        if (data?.linked) {
            window.close()
        }
    })
</script>

{#if data && !data.linked}
    <div class="min-h-dvh flex items-center justify-center p-6 text-center">
        <div class="max-w-sm space-y-4">
            <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
                Couldn't link Discord
            </h1>
            <p class="text-sm text-gray-700 dark:text-gray-300">{data.error}</p>
            <button
                type="button"
                class="rounded-full bg-[#5865F2] hover:bg-[#4752C4] px-6 py-2 text-sm font-medium text-white"
                onclick={() => window.close()}
            >
                Close
            </button>
        </div>
    </div>
{/if}
