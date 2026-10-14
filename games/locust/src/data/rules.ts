import { Color } from '@tabletop/common'

export const MinPlayers = 2
export const MaxPlayers = 4
export const DuelPlayerCount = 2

export const ColonyColors = [Color.Green, Color.Yellow, Color.Blue, Color.Red]

export const DiscsPerColony = 15
export const StartingSupply = 9
export const CubesPerColonyByColonyCount: Record<number, number> = { 3: 4, 4: 3 }

export const ScoringCount = 5

export const GrasshopperVigor = 2
export const LocustVigor = 1
export const NymphVigor = 0
export const IslandLocustBonusVigor = 1
export const FinalScoringMajorityVigor = 3

export const AlternativeActionLevel = 1
export const LevelBoost = 1

// 1/3/6/10/15/21/28 bonus points for a set of 1-7 distinct bonus token types.
export const BonusSetPoints = [0, 1, 3, 6, 10, 15, 21, 28]

export const MostSupplyBonus = 4
export const RunnerUpSupplyBonus = 2
export const TiedMostSupplyBonus = 3

// Defaults for rules the v0.42 rulebook leaves open; each is applied in exactly one place.
export const WhiteCubeRegion = 0
export const WhiteCubeColonyCount = 4

export const OpenRuleDefaults = {
    // The white 4-player cube sits beside Region I and adds one rain there (Justin, 2026-10-14).
    whiteCubeIsRain: true,
    // Region F's crowding limit counts every cube there, including the two unlimited spaces.
    unlimitedSpacesCountAsRain: true,
    // Actions are "up to" their level, so taking zero is allowed and doubles as passing.
    allowEmptyAction: true,
    // In Duel every other colour, including your own second colour, can be cannibalized ("another colour").
    duelCannibalizeOwnSecondColor: true,
    // Supply bonus points count toward a Duel colour's Bonus Points rather than its Vigor Points.
    supplyBonusIsBonusPoints: true,
    // The Alternative Action is never boosted by the Level +1 region.
    alternativeActionBoosted: false
} as const
