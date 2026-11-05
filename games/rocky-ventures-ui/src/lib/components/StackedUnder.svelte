<script lang="ts">
    // The card underneath a stack: only its banner and top action show above the card on top.
    let {
        underUrl,
        class: className = '',
        imageClass = ''
    }: { underUrl: string | undefined; class?: string; imageClass?: string } = $props()
</script>

{#if underUrl}
    <div class="block overflow-hidden {className}">
        <img src={underUrl} alt="" class="block max-w-none {imageClass}" draggable="false" />
    </div>
{/if}
