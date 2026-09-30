export enum WeaponTokenKind {
    Hit = 'hit',
    Miss = 'miss',
    BonusGold = 'bonusGold',
    BonusWeaponLevel = 'bonusWeaponLevel',
    BonusGem = 'bonusGem',
    BonusInvest = 'bonusInvest'
}

// RV-v050 square chits: 23 hit, 30 miss, 3 of each bonus.
export const StartingWeaponBag: Record<WeaponTokenKind, number> = {
    [WeaponTokenKind.Hit]: 23,
    [WeaponTokenKind.Miss]: 30,
    [WeaponTokenKind.BonusGold]: 3,
    [WeaponTokenKind.BonusWeaponLevel]: 3,
    [WeaponTokenKind.BonusGem]: 3,
    [WeaponTokenKind.BonusInvest]: 3
}

export const BonusGoldAmount = 3
export const BonusGemMinimumWeaponLevel = 2
export const BonusInvestMinimumWeaponLevel = 4
export const VictoryPointsPerHit = 2

export interface HuntDrawRule {
    draw: number
    apply: number
}

export const HuntDrawRuleByWeaponLevel: Record<number, HuntDrawRule> = {
    1: { draw: 1, apply: 1 },
    2: { draw: 2, apply: 1 },
    3: { draw: 3, apply: 2 },
    4: { draw: 4, apply: 2 },
    5: { draw: 5, apply: 3 }
}
