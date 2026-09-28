import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { InvestorActionId, AlienTechActionId } from '../model/investorBoard.js'

/**
 * The next player in Investor Shenanigans' player order after currentPlayerId (rulebook page
 * 19): each player takes their Investor Action immediately followed by their Alien Tech Action
 * before play proceeds clockwise to the next. Both halves of a player's turn share the same
 * player order and the same state.investorShenanigansCurrentPlayerId pointer - see
 * stateHandlers/investorAction.ts and stateHandlers/alienTechAction.ts. Returns undefined once
 * the last player in the order has finished their Alien Tech Action, signaling that Investor
 * Shenanigans (and the Investor Round) is complete.
 */
export function nextInvestorShenanigansPlayerId(
    playerOrder: readonly string[],
    currentPlayerId: string
): string | undefined {
    const index = playerOrder.indexOf(currentPlayerId)
    return playerOrder[index + 1]
}

/**
 * The Action Disc rule (rulebook page 19): "Must move Action Disc to a new action or pass,
 * removing the Action Disc from the board." Confirmed by the game's co-designer: this
 * restriction persists across Investor Rounds - a player can't pick the same Investor Action
 * two Investor Rounds in a row unless they passed in between (which takes the disc off the
 * board, freeing up every action again next time). See playerState.lastInvestorActionId.
 */
export function canSelectInvestorActionId(
    state: HydratedStellarVenturesGameState,
    playerId: string,
    actionId: InvestorActionId
): boolean {
    return state.getPlayerState(playerId).lastInvestorActionId !== actionId
}

// The Alien Tech Action row's equivalent of canSelectInvestorActionId above - see
// playerState.lastAlienTechActionId.
export function canSelectAlienTechActionId(
    state: HydratedStellarVenturesGameState,
    playerId: string,
    actionId: AlienTechActionId
): boolean {
    return state.getPlayerState(playerId).lastAlienTechActionId !== actionId
}
