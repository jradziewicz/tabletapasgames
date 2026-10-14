import { Color, GameResult } from '@tabletop/common'
import * as Type from 'typebox'
import {
    BonusToken,
    BonusTokenTypes,
    FinalRegion,
    SpaceColumn,
    getHabitat,
    habitatsInRegion,
    majorityToken,
    spaceId,
    spacesInTurnOrder
} from '../data/board.js'
import {
    BonusSetPoints,
    FinalScoringMajorityVigor,
    GrasshopperVigor,
    IslandLocustBonusVigor,
    LocustVigor,
    MostSupplyBonus,
    NymphVigor,
    OpenRuleDefaults,
    RunnerUpSupplyBonus,
    ScoringCount,
    TiedMostSupplyBonus
} from '../data/rules.js'
import { occupantDiscs } from '../model/board.js'
import type { HydratedLocustGameState } from '../model/gameState.js'
import { killingZone, majorityRegion, scoringZone } from './zones.js'

export type MajorityResult = Type.Static<typeof MajorityResult>
export const MajorityResult = Type.Object({
    habitatId: Type.String(),
    winner: Type.Optional(Type.Enum(Color)),
    runnerUp: Type.Optional(Type.Enum(Color))
})

export type ColorAmount = Type.Static<typeof ColorAmount>
export const ColorAmount = Type.Object({ color: Type.Enum(Color), amount: Type.Number() })

export type RegionScoringResult = Type.Static<typeof RegionScoringResult>
export const RegionScoringResult = Type.Object({
    vigor: Type.Array(ColorAmount),
    majorities: Type.Array(MajorityResult),
    killed: Type.Array(ColorAmount)
})

export function vigorInZone(
    state: HydratedLocustGameState,
    activeRegion: number
): Map<Color, number> {
    const vigor = new Map<Color, number>(state.colonies.map((colony) => [colony.color, 0]))
    for (const region of scoringZone(activeRegion)) {
        for (const habitat of habitatsInRegion(region)) {
            for (const occupant of state.board.habitat(habitat.id).occupants) {
                const locustVigor = LocustVigor + (habitat.island ? IslandLocustBonusVigor : 0)
                const points =
                    occupant.grasshopper * GrasshopperVigor +
                    occupant.locust * locustVigor +
                    occupant.nymph * NymphVigor
                vigor.set(occupant.color, (vigor.get(occupant.color) ?? 0) + points)
            }
        }
    }
    return vigor
}

// Most insects wins; ties go to the higher quadrant, which is the earlier occupant.
export function majorityRanking(state: HydratedLocustGameState, habitatId: string): Color[] {
    return state.board
        .habitat(habitatId)
        .occupants.map((occupant, quadrant) => ({ occupant, quadrant }))
        .sort(
            (a, b) =>
                occupantDiscs(b.occupant) - occupantDiscs(a.occupant) || a.quadrant - b.quadrant
        )
        .map(({ occupant }) => occupant.color)
}

export function scoreActiveRegion(state: HydratedLocustGameState): RegionScoringResult {
    const isFinalScoring = state.scoringsDone === ScoringCount - 1
    const vigor = vigorInZone(state, state.activeRegion)
    for (const [color, amount] of vigor) {
        state.colony(color).vigor += amount
    }

    const majorities: MajorityResult[] = []
    for (const habitat of habitatsInRegion(majorityRegion(state.activeRegion))) {
        const [winner, runnerUp] = majorityRanking(state, habitat.id)
        if (winner !== undefined) {
            const colony = state.colony(winner)
            colony.tokens.push(majorityToken(getHabitat(habitat.id).color))
            if (isFinalScoring) {
                colony.vigor += FinalScoringMajorityVigor
            }
        }
        if (runnerUp !== undefined) {
            state.colony(runnerUp).hatch(1)
        }
        majorities.push({ habitatId: habitat.id, winner, runnerUp })
    }

    state.scoringsDone += 1
    const killed = new Map<Color, number>()
    if (state.scoringsDone < ScoringCount) {
        state.activeRegion += 1
        for (const region of killingZone(state.activeRegion)) {
            for (const habitat of habitatsInRegion(region)) {
                for (const { color, died } of state.board.clearHabitat(habitat.id)) {
                    state.colony(color).die(died)
                    killed.set(color, (killed.get(color) ?? 0) + died)
                }
            }
        }
    } else {
        applyFinalBonuses(state)
    }

    const toAmounts = (amounts: Map<Color, number>) =>
        [...amounts].map(([color, amount]) => ({ color, amount }))
    return { vigor: toAmounts(vigor), majorities, killed: toAmounts(killed) }
}

// Sets of distinct tokens score triangular numbers, so building the largest sets first is optimal.
export function bonusSetPoints(tokens: BonusToken[]): number {
    const counts = BonusTokenTypes.map((type) => tokens.filter((token) => token === type).length)
    let points = 0
    while (counts.some((count) => count > 0)) {
        const setSize = counts.filter((count) => count > 0).length
        points += BonusSetPoints[setSize] ?? 0
        counts.forEach((count, index) => {
            counts[index] = Math.max(0, count - 1)
        })
    }
    return points
}

export function supplyBonuses(supplies: Map<Color, number>): Map<Color, number> {
    const bonuses = new Map<Color, number>([...supplies.keys()].map((color) => [color, 0]))
    const values = [...new Set(supplies.values())].sort((a, b) => b - a)
    const most = values[0]
    if (most === undefined) {
        return bonuses
    }
    const leaders = [...supplies].filter(([, supply]) => supply === most)
    if (leaders.length > 1) {
        leaders.forEach(([color]) => bonuses.set(color, TiedMostSupplyBonus))
        return bonuses
    }
    leaders.forEach(([color]) => bonuses.set(color, MostSupplyBonus))
    const second = values[1]
    if (second !== undefined) {
        ;[...supplies]
            .filter(([, supply]) => supply === second)
            .forEach(([color]) => bonuses.set(color, RunnerUpSupplyBonus))
    }
    return bonuses
}

function applyFinalBonuses(state: HydratedLocustGameState) {
    const supplyPoints = supplyBonuses(
        new Map(state.colonies.map((colony) => [colony.color, colony.supply]))
    )
    for (const colony of state.colonies) {
        colony.finalScore = {
            setPoints: bonusSetPoints(colony.tokens),
            supplyPoints: supplyPoints.get(colony.color) ?? 0
        }
    }
}

export function colonyVigorTotal(state: HydratedLocustGameState, color: Color): number {
    const colony = state.colony(color)
    const supply = OpenRuleDefaults.supplyBonusIsBonusPoints
        ? 0
        : (colony.finalScore?.supplyPoints ?? 0)
    return colony.vigor + supply
}

export function colonyBonusTotal(state: HydratedLocustGameState, color: Color): number {
    const colony = state.colony(color)
    const supply = OpenRuleDefaults.supplyBonusIsBonusPoints
        ? (colony.finalScore?.supplyPoints ?? 0)
        : 0
    return (colony.finalScore?.setPoints ?? 0) + supply
}

export function playerScore(state: HydratedLocustGameState, playerId: string): number {
    const colonies = state.coloniesOf(playerId)
    if (!state.isDuel) {
        return colonies.reduce(
            (sum, colony) =>
                sum + colonyVigorTotal(state, colony.color) + colonyBonusTotal(state, colony.color),
            0
        )
    }
    const vigorColor = state.getPlayerState(playerId).vigorColor
    return colonies.reduce(
        (sum, colony) =>
            sum +
            (colony.color === vigorColor
                ? colonyVigorTotal(state, colony.color)
                : colonyBonusTotal(state, colony.color)),
        0
    )
}

// Tie breaker: cube position in Region F, left column bottom-up first, then the rest of F.
export function finalTiebreakOrder(state: HydratedLocustGameState): Color[] {
    const placed = spacesInTurnOrder(FinalRegion)
        .map((space) => state.board.cubeOn(space.id))
        .filter((color) => color !== undefined)
    const unlimited = [SpaceColumn.Left, SpaceColumn.Right].flatMap(
        (column) => state.board.unlimitedCubes[spaceId(FinalRegion, column, 1)] ?? []
    )
    return [...placed, ...unlimited]
}

export function determineWinners(state: HydratedLocustGameState): {
    result: GameResult
    winningPlayerIds: string[]
} {
    const scores = state.players.map((player) => ({
        playerId: player.playerId,
        score: playerScore(state, player.playerId)
    }))
    const best = Math.max(...scores.map((entry) => entry.score))
    const tied = scores.filter((entry) => entry.score === best).map((entry) => entry.playerId)
    if (tied.length === 1) {
        return { result: GameResult.Win, winningPlayerIds: tied }
    }
    const order = finalTiebreakOrder(state)
    const tiebreakWinner = order
        .map((color) => state.colony(color).playerId)
        .find((playerId) => tied.includes(playerId))
    return tiebreakWinner === undefined
        ? { result: GameResult.Draw, winningPlayerIds: tied }
        : { result: GameResult.Win, winningPlayerIds: [tiebreakWinner] }
}
