import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from '@tabletop/common'

export const ShipLevels = [1, 2, 3, 5, 8]

export type ShipyardSection = Type.Static<typeof ShipyardSection>
export const ShipyardSection = Type.Object({
    level: Type.Number(),
    remainingShips: Type.Number(),
    // When set, this section's ships are always available and remainingShips is never checked
    // or decremented. Used for Level 8, which prints an infinity symbol on the Shipyard track
    // rather than a starting count - see the initializer.
    unlimited: Type.Optional(Type.Boolean()),
    // The Alien Shipyard Tile placed face-down on this section at Setup (only Levels 2, 3 and 5
    // get one on the Alpha map - see the rulebook's "5 x Alien Shipyard Tiles" component and
    // Setup step 7). Its chevron count is hidden until revealed - see firstShipOrdered below.
    alienTileRevealed: Type.Optional(Type.Boolean()),
    alienTileChevrons: Type.Optional(Type.Number()),
    // The lower Ship level immediately scrapped when this section's first Ship is Ordered - this
    // is fixed board data (printed directly on the Shipyard track), not tile-dependent. On the
    // Alpha map: Level 3 -> scraps Level 1, Level 5 -> scraps Level 2, Level 8 -> scraps Level 3.
    scrapTargetLevel: Type.Optional(Type.Number()),
    hasTriggeredScrappingEvent: Type.Optional(Type.Boolean()),
    // Recorded once, permanently, the moment applyScrappingEvent actually reduces a Corporation's
    // CARGO because of THIS section's Scrapping Event - keyed by CorporationId, value is how much
    // CARGO that Corporation lost. deliveredShipLevels itself retains no evidence of what was
    // removed from it, so this is the only record of the loss - it exists purely so any client,
    // at any later time (not just whoever happened to submit the triggering OrderShip), can
    // reconstruct the "before" CARGO figure for FirstShipOrderedRevealOverlay.svelte's dramatic
    // reveal (see session.svelte.ts's firstShipOrderedReveal).
    scrapCargoLossByCorporation: Type.Optional(Type.Record(Type.String(), Type.Number())),
    // "First Ship in New Level Ordered?" (rulebook page 17): true once this section's very first
    // Ship has ever been Ordered, having triggered both the Alien Tile flip (if any) and the
    // Scrapping Event check (if any) exactly once. See operations/shipOrdering.ts.
    firstShipOrdered: Type.Optional(Type.Boolean())
})

export type ShipyardState = Type.Static<typeof ShipyardState>
export const ShipyardState = Type.Object({
    sections: Type.Array(ShipyardSection)
})

export const ShipyardStateValidator = Compile(ShipyardState)

export class HydratedShipyardState
    extends Hydratable<typeof ShipyardState>
    implements ShipyardState
{
    declare sections: ShipyardSection[]

    constructor(data: ShipyardState) {
        super(data, ShipyardStateValidator)
    }

    lowestAvailableSection(): ShipyardSection | undefined {
        return this.sections.find((section) => section.unlimited || section.remainingShips > 0)
    }

    sectionForLevel(level: number): ShipyardSection | undefined {
        return this.sections.find((section) => section.level === level)
    }

    takeLowestShip(): number {
        const section = this.lowestAvailableSection()
        if (!section) {
            throw Error('No ships remain in the shipyard')
        }
        if (!section.unlimited) {
            section.remainingShips -= 1
        }
        return section.level
    }
}
