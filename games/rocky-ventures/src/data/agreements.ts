export enum AgreementLetter {
    A = 'A',
    B = 'B',
    C = 'C',
    D = 'D'
}

export const AgreementLetters: AgreementLetter[] = [
    AgreementLetter.A,
    AgreementLetter.B,
    AgreementLetter.C,
    AgreementLetter.D
]

export const AgreementDescriptions: Record<AgreementLetter, string> = {
    [AgreementLetter.A]: '+$2 per gold ore sold into this city',
    [AgreementLetter.B]: "+$2 per silver ore from mines in this city's half of the map",
    [AgreementLetter.C]: '-$3 transport/terrain/scourge costs for a sale into this city',
    [AgreementLetter.D]: 'After an extract & sell into this city, buy 3 VP for $6 from that income'
}

export const AgreementGoldOreBonus = 2
export const AgreementSilverOreBonus = 2
export const AgreementTransportDiscount = 3
export const AgreementPointBuyCost = 6
export const AgreementPointBuyVictoryPoints = 3
export const AgreementDiscardFreeTracks = 2
