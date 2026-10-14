import type { AnimationContext } from '@tabletop/frontend-components'
import type { Color, GameAction } from '@tabletop/common'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import { InsectKind, isBreed, type HydratedLocustGameState, type LocustGameState } from '@tabletop/locust'
import { StateAnimator } from './stateAnimator.js'
import type { LocustGameSession } from '$lib/model/session.svelte.js'

export type FallingNymph = { key: string; habitatId: string; color: Color; quadrant: number }

const DropHeight = 260
const DropDuration = 0.42
const DropStagger = 0.14
const FallbackDuration = 0.15

// Pattern B: new nymphs exist only in `to`, so transient discs mount at their circles and fall into place
// before the reactive state swap draws the real ones.
export class NymphDropAnimator extends StateAnimator<
    LocustGameState,
    HydratedLocustGameState,
    LocustGameSession
> {
    private elements = new Map<string, HTMLElement | SVGElement>()

    constructor(
        gameSession: LocustGameSession,
        private readonly setFalling: (nymphs: FallingNymph[]) => void
    ) {
        super(gameSession)
    }

    setNymphElement(key: string, element?: HTMLElement | SVGElement) {
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
        if (!from) {
            return
        }
        const falling = this.newNymphs(from, to)
        if (falling.length === 0) {
            return
        }
        this.setFalling(falling)
        await tick()

        const cinematic = !!action && isBreed(action)
        falling.forEach((nymph, index) => {
            const element = this.elements.get(nymph.key)
            if (!element) {
                return
            }
            if (cinematic) {
                gsap.set(element, { y: -DropHeight, scale: 1.5, opacity: 0, transformOrigin: 'center center' })
                const start = index * DropStagger
                animationContext.actionTimeline.to(
                    element,
                    { y: 0, scale: 1, opacity: 1, duration: DropDuration, ease: 'bounce.out' },
                    start
                )
            } else {
                gsap.set(element, { scale: 0.4, opacity: 0, transformOrigin: 'center center' })
                animationContext.actionTimeline.to(
                    element,
                    { scale: 1, opacity: 1, duration: FallbackDuration, ease: 'power1.out' },
                    0
                )
            }
        })
        animationContext.afterAnimations(() => this.setFalling([]))
    }

    private newNymphs(from: HydratedLocustGameState, to: HydratedLocustGameState): FallingNymph[] {
        const falling: FallingNymph[] = []
        for (const habitat of to.board.habitats) {
            habitat.occupants.forEach((occupant, quadrant) => {
                const before = from.board.count(habitat.id, occupant.color, InsectKind.Nymph)
                for (let index = before; index < occupant.nymph; index += 1) {
                    falling.push({
                        key: `${habitat.id}-${occupant.color}-${index}`,
                        habitatId: habitat.id,
                        color: occupant.color,
                        quadrant
                    })
                }
            })
        }
        return falling
    }
}

export function animateFallingNymph(
    node: HTMLElement | SVGElement,
    params: { animator: NymphDropAnimator; key: string }
) {
    params.animator.setNymphElement(params.key, node)
    return {
        destroy() {
            params.animator.setNymphElement(params.key, undefined)
        }
    }
}
