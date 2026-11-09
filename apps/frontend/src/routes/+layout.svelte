<script lang="ts">
    import RunOnceMounted from '$lib/components/RunOnceMounted.svelte'
    import { setAppContext } from '@tabletop/frontend-components'
    import { Toaster } from 'svelte-sonner'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { page } from '$app/state'
    import { canonicalUrl, isIndexablePath } from '$lib/utils/seo'

    let { children } = $props()
    setAppContext(getAppContext())
</script>

<svelte:head>
    {#if isIndexablePath(page.url.pathname)}
        <link rel="canonical" href={canonicalUrl(page.url.pathname)} />
    {:else}
        <meta name="robots" content="noindex" />
    {/if}
</svelte:head>

<Toaster position="top-center" richColors closeButton />
{@render children()}
<RunOnceMounted />
