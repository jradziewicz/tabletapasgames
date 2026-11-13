import {
    TwoSidedAgreementDeliveryPoints,
    goldSaleAgreements,
    type DeliveryCityId,
    type HydratedRockyVenturesGameState
} from '@tabletop/rocky-ventures'

// VP a gold delivery to this city would score from the player's agreement there (when agreements score on delivery).
export function deliveryVictoryPoints(state: HydratedRockyVenturesGameState, playerId: string, cityId: DeliveryCityId): number {
    if (!state.agreementsScoreOnDelivery) return 0
    try {
        const letter = goldSaleAgreements(state, playerId, cityId).pointBuy?.letter
        return letter ? (TwoSidedAgreementDeliveryPoints[letter] ?? 0) : 0
    } catch {
        return 0
    }
}
