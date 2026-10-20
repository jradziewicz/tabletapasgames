<script lang="ts">
    import {
        AddedBlockedUpFrom,
        BoardArtSize,
        PrintedBlockedUpFrom,
        RemovedBlockedRightFrom,
        RemovedBlockedUpFrom,
        RemovedGemCells
    } from '@tabletop/rocky-ventures'
    import { GridCellSize, gridCellPosition } from '$lib/utils/trackLayout.js'

    let { artUrl, idPrefix }: { artUrl: string; idPrefix: string } = $props()

    const WallThickness = 6
    const WallClipHeight = 14
    const PatchInset = 2
    // How far a printed wall (with its outline and shadow) reaches either side of its grid line,
    // in art units, measured on the board art. Above/left of the line, then below/right.
    const UpWallReach = { before: 9, after: 7, left: 4, right: 4 }
    const RightWallReach = { before: 11, after: 6, top: 4, bottom: 4 }
    // Column whose stretch of the same grid line (no wall or gem ring beside it) is copied over a
    // removed "up" wall, by cell; otherwise the next column along.
    const UpWallPatchSourceTool: Record<string, number> = { '2,7': 2 }
</script>

<!-- Removed walls: cover each with the same grid line copied from a neighbouring cell. -->
{#each RemovedBlockedUpFrom as cell, index (`${cell.weapon},${cell.tool}`)}
    {@const center = gridCellPosition(cell.weapon, cell.tool)}
    {@const lineY = center.y - GridCellSize.height / 2}
    {@const sourceTool = UpWallPatchSourceTool[`${cell.weapon},${cell.tool}`] ?? (cell.tool < 8 ? cell.tool + 1 : cell.tool - 1)}
    <clipPath id="{idPrefix}-grid-unwall-up-{index}">
        <rect
            x={center.x - GridCellSize.width / 2 - UpWallReach.left}
            y={lineY - UpWallReach.before}
            width={GridCellSize.width + UpWallReach.left + UpWallReach.right}
            height={UpWallReach.before + UpWallReach.after}
        />
    </clipPath>
    <image
        href={artUrl}
        x={(cell.tool - sourceTool) * GridCellSize.width}
        y="0"
        width={BoardArtSize.width}
        height={BoardArtSize.height}
        clip-path="url(#{idPrefix}-grid-unwall-up-{index})"
        pointer-events="none"
    />
{/each}

{#each RemovedBlockedRightFrom as cell, index (`${cell.weapon},${cell.tool}`)}
    {@const center = gridCellPosition(cell.weapon, cell.tool)}
    {@const lineX = center.x + GridCellSize.width / 2}
    <clipPath id="{idPrefix}-grid-unwall-right-{index}">
        <rect
            x={lineX - RightWallReach.before}
            y={center.y - GridCellSize.height / 2 - RightWallReach.top}
            width={RightWallReach.before + RightWallReach.after}
            height={GridCellSize.height + RightWallReach.top + RightWallReach.bottom}
        />
    </clipPath>
    <image
        href={artUrl}
        x={GridCellSize.width}
        y="0"
        width={BoardArtSize.width}
        height={BoardArtSize.height}
        clip-path="url(#{idPrefix}-grid-unwall-right-{index})"
        pointer-events="none"
    />
{/each}

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
