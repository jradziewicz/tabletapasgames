import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { resolveFirstShipOrderedEffects } from '../operations/shipOrdering.js'

// Like ReleaseDividends/PayDividends, ScrapLowestShip has no playerId - it's a System action,
// queued automatically by ScrapLowestShipStateHandler.enter(). It's the first, fully-automatic
// step of the Administration Round (rulebook page 20): "Scrap a single Ship from the game. Remove
// the Ship from the lowest available level that has any. This may trigger a Scrapping Event
// and/or flipping an Alien Ship Tile."
export type ScrapLowestShip = Type.Static<typeof ScrapLowestShip>
export const ScrapLowestShip = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ScrapLowestShip),
            scrappedLevel: Type.Optional(Type.Number())
        })
    ])
)

export const ScrapLowestShipValidator = Compile(ScrapLowestShip)

export function isScrapLowestShip(action?: GameAction): action is ScrapLowestShip {
    return action?.type === ActionType.ScrapLowestShip
}

/**
 * Removes one Ship token from the Shipyard's current lowest available section (the same section
 * Order Ships would pull from next - see operations/shipOrdering.ts's HydratedShipyardState's
 * lowestAvailableSection), permanently taking it out of the Shipyard's own supply. "Lowest
 * available level" is the same defined term used for Ordering ("Lowest Level First"), not a
 * Corporation's Charter - so no Corporation loses a Ship from this step directly.
 *
 * Reuses resolveFirstShipOrderedEffects exactly as Order Ship does: the rulebook's Scrapping
 * Event definition (page 17) explicitly fires "when the first Ship of that section is either
 * Ordered OR REMOVED DURING ADMINISTRATION" - the same one-time per-section trigger (Alien
 * Shipyard Tile flip, and/or a Scrapping Event purging an even-lower level from every
 * Corporation's Charter), just potentially entered via this route instead of an Order Ship
 * action, if nobody has ordered from this section yet.
 */
export class HydratedScrapLowestShip
    extends HydratableAction<typeof ScrapLowestShip>
    implements ScrapLowestShip
{
    declare type: ActionType.ScrapLowestShip
    declare scrappedLevel?: number

    constructor(data: ScrapLowestShip) {
        super(data, ScrapLowestShipValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const section = state.shipyard.lowestAvailableSection()
        assertExists(section, 'Shipyard should always have a lowest available section (Level 8 is unlimited)')

        if (!section.unlimited) {
            section.remainingShips -= 1
        }
        // Flags this action itself as beyond Undo whenever it happens to be the one that flips a
        // still-hidden Alien Shipyard tile face up - secret information a player must not be able
        // to peek at and then take back (see resolveFirstShipOrderedEffects). A System action, so
        // this only ever protects a human's earlier action from having Undo step back past it.
        if (resolveFirstShipOrderedEffects(state, section.level)) {
            this.revealsInfo = true
        }

        this.scrappedLevel = section.level
    }
}
