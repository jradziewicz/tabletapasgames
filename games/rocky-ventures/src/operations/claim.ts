import { CardActionKind } from '../data/cards.js'
import { MineNodeIds } from '../data/board.js'
import { OreKind } from '../data/mineTokens.js'
import { StatKind } from '../model/stats.js'
import { recordActionStat, recordCash, recordStat } from './stats.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { BoardNodesById } from '../data/board.js'
import { DragonHuntRegion, claimHuntRegions, startClaimHunt } from './hunt.js'
import { remainingActionKinds } from './turn.js'

export const RedMineLevel = 4
export const BlueMineLevel = 5
export const FreeMineLevel = 2

function levelTwoMinesFree(state: HydratedRockyVenturesGameState, playerId: string): boolean {
    return state.actionCardActions(playerId).some(
        (action) => action.kind === CardActionKind.ClaimMine && action.levelTwoMinesFree
    )
}

export function claimCost(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    nodeId: string
): number | undefined {
    const token = state.board.getMine(nodeId).token
    if (!token) {
        return undefined
    }
    if (token.level === FreeMineLevel && levelTwoMinesFree(state, playerId)) {
        return 0
    }
    return token.level
}

export function reasonClaimInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    nodeId: string
): string | undefined {
    if (!state.activePlayerIds.includes(playerId)) {
        return 'It is not your turn'
    }
    if (!remainingActionKinds(state).includes(CardActionKind.ClaimMine)) {
        return 'Claim Mine is not available on this card'
    }
    if (!MineNodeIds.includes(nodeId)) {
        return 'That is not a mine'
    }
    const site = state.board.getMine(nodeId)
    const token = site.token
    if (site.empty) {
        return 'That mine is empty'
    }
    if (!token) {
        return 'That mine is still face down'
    }
    if (token.ore !== OreKind.Gold) {
        return 'Only gold mines can be claimed'
    }
    if (site.ownerPlayerId !== undefined) {
        return 'That mine is already claimed'
    }
    const player = state.getPlayerState(playerId)
    if (player.claimTokens <= 0) {
        return 'You have no claim tokens left'
    }
    if (token.level >= BlueMineLevel && !player.blueMinesUnlocked) {
        return 'Level 5 mines need the blue unlock on the Weapon / Tool grid'
    }
    if (token.level === RedMineLevel && !player.redMinesUnlocked) {
        return 'Level 4 mines need the red unlock on the Weapon / Tool grid'
    }
    const cost = claimCost(state, playerId, nodeId) ?? 0
    if (cost > player.money) {
        return 'Not enough money to claim that mine'
    }
    return undefined
}

export function claimableMineIds(
    state: HydratedRockyVenturesGameState,
    playerId: string
): string[] {
    return MineNodeIds.filter((nodeId) => reasonClaimInvalid(state, playerId, nodeId) === undefined)
}

export function claimMineAt(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    nodeId: string,
    huntDragon = false
) {
    const player = state.getPlayerState(playerId)
    const cost = claimCost(state, playerId, nodeId) ?? 0
    player.spendMoney(cost)
    player.claimTokens -= 1
    recordActionStat(state, playerId, 'ClaimMine')
    recordStat(state, { kind: StatKind.MineClaim, playerId, amount: cost, nodeId })
    recordCash(state, playerId, -cost, 'claim', { nodeId })
    state.board.getMine(nodeId).ownerPlayerId = playerId
    state.turnActionsTaken.push(CardActionKind.ClaimMine)
    const huntRegions = claimHuntRegions(state, playerId, BoardNodesById[nodeId]?.region)
    const region = huntDragon && huntRegions.includes(DragonHuntRegion) ? DragonHuntRegion : huntRegions[0]
    if (region !== undefined) {
        startClaimHunt(state, playerId, region)
    }
}
