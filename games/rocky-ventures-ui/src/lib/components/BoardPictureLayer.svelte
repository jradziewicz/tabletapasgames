<script lang="ts">
    import { BoardArtSize, BoardBoxLocations, BoxSize } from '@tabletop/rocky-ventures'
    import boardArt from '$lib/images/board.jpg'
    import type { BoardPicture } from '$lib/utils/boardPicture.js'

    // The map as it was at one step: board art plus the track, mines and grid discs of that moment.
    let { picture }: { picture: BoardPicture } = $props()
    const MineTokenRadius = 24
</script>

<image href={boardArt} x="0" y="0" width={BoardArtSize.width} height={BoardArtSize.height} />
<!-- Same correction as the live board: the Strathfillan to Dornoch-Dur link costs $7. -->
<g transform="translate(495.5 703.1)">
    <rect x="-13.5" y="-13.5" width="27" height="27" rx="2" transform="rotate(32)" fill="#ecc96a" stroke="#1d2433" stroke-width="2.6" />
    <text y="7.6" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="21" fill="#1d2433">7</text>
</g>
{#each picture.track as piece (piece.boxId)}
    {@const location = BoardBoxLocations.find((candidate) => candidate.box.id === piece.boxId)}
    {#if location}
        <rect
            x={location.x - BoxSize / 2}
            y={location.y - BoxSize / 2}
            width={BoxSize}
            height={BoxSize}
            rx="2"
            fill={piece.color}
            stroke="#111"
            stroke-width="2"
            transform="rotate({location.angle} {location.x} {location.y})"
        />
    {/if}
{/each}
{#each picture.mines as mine, index (index)}
    {#if mine.ringColor}
        <circle cx={mine.x} cy={mine.y} r="32" fill="none" stroke={mine.ringColor} stroke-width="5.5" />
    {/if}
    {#if mine.imageUrl}
        <image href={mine.imageUrl} x={mine.x - MineTokenRadius} y={mine.y - MineTokenRadius} width={MineTokenRadius * 2} height={MineTokenRadius * 2} />
    {/if}
    {#if mine.ownerColor}
        <circle cx={mine.x + 20} cy={mine.y + 20} r="18" fill={mine.ownerColor} stroke="#111" stroke-width="3" />
    {/if}
{/each}
{#each picture.discs as disc, index (index)}
    <circle cx={disc.x} cy={disc.y} r="11" fill={disc.color} stroke="#111" stroke-width="2" />
{/each}
