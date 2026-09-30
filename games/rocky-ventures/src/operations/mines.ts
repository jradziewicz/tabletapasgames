import type { RandomFunction } from '@tabletop/common'
import { BoardNodesById, NodeKind } from '../data/board.js'
import { MineTier, MineToken, OreKind } from '../data/mineTokens.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { addScourgeToRegion } from './scourges.js'

function supplyKey(ore: OreKind, tier: MineTier): 'goldA' | 'goldB' | 'silverA' | 'silverB' {
    if (ore === OreKind.Gold) {
        return tier === MineTier.A ? 'goldA' : 'goldB'
    }
    return tier === MineTier.A ? 'silverA' : 'silverB'
}

export function mineTierForNode(nodeId: string): MineTier {
    const node = BoardNodesById[nodeId]
    if (!node) {
        throw Error(`Unknown node ${nodeId}`)
    }
    if (node.kind === NodeKind.MineA) {
        return MineTier.A
    }
    if (node.kind === NodeKind.MineB) {
        return MineTier.B
    }
    throw Error(`${nodeId} is not a mine city`)
}

// Face-down tokens are modelled as shuffled supplies drawn from at reveal time, which is
// statistically identical to dealing them face down at setup.
export function drawMineToken(
    state: HydratedRockyVenturesGameState,
    ore: OreKind,
    tier: MineTier
): MineToken | undefined {
    return state.mineSupplies[supplyKey(ore, tier)].shift()
}

export function takeSpecificMineToken(
    state: HydratedRockyVenturesGameState,
    ore: OreKind,
    tier: MineTier,
    predicate: (token: MineToken) => boolean
): MineToken {
    const supply = state.mineSupplies[supplyKey(ore, tier)]
    const index = supply.findIndex(predicate)
    if (index < 0) {
        throw Error(`No matching ${ore} ${tier} mine token in supply`)
    }
    return supply.splice(index, 1)[0]!
}

// Flips the face-down gold mine at a city. Returns the revealed token, or undefined when the mine
// is already face up (or the supply for that tier is exhausted). A revealed scourge symbol places
// the next scourge in the city's region.
export function revealMine(
    state: HydratedRockyVenturesGameState,
    nodeId: string,
    random: RandomFunction
): MineToken | undefined {
    const site = state.board.getMine(nodeId)
    if (site.token || site.empty) {
        return undefined
    }
    const token = drawMineToken(state, OreKind.Gold, mineTierForNode(nodeId))
    if (!token) {
        return undefined
    }
    site.token = token
    if (token.scourge) {
        addScourgeToRegion(state, BoardNodesById[nodeId]!.region, random)
    }
    return token
}
