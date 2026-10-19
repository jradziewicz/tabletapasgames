import type { Point } from '@tabletop/common'

// A gentle upward bend so a hop reads as a jump rather than a slide.
export function arcControl(from: Point, to: Point, bend: number = 0.28): Point {
    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy) || 1
    const normalX = dy / length
    const normalY = -dx / length
    const sign = normalY <= 0 ? 1 : -1
    return { x: midX + normalX * length * bend * sign, y: midY + normalY * length * bend * sign }
}

export function arcPoint(from: Point, control: Point, to: Point, t: number): Point {
    const u = 1 - t
    return {
        x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * control.y + t * t * to.y
    }
}

export function arcPath(from: Point, control: Point, to: Point): string {
    return `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`
}

// Shortens the arc at both ends so it starts outside the origin disc and stops before the target.
export function trimmedArc(from: Point, to: Point, trimStart: number, trimEnd: number): string {
    const control = arcControl(from, to)
    const start = arcPoint(from, control, to, trimStart)
    const end = arcPoint(from, control, to, 1 - trimEnd)
    return arcPath(start, arcControl(start, end), end)
}
