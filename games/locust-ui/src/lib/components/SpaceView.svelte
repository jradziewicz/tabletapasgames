<script lang="ts">
    import { getSpace } from '@tabletop/locust'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ActionNames } from '$lib/utils/describe.js'
    import { SpaceSize, UnlimitedSpaceSize, spaceCenter } from '$lib/utils/boardLayout.js'

    let { spaceId }: { spaceId: string } = $props()

    const session = getGameSession()
    const space = $derived(getSpace(spaceId))
    const center = $derived(spaceCenter(space))
    const size = $derived(space.unlimited ? UnlimitedSpaceSize : SpaceSize)
    const cubes = $derived(
        space.unlimited
            ? (session.gameState.board.unlimitedCubes[spaceId] ?? [])
            : [session.gameState.board.cubes[spaceId]].filter((color) => color !== undefined)
    )
    const choosable = $derived(session.choosableSpaceIds.includes(spaceId))
    const isActiveCube = $derived(
        !session.gameState.result && session.gameState.nextCubeSpaceId() === spaceId
    )
    const spaceTitle = $derived(
        space.kind
            ? `${ActionNames[space.kind]} ${space.level}${space.color ? ` (${space.color})` : ''}`
            : spaceId
    )
    const bonusToken = $derived(session.gameState.board.bonusTokens[spaceId])
    const BonusFill: Record<string, string> = {
        grey: '#8d8d8d',
        orange: '#d98a10',
        cream: '#efe6c8'
    }
</script>

<g>
    {#if bonusToken && cubes.length === 0}
        <circle
            cx={center.x + (space.column === 'L' ? 34 : -34)}
            cy={center.y}
            r="15"
            fill={BonusFill[bonusToken] ?? '#999'}
            stroke="#2b2418"
            stroke-width="2.5"
        />
    {/if}
    {#each cubes as color, index}
        {@const cubeSize = space.unlimited ? 22 : size - 4}
        {@const cx = space.unlimited ? center.x - 18 + (index % 3) * 18 : center.x}
        {@const cy = space.unlimited ? center.y - 14 + Math.floor(index / 3) * 18 : center.y}
        <rect
            x={cx - cubeSize / 2}
            y={cy - cubeSize / 2}
            width={cubeSize}
            height={cubeSize}
            rx="4"
            fill={session.colors.getUiColor(color)}
            stroke="#1a1a1a"
            stroke-width="2.5"
        />
    {/each}
    {#if isActiveCube}
        <rect
            x={center.x - size / 2 - 7}
            y={center.y - size / 2 - 7}
            width={size + 14}
            height={size + 14}
            rx="8"
            fill="none"
            stroke="#ffd66e"
            stroke-width="6"
            class="lc-target lc-target-gold"
        />
    {/if}
    {#if choosable}
        <g class="lc-space">
            <rect
                x={center.x - size / 2 - 2}
                y={center.y - size / 2 - 2}
                width={size + 4}
                height={size + 4}
                rx="5"
                fill="none"
                stroke="#3ddc84"
                stroke-width="2.5"
                class="lc-space-ring"
                pointer-events="none"
            />
            <rect
                x={center.x - size / 2 - 4}
                y={center.y - size / 2 - 4}
                width={size + 8}
                height={size + 8}
                fill="transparent"
                role="button"
                tabindex="0"
                aria-label="Action space {spaceId}"
                class="cursor-pointer"
                onclick={() => session.chooseSpace(spaceId)}
                onkeydown={(event) => event.key === 'Enter' && session.chooseSpace(spaceId)}
            >
                <title>{spaceTitle}</title>
            </rect>
        </g>
    {/if}
</g>
