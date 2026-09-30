import { StartingPlayerCardId } from '../data/cards.js'
import { PawnSkipCost } from '../data/setup.js'
import type { HydratedRockyVenturesPlayerState } from '../model/playerState.js'

function range(from: number, to: number): number[] {
    const values: number[] = []
    for (let index = from; index < to; index += 1) {
        values.push(index)
    }
    return values
}

export function skippedIndexes(
    player: HydratedRockyVenturesPlayerState,
    targetIndex: number
): number[] | undefined {
    const length = player.tableau.length
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= length) {
        return undefined
    }
    const pawnIndex = player.pawnIndex
    if (pawnIndex === undefined) {
        return range(0, targetIndex)
    }
    if (targetIndex > pawnIndex) {
        return range(pawnIndex + 1, targetIndex)
    }
    if (targetIndex < pawnIndex) {
        return targetIndex === 0 ? [] : undefined
    }
    return length === 1 ? [] : undefined
}

export function isDiscardable(player: HydratedRockyVenturesPlayerState, index: number): boolean {
    return player.tableau[index] !== undefined && player.tableau[index] !== StartingPlayerCardId
}

export function reasonPawnMoveInvalid(
    player: HydratedRockyVenturesPlayerState,
    targetIndex: number,
    discardIndexes: number[]
): string | undefined {
    const skipped = skippedIndexes(player, targetIndex)
    if (!skipped) {
        return 'The action pawn cannot move there'
    }
    if (player.pawnIndex === undefined) {
        return discardIndexes.length > 0 ? 'The first move is free and discards nothing' : undefined
    }
    const unique = new Set(discardIndexes)
    if (unique.size !== discardIndexes.length) {
        return 'A card can only be discarded once'
    }
    for (const index of discardIndexes) {
        if (!skipped.includes(index)) {
            return 'Only skipped cards can be discarded'
        }
        if (!isDiscardable(player, index)) {
            return 'The I card may never be discarded'
        }
    }
    const cost = pawnMoveCost(player, skipped.length, discardIndexes.length)
    if (cost > player.money) {
        return 'Not enough money to pay for the skipped cards'
    }
    return undefined
}

export function pawnMoveCost(
    player: HydratedRockyVenturesPlayerState,
    skippedCount: number,
    discardCount: number
): number {
    if (player.pawnIndex === undefined) {
        return 0
    }
    return (skippedCount - discardCount) * PawnSkipCost
}
