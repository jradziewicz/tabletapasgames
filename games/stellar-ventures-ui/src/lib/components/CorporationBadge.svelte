<script lang="ts">
    import { type CorporationId } from '@tabletop/stellar-ventures'
    import {
        CorporationDisplayNames,
        CorporationLogoIcons,
        CorporationLogoAspect
    } from '$lib/utils/corporationDisplay.js'

    // A small "which Corporation is this?" identifier - logo + name in a bordered card, the
    // same header-row treatment CorporationInfoBox gives its own name/logo but without any of
    // its stats (Treasury, Mining Capacity, etc.). For panels that only need to say WHO a
    // one-time Power decision belongs to (DeepSpaceSmugglingPanel, FinePrintPanel, and other
    // future Power-trigger panels showing that Power's own tile art) - not show its live
    // numbers, which is what the fuller CorporationInfoBox is for.
    let { corporationId }: { corporationId: CorporationId } = $props()

    const logoAspect = $derived(CorporationLogoAspect[corporationId] ?? 1)
</script>

<div
    class="flex items-center justify-center gap-2 rounded-lg border border-[#2a3155] bg-[#12162b] px-3 py-2"
>
    <img
        src={CorporationLogoIcons[corporationId]}
        alt=""
        class="h-8 shrink-0 drop-shadow"
        style="width: {32 * logoAspect}px;"
    />
    <div class="text-sm font-semibold text-[#e6e9f5]">
        {CorporationDisplayNames[corporationId]}
    </div>
</div>
