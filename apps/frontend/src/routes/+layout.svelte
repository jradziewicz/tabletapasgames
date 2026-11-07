<script lang="ts">
    import RunOnceMounted from '$lib/components/RunOnceMounted.svelte'
    import { setAppContext } from '@tabletop/frontend-components'
    import { Toaster } from 'svelte-sonner'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { page } from '$app/state'
    import { afterNavigate } from '$app/navigation'
    import { onMount } from 'svelte'
    import { env } from '$env/dynamic/public'
    import { canonicalUrl, isIndexablePath } from '$lib/utils/seo'
    import { initMetaPixel, trackMetaPageView } from '$lib/services/metaPixel'

    let { children } = $props()
    setAppContext(getAppContext())

    // Meta Pixel: no-op unless PUBLIC_META_PIXEL_ID is set at build time and
    // we're on a real host (see metaPixel.ts for the host rules).
    onMount(() => {
        initMetaPixel(env.PUBLIC_META_PIXEL_ID)
    })

    // SPA: fire PageView on every client-side navigation, including the first.
    afterNavigate(() => {
        trackMetaPageView()
    })
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
