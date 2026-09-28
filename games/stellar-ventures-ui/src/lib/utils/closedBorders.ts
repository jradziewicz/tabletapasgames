import {
    type Hex,
    type HexCoordinate,
    type HydratedBoardState,
    hexIdForCoordinate,
    neighborCoordinates
} from '@tabletop/stellar-ventures'

// A hex-shaped stand-in for "off the printed map" - carries no borderLevel of its own, so
// isInsideBorder/crossesClosedBorder correctly treat it as outside every Border, exactly like
// open space beyond the board's edge. Only .borderLevel is ever read off it by those two methods,
// so this doesn't need to be a real, playable Hex - just enough shape to satisfy the type.
function offBoardHex(coordinate: HexCoordinate): Hex {
    return { id: `off-board:${hexIdForCoordinate(coordinate)}`, coordinate } as unknown as Hex
}

export function closedBorderEdges(board: HydratedBoardState): [Hex, Hex][] {
    const edges: [Hex, Hex][] = []
    for (const hex of Object.values(board.hexes)) {
        for (const coordinate of neighborCoordinates(hex.coordinate)) {
            const neighbor = board.getHex(hexIdForCoordinate(coordinate))
            if (neighbor) {
                if (neighbor.id <= hex.id) {
                    continue
                }
                if (board.crossesClosedBorder(hex, neighbor)) {
                    edges.push([hex, neighbor])
                }
            } else if (board.crossesClosedBorder(hex, offBoardHex(coordinate))) {
                // The closed Border's boundary runs off the edge of the printed map right here -
                // draw this hex's own outward-facing edge too, so the ring reads as a fully
                // enclosed shape instead of stopping wherever it happens to reach the map's own
                // outer boundary (see closedBorderEdgesForLevel's matching comment below).
                edges.push([hex, offBoardHex(coordinate)])
            }
        }
    }
    return edges
}

// Same edge search as closedBorderEdges above, but scoped to exactly one Border level - the
// edges that ring THAT specific Border, regardless of whether any other level is also closed.
// Used both for Board.svelte's own per-level-colored closedBorderSegments (each closed Border
// drawn in its own color) and for the single Border a BorderClosedRevealOverlay.svelte reveal is
// currently pulsing.
export function closedBorderEdgesForLevel(board: HydratedBoardState, level: number): [Hex, Hex][] {
    const edges: [Hex, Hex][] = []
    for (const hex of Object.values(board.hexes)) {
        for (const coordinate of neighborCoordinates(hex.coordinate)) {
            const neighbor = board.getHex(hexIdForCoordinate(coordinate))
            if (neighbor) {
                if (neighbor.id <= hex.id) {
                    continue
                }
                if (board.isInsideBorder(hex, level) !== board.isInsideBorder(neighbor, level)) {
                    edges.push([hex, neighbor])
                }
            } else if (board.isInsideBorder(hex, level)) {
                // Same off-the-map-edge extension as closedBorderEdges - a Hex inside this Border
                // level with no on-board neighbor here means the ring's boundary meets the map's
                // own edge at this exact hex side, so draw it rather than leaving a gap.
                edges.push([hex, offBoardHex(coordinate)])
            }
        }
    }
    return edges
}
