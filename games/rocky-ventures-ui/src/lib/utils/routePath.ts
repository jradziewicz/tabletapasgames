import { BoardBoxLocations, BoardNodesById } from '@tabletop/rocky-ventures'

function edgePoints(fromId: string, toId: string): { x: number; y: number }[] {
    const boxes = BoardBoxLocations.filter(
        (location) =>
            (location.edge.from === fromId && location.edge.to === toId) ||
            (location.edge.from === toId && location.edge.to === fromId)
    )
    const from = BoardNodesById[fromId]
    if (!from) {
        return []
    }
    return [...boxes]
        .sort(
            (left, right) =>
                Math.hypot(left.x - from.x, left.y - from.y) - Math.hypot(right.x - from.x, right.y - from.y)
        )
        .map((location) => ({ x: location.x, y: location.y }))
}

export function routePolylinePoints(nodeIds: string[]): string {
    const points: { x: number; y: number }[] = []
    nodeIds.forEach((nodeId, index) => {
        const node = BoardNodesById[nodeId]
        if (!node) {
            return
        }
        points.push({ x: node.x, y: node.y })
        const next = nodeIds[index + 1]
        if (next !== undefined) {
            points.push(...edgePoints(nodeId, next))
        }
    })
    return points.map((point) => `${point.x},${point.y}`).join(' ')
}

export const CityRouteColors: Record<string, string> = {
    dornoch: '#ff8a3d',
    manor: '#5ec8ff'
}
