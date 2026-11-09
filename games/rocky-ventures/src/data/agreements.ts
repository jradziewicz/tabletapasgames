// A-D are the original agreements, shuffled into each city's pile. Games set up from 2026-11-03
// use the two-sided agreements 1-4 instead, piled in order with 1 on top.
export enum AgreementLetter {
    A = 'A',
    B = 'B',
    C = 'C',
    D = 'D',
    One = '1',
    Two = '2',
    Three = '3',
    Four = '4'
}

export const AgreementLetters: AgreementLetter[] = [
    AgreementLetter.A,
    AgreementLetter.B,
    AgreementLetter.C,
    AgreementLetter.D
]

export const TwoSidedAgreementLetters: AgreementLetter[] = [
    AgreementLetter.One,
    AgreementLetter.Two,
    AgreementLetter.Three,
    AgreementLetter.Four
]

export function isTwoSidedAgreement(letter: AgreementLetter): boolean {
    return TwoSidedAgreementLetters.includes(letter)
}

// Front of a two-sided agreement: after a gold sale into its city, buy VP once for this much cash.
export const TwoSidedAgreementPointBuys: Partial<
    Record<AgreementLetter, { cost: number; victoryPoints: number }>
> = {
    [AgreementLetter.One]: { cost: 3, victoryPoints: 3 },
    [AgreementLetter.Two]: { cost: 5, victoryPoints: 4 },
    [AgreementLetter.Three]: { cost: 7, victoryPoints: 5 },
    [AgreementLetter.Four]: { cost: 9, victoryPoints: 6 }
}

// In games from 2026-11-09 the front scores outright: a gold sale into its city gains this many VP.
export const TwoSidedAgreementDeliveryPoints: Partial<Record<AgreementLetter, number>> = {
    [AgreementLetter.One]: 2,
    [AgreementLetter.Two]: 3,
    [AgreementLetter.Three]: 4,
    [AgreementLetter.Four]: 5
}

// Taking a second agreement from a city flips the player's earlier one to its back, so only the
// newest front (point buy) is ever active per city.
export enum AgreementBackEffect {
    GoldOreBonus = 'goldOreBonus',
    ExpenseDiscount = 'expenseDiscount',
    IgnoreDragon = 'ignoreDragon',
    None = 'none'
}

export const TwoSidedAgreementBacks: Partial<Record<AgreementLetter, AgreementBackEffect>> = {
    [AgreementLetter.One]: AgreementBackEffect.GoldOreBonus,
    [AgreementLetter.Two]: AgreementBackEffect.ExpenseDiscount,
    [AgreementLetter.Three]: AgreementBackEffect.IgnoreDragon,
    [AgreementLetter.Four]: AgreementBackEffect.None
}

export const AgreementDescriptions: Record<AgreementLetter, string> = {
    [AgreementLetter.A]: '+$2 per gold ore sold into this city',
    [AgreementLetter.B]: "+$2 per silver ore from mines in this city's half of the map",
    [AgreementLetter.C]: '-$3 transport/terrain/scourge costs for a sale into this city',
    [AgreementLetter.D]: 'After a gold delivery into this city, buy 3 VP for $6 from that income (not after silver sales)',
    [AgreementLetter.One]: 'After a gold sale into this city, buy 3 VP for $3',
    [AgreementLetter.Two]: 'After a gold sale into this city, buy 4 VP for $5',
    [AgreementLetter.Three]: 'After a gold sale into this city, buy 5 VP for $7',
    [AgreementLetter.Four]: 'After a gold sale into this city, buy 6 VP for $9'
}

export const AgreementBackDescriptions: Record<AgreementBackEffect, string> = {
    [AgreementBackEffect.GoldOreBonus]: '+$2 per gold ore sold into this city',
    [AgreementBackEffect.ExpenseDiscount]: '-$3 expenses for a gold sale into this city',
    [AgreementBackEffect.IgnoreDragon]: 'No Dragon cost for a gold sale into this city',
    [AgreementBackEffect.None]: 'No effect'
}

export const AgreementGoldOreBonus = 2
export const AgreementSilverOreBonus = 2
export const AgreementTransportDiscount = 3
export const AgreementPointBuyCost = 6
export const AgreementPointBuyVictoryPoints = 3
export const AgreementDiscardFreeTracks = 2
