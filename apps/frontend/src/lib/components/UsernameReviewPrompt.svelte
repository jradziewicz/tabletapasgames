<script lang="ts">
    // Shown under a username the filter refused: "Think this is a mistake? Let us know." sends
    // the name to the Admin page's Username reviews tab for a person to look at.
    import { getAppContext } from '@tabletop/frontend-components'

    let { username }: { username: string } = $props()
    const { api } = getAppContext()

    let state = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle')

    async function send() {
        state = 'sending'
        try {
            await api.requestUsernameReview({ username })
            state = 'sent'
        } catch {
            state = 'failed'
        }
    }
</script>

<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
    {#if state === 'sent'}
        Thanks, we'll take a look. You can pick another name in the meantime.
    {:else}
        Think this is a mistake?
        <button
            type="button"
            class="font-medium text-[#7165ad] underline hover:text-[#5b4f95] disabled:opacity-50 dark:text-[#a99ee0]"
            disabled={state === 'sending'}
            onclick={send}>Let us know.</button
        >
        {#if state === 'failed'}
            <span class="text-red-600 dark:text-red-300">That didn't send. Please try again.</span>
        {/if}
    {/if}
</p>
