import {
    CardActionKind,
    Definition,
    HydratedAcquire,
    HydratedClaimMine,
    HydratedExtractAndSell,
    HydratedHunt,
    HydratedInvest,
    HydratedLayTrack,
    HydratedTax,
    MineNodeIds,
    OreKind,
    claimCost,
    pawnMoveCost,
    skippedIndexes,
    type HydratedRockyVenturesGameState
} from '@tabletop/rocky-ventures'

// When nothing on the card the pawn lands on can be used, the game ends the turn straight
// away. This replays the pawn move on a copy of the state and, if that would happen, says why,
// so the player can pick another card instead of losing the turn by surprise.
export function pawnMoveEndsTurnReason(
    gameState: HydratedRockyVenturesGameState,
    playerId: string,
    targetIndex: number,
    discardIndexes: number[]
): string | undefined {
    let state: HydratedRockyVenturesGameState
    try {
        state = Definition.runtime.hydrator.hydrateState(
            structuredClone(gameState.dehydrate())
        ) as HydratedRockyVenturesGameState
        const player = state.getPlayerState(playerId)
        const skipped = skippedIndexes(player, targetIndex) ?? []
        player.spendMoney(pawnMoveCost(player, skipped.length, discardIndexes.length))
        for (const index of [...discardIndexes].sort((a, b) => b - a)) {
            player.tableau.splice(index, 1)
        }
        player.pawnIndex = targetIndex - discardIndexes.length
        state.turnActionsTaken = []
        state.turnTrackCompanies = []
        state.turnOver = false
        delete state.borrowedCardId
        delete state.turnCopied
        state.activePlayerIds = [playerId]
    } catch {
        return undefined
    }

    const playable =
        HydratedTax.canTax(state, playerId) ||
        HydratedInvest.canInvest(state, playerId) ||
        HydratedClaimMine.canClaimMine(state, playerId) ||
        HydratedLayTrack.canLayTrack(state, playerId) ||
        HydratedExtractAndSell.canExtractAndSell(state, playerId) ||
        HydratedHunt.canHunt(state, playerId) ||
        HydratedAcquire.canAcquire(state, playerId)
    if (playable) {
        return undefined
    }

    const player = state.getPlayerState(playerId)
    const kinds = state.actionCardActions(playerId).map((action) => action.kind)
    if (kinds.includes(CardActionKind.ClaimMine)) {
        if (player.claimTokens <= 0) {
            return 'you have no claim tokens left'
        }
        const costs = MineNodeIds.filter((nodeId) => {
            const site = state.board.getMine(nodeId)
            return !site.empty && site.token?.ore === OreKind.Gold && site.ownerPlayerId === undefined
        })
            .map((nodeId) => claimCost(state, playerId, nodeId))
            .filter((cost): cost is number => cost !== undefined)
        const cheapest = costs.length ? Math.min(...costs) : undefined
        if (cheapest === undefined) {
            return 'there is no open gold mine to claim'
        }
        if (cheapest > player.money) {
            return `the cheapest open mine costs $${cheapest} and you would have $${player.money}`
        }
        return 'the open mines you can afford need a red or blue unlock'
    }
    return 'none of its actions can be used right now'
}
