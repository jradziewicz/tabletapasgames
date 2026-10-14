import type { GameAction } from '@tabletop/common'
import {
    RegionLabels,
    getSpace,
    isAssignDuelScoring,
    isBreed,
    isCannibalize,
    isHatch,
    isJump,
    isMatureNymphs,
    isPlaceCube,
    isRelocateLocusts,
    isScoreRegion,
    isSwarm
} from '@tabletop/locust'
import { ActionNames } from './describe.js'

function list(items: string[]): string {
    return items.length === 0 ? 'nothing' : items.join(', ')
}

function countList(habitatIds: string[]): string {
    const counts = new Map<string, number>()
    for (const habitatId of habitatIds) {
        counts.set(habitatId, (counts.get(habitatId) ?? 0) + 1)
    }
    return list([...counts].map(([habitatId, count]) => (count > 1 ? `${count}× ${habitatId}` : habitatId)))
}

export function describeHistoryAction(action: GameAction): string {
    if (isPlaceCube(action)) {
        const space = getSpace(action.spaceId)
        const label = space.kind ? `${ActionNames[space.kind]} ${space.level}` : action.spaceId
        const alternative = action.alternative ? ' (Alternative Action)' : ''
        const bonus = action.metadata?.bonusToken ? `, taking a ${action.metadata.bonusToken} token` : ''
        return `moved a cube to ${label} in Region ${RegionLabels[space.region]}${alternative}${bonus}`
    }
    if (isJump(action)) {
        return action.hops.length === 0
            ? 'passed'
            : `jumped ${list(action.hops.map((hop) => `${hop.from} → ${hop.to}`))}`
    }
    if (isBreed(action)) {
        return action.habitatIds.length === 0 ? 'passed' : `bred nymphs in ${countList(action.habitatIds)}`
    }
    if (isHatch(action)) {
        return action.count === 0 ? 'passed' : `hatched ${action.count} disc${action.count === 1 ? '' : 's'}`
    }
    if (isCannibalize(action)) {
        if (action.attacks.length === 0) return 'passed'
        return `cannibalized ${list(
            action.attacks.map(
                (attack) =>
                    `${attack.victims.reduce((sum, victim) => sum + victim.count, 0)} in ${attack.habitatId}`
            )
        )}`
    }
    if (isSwarm(action)) {
        return action.habitatIds.length === 0 ? 'passed' : `made ${list(action.habitatIds)} swarm`
    }
    if (isRelocateLocusts(action)) {
        return action.destinations.length === 0
            ? 'had no room for their locusts'
            : `flew locusts to ${countList(action.destinations)}`
    }
    if (isAssignDuelScoring(action)) {
        return `counts ${action.vigorColor} for Vigor Points`
    }
    return action.type
}

export function describeSystemAction(action: GameAction): string | undefined {
    if (isScoreRegion(action) && action.metadata) {
        const vigor = action.metadata.vigor
            .filter((entry) => entry.amount > 0)
            .map((entry) => `${entry.color} +${entry.amount}`)
        const majorities = action.metadata.majorities
            .filter((majority) => majority.winner)
            .map((majority) => `${majority.habitatId} → ${majority.winner}`)
        return `Scoring after Region ${RegionLabels[action.metadata.scoredRegion]}: ${list(vigor)} VP. Majorities: ${list(majorities)}.`
    }
    if (isMatureNymphs(action) && action.metadata && action.metadata.matured > 0) {
        return `${action.metadata.matured} ${action.color} nymph${action.metadata.matured === 1 ? '' : 's'} grew into grasshoppers.`
    }
    return undefined
}
