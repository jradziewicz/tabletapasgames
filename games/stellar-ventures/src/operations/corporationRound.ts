import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'

// Era 5 is the final Era and has no Investor or Administration Round of its own (rulebook page
// 9: "Era 5 Final era consisting of a Corporation Round, followed by Liquidation (Final
// Scoring)") - so once its Corporation Round ends, play goes straight to Liquidation instead of
// Release Dividends.
const FINAL_ERA = 5

// Confirmed by the game's co-designer: once a Corporation finishes Order Ships - the last step
// of its turn in the Corporation Round (Issue Share -> Expand Network/Wormhole -> Pay Dividends
// -> Order Ships) - play advances to the next Corporation's Issue Share, cycling through
// state.corporationTurnOrder. Once every active Corporation has taken its turn, the Corporation
// Round ends: every Era but the last begins its Investor Round at Release Dividends, while Era
// 5's Corporation Round instead proceeds directly to Liquidation.
//
// NOTE: this walks the full corporationTurnOrder array as-is, so it implicitly assumes every
// Corporation in it is active for the current Era. That's true for all 5 starting Corporations
// from Era 1 onward, but will need revisiting once Amethyst Agency (which sits out until Era 3 -
// see initializer.ts) needs to be inserted into turn order partway through the game.
export function advanceToNextCorporationOrInvestorRound(
    state: HydratedStellarVenturesGameState
): MachineState {
    // Alien Alchemist's and Dismantling Outposts' "once per Corporation Round" limits
    // (actions/alienAlchemist.ts, actions/dismantlingOutposts.ts) reset the moment one
    // Corporation's round hands off to the next - or ends entirely.
    state.alienAlchemistUsedThisCorporationRound = false
    state.dismantlingOutpostsUsedThisCorporationRound = false

    const nextIndex = state.activeCorporationIndex + 1
    if (nextIndex < state.corporationTurnOrder.length) {
        state.activeCorporationIndex = nextIndex
        return MachineState.IssueShare
    }
    return state.era >= FINAL_ERA ? MachineState.Liquidation : MachineState.ReleaseDividends
}
