import { StatKind } from '../model/stats.js'
import { OreKind } from '../data/mineTokens.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import type { HydratedRockyVenturesPlayerState } from '../model/playerState.js'
import { FirstEraCardId, SecondEraCardId, ThirdEraCardId } from './market.js'
import { recordVictoryPoints } from './stats.js'

// The player who buys a Feast card scores a bonus for where they rank in that Feast's category
// (Justin, 2026-11-13). Ties share the rank; 4th place and below score nothing.
export const FeastBuyerBonuses: Record<string, { points: number[]; measure: (state: HydratedRockyVenturesGameState, player: HydratedRockyVenturesPlayerState) => number }> = {
    // The Lantern Feast: position on the tool track.
    [FirstEraCardId]: { points: [3, 1, 1], measure: (_state, player) => player.toolLevel },
    // The Feast of the Deep Seam: share multipliers held.
    [SecondEraCardId]: {
        points: [4, 2, 1],
        measure: (state, player) =>
            player.shares.reduce((sum, share) => sum + state.getCompany(share.companyId).multiplierForShare(share.shareIndex), 0)
    },
    // The Golden Table: gold mines claimed. Claims made before the ore was recorded were all gold,
    // since a mine is only claimable while its revealed gold token is on it.
    [ThirdEraCardId]: {
        points: [5, 3, 2],
        measure: (state, player) =>
            state.statEvents.filter(
                (event) =>
                    event.kind === StatKind.MineClaim &&
                    event.playerId === player.playerId &&
                    (event.source === undefined || event.source === OreKind.Gold)
            ).length
    }
}

export function feastBuyerBonus(state: HydratedRockyVenturesGameState, playerId: string, cardId: string): number {
    const bonus = FeastBuyerBonuses[cardId]
    if (!state.feastBuyerBonus || !bonus) {
        return 0
    }
    const mine = bonus.measure(state, state.getPlayerState(playerId))
    const rank = 1 + state.players.filter((player) => bonus.measure(state, player) > mine).length
    return bonus.points[rank - 1] ?? 0
}

export function scoreFeastBuyerBonus(state: HydratedRockyVenturesGameState, playerId: string, cardId: string) {
    const points = feastBuyerBonus(state, playerId, cardId)
    if (points > 0) {
        state.getPlayerState(playerId).addVictoryPoints(points)
        recordVictoryPoints(state, playerId, points, 'feastBonus', { cardId })
    }
}
