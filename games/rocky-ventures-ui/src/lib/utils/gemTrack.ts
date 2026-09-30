interface Point {
    x: number
    y: number
}

const Columns = [1469.3, 1508.8, 1548.3]
const Rows = [103, 145.5, 188, 231]

export const GemHexRadius = 15.5

function cell(column: number, row: number): Point {
    return { x: Columns[column]!, y: Rows[row]! }
}

// Fill order: right column top to bottom, middle column bottom to top, left column top to bottom.
export const GemTrackFillOrder: Point[] = [
    ...[0, 1, 2, 3].map((row) => cell(2, row)),
    ...[3, 2, 1, 0].map((row) => cell(1, row)),
    ...[0, 1, 2, 3].map((row) => cell(0, row))
]

export function hexagonPoints(center: Point, radius: number): string {
    return Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI / 3) * index
        return `${center.x + radius * Math.cos(angle)},${center.y + radius * Math.sin(angle)}`
    }).join(' ')
}
