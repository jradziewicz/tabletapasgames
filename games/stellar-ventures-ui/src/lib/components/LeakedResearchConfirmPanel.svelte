<script lang="ts">
    import { CorporatePowerId, type CorporationId } from '@tabletop/stellar-ventures'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import { CorporatePowerBackImages, POWER_CARD_ASPECT } from '$lib/utils/corporatePowerImages.js'
    import CorporationBadge from './CorporationBadge.svelte'

    // Leaked Research's own confirm step (Corporate Power Glossary, page 29) - per the
    // co-designer, clicking the "Leaked Research" button anywhere it's offered (Expand Network/
    // Wormhole, Order Ships, Issue Share, Alien Tech Action) brings up the Power Tile itself
    // first rather than submitting immediately, the same "see the tile before you commit" beat
    // DeepSpaceSmugglingPanel/DeepSpacePiratesPanel use for their own reveal - just without a
    // target to pick, since Leaked Research always targets its own Corporation. Shared by all 4
    // host panels rather than duplicated, since the tile/buttons are identical in every one.
    let {
        corporationId,
        onConfirm,
        onCancel
    }: {
        corporationId: CorporationId
        onConfirm: () => void
        onCancel: () => void
    } = $props()
</script>

<div class="space-y-2 rounded-md border border-[#3a4166] bg-[#141833] p-3">
    <div class="mx-auto flex w-[10.35rem] flex-col items-center gap-2">
        <CorporationBadge {corporationId} />
        <img
            src={CorporatePowerBackImages[CorporatePowerId.LeakedResearch] ?? ''}
            alt={CorporatePowerDisplayNames[CorporatePowerId.LeakedResearch]}
            class="block w-full rounded-md shadow-lg"
            style="aspect-ratio: {POWER_CARD_ASPECT};"
        />
    </div>
    <div class="flex justify-center gap-2">
        <button
            type="button"
            onclick={onConfirm}
            class="rounded-md bg-[#2f6fed] px-4 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa]"
        >
            Activate Wormhole
        </button>
        <button
            type="button"
            onclick={onCancel}
            class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-4 py-1.5 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
        >
            Cancel
        </button>
    </div>
</div>
