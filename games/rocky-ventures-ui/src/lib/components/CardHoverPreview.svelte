<script lang="ts">
    let { imageUrl, alt }: { imageUrl: string; alt: string } = $props()
</script>

<!-- Read-only preview: pointer-events none so it never steals hover from the card underneath -->
<div class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center" aria-hidden="true">
    {#key imageUrl}
        <img src={imageUrl} {alt} class="card-hover-preview rounded-xl shadow-2xl border-2 border-[#c9a961]" draggable="false" />
    {/key}
</div>

<style>
    .card-hover-preview {
        max-height: min(80vh, 820px);
        max-width: 90vw;
        width: auto;
        height: auto;
        animation: preview-in 140ms ease-out both;
    }
    @keyframes preview-in {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>
