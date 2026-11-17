import {
    BoardNodes,
    BlueRestrictedMineLevel,
    MineTier,
    NodeKind,
    OreKind,
    RedRestrictedMineLevel,
    isMineNode,
    type HydratedRockyVenturesGameState
} from '@tabletop/rocky-ventures'
import { CompanyColors } from '$lib/utils/companyDisplay.svelte.js'
import { mineTokenBackImageUrl, mineTokenImageUrl } from '$lib/utils/tokenImages.js'
import { DummyColor } from '$lib/utils/dummyDisplay.js'
import { gridCellPosition } from '$lib/utils/trackLayout.js'

// The pieces on the map at one moment, so History can show the board as it was at each step
// instead of the board as it is now.
export type BoardPicture = {
    track: { boxId: string; color: string }[]
    mines: { nodeId: string; x: number; y: number; imageUrl?: string; ringColor?: string; ownerColor?: string }[]
    // Scourges on the board, by id, with the region each is in.
    scourges: Record<string, string>
    discs: { x: number; y: number; color: string }[]
}

const RingColors: Record<number, string> = {
    [RedRestrictedMineLevel]: '#f14b50',
    [BlueRestrictedMineLevel]: '#5f6bb2'
}

export function boardPicture(state: HydratedRockyVenturesGameState, colorOf: (playerId: string) => string): BoardPicture {
    const track = Object.entries(state.board.trackByBoxId)
        .filter(([, companyId]) => companyId)
        .map(([boxId, companyId]) => ({ boxId, color: CompanyColors[companyId as keyof typeof CompanyColors] ?? '#999' }))

    const mines: BoardPicture['mines'] = []
    for (const node of BoardNodes.filter(isMineNode)) {
        const site = state.board.mines[node.id]
        if (!site) continue
        const imageUrl = site.empty
            ? undefined
            : site.token
              ? mineTokenImageUrl(site.token)
              : mineTokenBackImageUrl(OreKind.Gold, node.kind === NodeKind.MineA ? MineTier.A : MineTier.B)
        mines.push({
            nodeId: node.id,
            x: node.x,
            y: node.y,
            imageUrl,
            ringColor: site.token?.ore === OreKind.Gold ? RingColors[site.token.level] : undefined,
            ownerColor: site.ownerPlayerId ? colorOf(site.ownerPlayerId) : undefined
        })
    }

    // Grid discs, fanned out like the board does when players share a cell.
    const pieces = state.players.map((player) => ({ weapon: player.weaponLevel, tool: player.toolLevel, color: colorOf(player.playerId) }))
    if (state.dummy) pieces.push({ weapon: state.dummy.weaponLevel, tool: state.dummy.toolLevel, color: DummyColor })
    const groups = new Map<string, number>()
    const discs = pieces.map((piece) => {
        const key = `${piece.weapon},${piece.tool}`
        const count = pieces.filter((other) => `${other.weapon},${other.tool}` === key).length
        const index = groups.get(key) ?? 0
        groups.set(key, index + 1)
        const cell = gridCellPosition(piece.weapon, piece.tool)
        const offset = count > 1 ? index - (count - 1) / 2 : 0
        return { x: cell.x + offset * 9, y: cell.y - offset * 9 * 0.6, color: piece.color }
    })
    const scourges: Record<string, string> = {}
    for (const [region, list] of Object.entries(state.board.scourgesByRegion)) {
        for (const scourge of list ?? []) scourges[scourge.scourgeId] = region
    }
    return { track, mines, discs, scourges }
}
