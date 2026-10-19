import type { AnimationContext } from '@tabletop/frontend-components'
import type { Color, GameAction, Point } from '@tabletop/common'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import {
    getHabitat,
    isJump,
    type HydratedLocustGameState,
    type LocustGameState
} from '@tabletop/locust'
import { StateAnimator } from './stateAnimator.js'
import type { LocustGameSession } from '$lib/model/session.svelte.js'
import { habitatCenter, quadrantPoint } from '$lib/utils/boardLayout.js'
import { arcControl, arcPoint } from '$lib/utils/arc.js'

export type FlyingGrasshopper = { key: string; color: Color; from: Point; to: Point }

const HopDuration = 0.5
const HopGap = 0.12
const LandBounce = 0.16

function quadrantOf(state: HydratedLocustGameState, habitatId: string, color: Color): number {
    const occupants = state.board.habitat(habitatId).occupants
    const index = occupants.findIndex((occupant) => occupant.color === color)
    return index === -1 ? occupants.length : index
}

// Pattern B: each committed hop gets a transient disc that arcs from its old quadrant to its new one
// and lands with a small bounce before the reactive state swap draws the real grasshopper.
export class JumpAnimator extends StateAnimator<
    LocustGameState,
    HydratedLocustGameState,
    LocustGameSession
> {
    private elements = new Map<string, SVGElement | HTMLElement>()

    constructor(
        gameSession: LocustGameSession,
        private readonly setFlying: (grasshoppers: FlyingGrasshopper[]) => void
    ) {
        super(gameSession)
    }

    setGrasshopperElement(key: string, element?: SVGElement | HTMLElement) {
        if (element) {
            this.elements.set(key, element)
        } else {
            this.elements.delete(key)
        }
    }

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedLocustGameState
        from?: HydratedLocustGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        // Without the action (undo, state-only history) the board simply settles to the new state.
        if (!from || !action || !isJump(action) || action.hops.length === 0) {
            return
        }
        const color = from.activeColor
        if (!color) {
            return
        }
        const landed = new Map<string, number>()
        const flying = action.hops.map((hop, index) => {
            const count = landed.get(hop.to) ?? 0
            landed.set(hop.to, count + 1)
            return {
                key: `${action.id}-${index}`,
                color,
                from: quadrantPoint(
                    habitatCenter(getHabitat(hop.from)),
                    quadrantOf(from, hop.from, color)
                ),
                to: quadrantPoint(
                    habitatCenter(getHabitat(hop.to)),
                    quadrantOf(to, hop.to, color),
                    {
                        x: count * 12,
                        y: -count * 10
                    }
                )
            }
        })
        this.setFlying(flying)
        await tick()

        flying.forEach((grasshopper, index) => {
            const element = this.elements.get(grasshopper.key)
            if (!element) {
                return
            }
            const control = arcControl(grasshopper.from, grasshopper.to, 0.35)
            const progress = { t: 0 }
            const place = (scale: number) => {
                const point = arcPoint(grasshopper.from, control, grasshopper.to, progress.t)
                element.setAttribute(
                    'transform',
                    `translate(${point.x} ${point.y}) scale(${scale})`
                )
            }
            place(1)
            const start = index * (HopDuration + HopGap)
            animationContext.actionTimeline.to(
                progress,
                {
                    t: 1,
                    duration: HopDuration,
                    ease: 'power1.inOut',
                    onUpdate: () => place(1 + 0.35 * Math.sin(Math.PI * progress.t))
                },
                start
            )
            const bounce = { s: 1 }
            animationContext.actionTimeline.to(
                bounce,
                {
                    s: 1,
                    keyframes: [{ s: 0.85 }, { s: 1.08 }, { s: 1 }],
                    duration: LandBounce,
                    onUpdate: () => place(bounce.s)
                },
                start + HopDuration
            )
        })
        animationContext.afterAnimations(() => this.setFlying([]))
    }
}

export function animateFlyingGrasshopper(
    node: SVGElement | HTMLElement,
    params: { animator: JumpAnimator; key: string }
) {
    params.animator.setGrasshopperElement(params.key, node)
    return {
        destroy() {
            params.animator.setGrasshopperElement(params.key, undefined)
        }
    }
}
