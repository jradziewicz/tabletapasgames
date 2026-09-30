<script lang="ts">
    import { AddedBlockedUpFrom, BoardArtSize, PrintedBlockedUpFrom, RemovedGemCells } from '@tabletop/rocky-ventures'
    import { GridCellSize, gridCellPosition } from '$lib/utils/trackLayout.js'

    let { artUrl, idPrefix }: { artUrl: string; idPrefix: string } = $props()

    const WallThickness = 6
    const WallClipHeight = 14
    const PatchInset = 2
</script>

{#each RemovedGemCells as cell, index (`${cell.weapon},${cell.tool}`)}
    {@const center = gridCellPosition(cell.weapon, cell.tool)}
    {@const sourceTool = cell.tool > 1 ? cell.tool - 1 : cell.tool + 1}
    {@const shift = (cell.tool - sourceTool) * GridCellSize.width}
    <clipPath id="{idPrefix}-grid-patch-{index}">
        <rect
            x={center.x - GridCellSize.width / 2 + PatchInset}
            y={center.y - GridCellSize.height / 2 + PatchInset}
            width={GridCellSize.width - PatchInset * 2}
            height={GridCellSize.height - PatchInset * 2}
        />
    </clipPath>
    <image
        href={artUrl}
        x={shift}
        y="0"
        width={BoardArtSize.width}
        height={BoardArtSize.height}
        clip-path="url(#{idPrefix}-grid-patch-{index})"
        pointer-events="none"
    />
{/each}

{#each AddedBlockedUpFrom as cell, index (`${cell.weapon},${cell.tool}`)}
    {@const center = gridCellPosition(cell.weapon, cell.tool)}
    {@const source = PrintedBlockedUpFrom.find((printed) => printed.weapon === cell.weapon)}
    {#if source}
        <clipPath id="{idPrefix}-grid-wall-{index}">
            <rect
                x={center.x - GridCellSize.width / 2}
                y={center.y - GridCellSize.height / 2 - WallClipHeight / 2}
                width={GridCellSize.width}
                height={WallClipHeight}
            />
        </clipPath>
        <image
            href={artUrl}
            x={(cell.tool - source.tool) * GridCellSize.width}
            y="0"
            width={BoardArtSize.width}
            height={BoardArtSize.height}
            clip-path="url(#{idPrefix}-grid-wall-{index})"
            pointer-events="none"
        />
    {:else}
        <rect
            x={center.x - GridCellSize.width / 2}
            y={center.y - GridCellSize.height / 2 - WallThickness / 2}
            width={GridCellSize.width}
            height={WallThickness}
            rx="1.5"
            fill="#d8d3b8"
            stroke="#3d3a2c"
            stroke-width="1.2"
            pointer-events="none"
        />
    {/if}
{/each}
