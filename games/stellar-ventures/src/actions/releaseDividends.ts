import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

// Like PayDividends, ReleaseDividends has no playerId - it's a System action (see
// ActionSource.System / MachineContext.addSystemAction), queued automatically by
// ReleaseDividendsStateHandler.enter() rather than submitted by a player. It's the first,
// fully-automatic step of the Investor Round (rulebook page 18): "All players move Credits from
// Frozen Funds to Liquid Funds."
export type ReleaseDividends = Type.Static<typeof ReleaseDividends>
export const ReleaseDividends = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ReleaseDividends)
        })
    ])
)

export const ReleaseDividendsValidator = Compile(ReleaseDividends)

export function isReleaseDividends(action?: GameAction): action is ReleaseDividends {
    return action?.type === ActionType.ReleaseDividends
}

/**
 * Moves every player's Frozen Funds to their Liquid Funds. Unlike Pay Dividends (which only pays
 * out Shareholders of the single active Corporation), this applies to every player in the game at
 * once - each player's own Frozen Funds may have built up across every Corporation's Pay
 * Dividends step during the Corporation Round just finished.
 */
export class HydratedReleaseDividends
    extends HydratableAction<typeof ReleaseDividends>
    implements ReleaseDividends
{
    declare type: ActionType.ReleaseDividends

    constructor(data: ReleaseDividends) {
        super(data, ReleaseDividendsValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        for (const player of state.players) {
            player.releaseDividends()
        }
    }
}
