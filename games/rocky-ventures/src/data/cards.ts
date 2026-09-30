import { CompanyId } from './companies.js'
import { RegionId } from './regions.js'
import { DeliveryCityId, DornochDurNodeId } from './board.js'

// Transcribed from RV-v050/v051 development cards, v043b/v051 player cards and v043b era cards
// (games/rocky-ventures/docs/component-data.md).

export enum CardActionKind {
    Invest = 'invest',
    Tax = 'tax',
    ClaimMine = 'claimMine',
    LayTrack = 'layTrack',
    ExtractAndSell = 'extractAndSell',
    Acquire = 'acquire',
    Hunt = 'hunt'
}

export interface InvestCardAction {
    kind: CardActionKind.Invest
}

export interface TaxCardAction {
    kind: CardActionKind.Tax
}

export interface ClaimMineCardAction {
    kind: CardActionKind.ClaimMine
    mines: number
    regionalHunts: number
    levelTwoMinesFree: boolean
}

export interface LayTrackCardAction {
    kind: CardActionKind.LayTrack
    maxTracks: number
    maxCompanies: number
}

export interface ExtractAndSellCardAction {
    kind: CardActionKind.ExtractAndSell
    disregardScourges: number
    bonusOre: number
    temporaryToolLevels: number
    addsScourge: boolean
}

export enum AcquireMode {
    Either = 'either',
    OneToolAndOneWeapon = 'oneToolAndOneWeapon'
}

export interface AcquireCardAction {
    kind: CardActionKind.Acquire
    levels: number
    mode: AcquireMode
}

export interface HuntCardAction {
    kind: CardActionKind.Hunt
    hunts: number
}

export type CardAction =
    | InvestCardAction
    | TaxCardAction
    | ClaimMineCardAction
    | LayTrackCardAction
    | ExtractAndSellCardAction
    | AcquireCardAction
    | HuntCardAction

export enum CardBonusKind {
    Share = 'share',
    Agreement = 'agreement',
    ImmediateAction = 'immediateAction'
}

export interface ShareCardBonus {
    kind: CardBonusKind.Share
    companyIds: [CompanyId, CompanyId]
}

export interface AgreementCardBonus {
    kind: CardBonusKind.Agreement
    cityId: DeliveryCityId
}

export interface ImmediateActionCardBonus {
    kind: CardBonusKind.ImmediateAction
    action: CardAction
}

export type CardBonus = ShareCardBonus | AgreementCardBonus | ImmediateActionCardBonus

export enum CardKind {
    Player = 'player',
    Development = 'development',
    EndOfEra = 'endOfEra',
    GameOver = 'gameOver'
}

export interface PlayerCard {
    id: string
    kind: CardKind.Player
    numeral: string
    // Either/or on card I; every other card performs all of its actions in any order.
    actions: CardAction[]
    exclusiveActions: boolean
}

export interface DevelopmentCard {
    id: string
    kind: CardKind.Development
    number: number
    cityNodeId?: string
    region?: RegionId
    decade: number
    baseCost: number
    bonus: CardBonus
    actions: CardAction[]
    goldPrice: number
    silverPrice: number
}

export interface EndOfEraCard {
    id: string
    kind: CardKind.EndOfEra
    era: 1 | 2
    baseCost: number
    pointBuyCost: number
    pointBuyVictoryPoints: number
    goldPrice: number
    silverPrice: number
}

export interface GameOverCard {
    id: string
    kind: CardKind.GameOver
    cashPerVictoryPoint: number
}

export type Card = PlayerCard | DevelopmentCard | EndOfEraCard | GameOverCard

const invest: InvestCardAction = { kind: CardActionKind.Invest }
const tax: TaxCardAction = { kind: CardActionKind.Tax }
const claimMine = (
    mines: number,
    regionalHunts: number,
    levelTwoMinesFree = false
): ClaimMineCardAction => ({ kind: CardActionKind.ClaimMine, mines, regionalHunts, levelTwoMinesFree })
const layTrack = (maxTracks: number, maxCompanies: number): LayTrackCardAction => ({
    kind: CardActionKind.LayTrack,
    maxTracks,
    maxCompanies
})
const extract = (
    options: Partial<Omit<ExtractAndSellCardAction, 'kind'>> = {}
): ExtractAndSellCardAction => ({
    kind: CardActionKind.ExtractAndSell,
    disregardScourges: 0,
    bonusOre: 0,
    temporaryToolLevels: 0,
    addsScourge: false,
    ...options
})
const acquire = (levels: number, mode: AcquireMode = AcquireMode.Either): AcquireCardAction => ({
    kind: CardActionKind.Acquire,
    levels,
    mode
})
const hunt = (hunts: number): HuntCardAction => ({ kind: CardActionKind.Hunt, hunts })

const share = (a: CompanyId, b: CompanyId): ShareCardBonus => ({
    kind: CardBonusKind.Share,
    companyIds: [a, b]
})
const agreement = (cityId: DeliveryCityId): AgreementCardBonus => ({
    kind: CardBonusKind.Agreement,
    cityId
})
const immediate = (action: CardAction): ImmediateActionCardBonus => ({
    kind: CardBonusKind.ImmediateAction,
    action
})

const WC = CompanyId.WizardCannonball
const DP = CompanyId.DwarvenPacific
const GCR = CompanyId.GoblinCentral
const WWR = CompanyId.WingedWyrm

export const DecadeBaseCost: Record<number, number> = { 1: 6, 2: 8, 3: 9, 4: 10 }

const development = (
    number: number,
    cityNodeId: string | undefined,
    region: RegionId | undefined,
    decade: number,
    bonus: CardBonus,
    actions: CardAction[],
    goldPrice: number,
    silverPrice: number
): DevelopmentCard => ({
    id: `d${String(number).padStart(2, '0')}`,
    kind: CardKind.Development,
    number,
    cityNodeId,
    region,
    decade,
    baseCost: DecadeBaseCost[decade],
    bonus,
    actions,
    goldPrice,
    silverPrice
})

export const PlayerCards: PlayerCard[] = [
    { id: 'p1', kind: CardKind.Player, numeral: 'I', actions: [invest, tax], exclusiveActions: true },
    { id: 'p2', kind: CardKind.Player, numeral: 'II', actions: [claimMine(1, 1)], exclusiveActions: false },
    { id: 'p3', kind: CardKind.Player, numeral: 'III', actions: [layTrack(2, 1)], exclusiveActions: false },
    { id: 'p4', kind: CardKind.Player, numeral: 'IV', actions: [extract()], exclusiveActions: false },
    { id: 'p5', kind: CardKind.Player, numeral: 'V', actions: [acquire(1)], exclusiveActions: false }
]

export const PlayerCardIds: string[] = PlayerCards.map((card) => card.id)
export const StartingPlayerCardId = 'p1'

export const DevelopmentCards: DevelopmentCard[] = [
    development(1, 'leuchars', RegionId.GoldValley, 1, share(WWR, GCR), [claimMine(1, 1, true)], 4, 4),
    development(2, 'arbroath', RegionId.ManorsGate, 1, share(WC, DP), [layTrack(2, 2)], 4, 4),
    development(3, 'graitney', RegionId.GoldValley, 1, share(WWR, DP), [extract(), hunt(1)], 5, 3),
    development(4, 'auchterarder', RegionId.ManorsGate, 1, share(WC, GCR), [acquire(1), hunt(1)], 5, 3),
    development(5, 'kiltarlity', RegionId.GoldValley, 1, agreement(DeliveryCityId.Dornoch), [claimMine(1, 1, true)], 5, 3),
    development(6, 'minnigaff', RegionId.ManorsGate, 1, agreement(DeliveryCityId.Manor), [layTrack(2, 2)], 5, 3),
    development(7, 'laggan', RegionId.GoldValley, 1, agreement(DeliveryCityId.Dornoch), [extract(), hunt(1)], 6, 2),
    development(8, 'lochranza', RegionId.Riverwood, 1, agreement(DeliveryCityId.Manor), [acquire(1), hunt(1)], 6, 2),
    development(9, 'merton', RegionId.GoldValley, 2, agreement(DeliveryCityId.Dornoch), [claimMine(2, 2)], 5, 5),
    development(10, 'northmavine', RegionId.IronsEnd, 2, agreement(DeliveryCityId.Manor), [layTrack(3, 1)], 5, 5),
    development(11, 'kirkoswald', RegionId.Riverwood, 2, share(WC, WWR), [extract({ disregardScourges: 1 }), layTrack(1, 1)], 5, 5),
    development(12, 'irongray', RegionId.IronsEnd, 2, share(GCR, DP), [acquire(2, AcquireMode.OneToolAndOneWeapon)], 6, 4),
    development(13, 'enzie', RegionId.Riverwood, 2, share(WWR, GCR), [claimMine(2, 2)], 6, 4),
    development(14, 'findogask', RegionId.IronsEnd, 2, share(WC, DP), [acquire(2, AcquireMode.OneToolAndOneWeapon)], 7, 3),
    development(15, 'tainsPeak', RegionId.IronsEnd, 2, share(WWR, DP), [layTrack(3, 1)], 6, 4),
    development(16, 'glenmoriston', RegionId.Riverwood, 2, share(WC, GCR), [extract({ disregardScourges: 1 }), layTrack(2, 1)], 7, 3),
    development(17, 'glenshiel', RegionId.IronsEnd, 3, share(WC, WWR), [hunt(2)], 7, 3),
    development(18, 'lintrathen', RegionId.Riverwood, 3, share(GCR, DP), [claimMine(2, 2), acquire(1)], 6, 6),
    development(19, 'drumelzier', RegionId.TheSpine, 3, share(WWR, GCR), [layTrack(3, 1), acquire(1)], 6, 6),
    development(20, 'fowlisEaster', RegionId.Riverwood, 3, share(WC, DP), [acquire(2)], 7, 5),
    development(21, 'lochwinnoch', RegionId.Southport, 3, agreement(DeliveryCityId.Dornoch), [extract({ bonusOre: 1, temporaryToolLevels: 1, addsScourge: true })], 7, 5),
    development(22, 'urquhart', RegionId.Riverwood, 3, agreement(DeliveryCityId.Manor), [claimMine(2, 2), acquire(1)], 7, 5),
    development(23, 'hoyGraemsay', RegionId.TheSpine, 3, share(WC, GCR), [layTrack(3, 2), acquire(1)], 8, 4),
    development(24, 'glenisla', RegionId.Southport, 3, share(WWR, DP), [extract({ bonusOre: 1, temporaryToolLevels: 1, addsScourge: true })], 8, 4),
    development(25, 'westKilbride', RegionId.Southport, 4, immediate(extract()), [acquire(2), hunt(2)], 7, 5),
    development(26, 'monquhitter', RegionId.TheSpine, 4, immediate(hunt(1)), [extract({ bonusOre: 2, temporaryToolLevels: 2, addsScourge: true }), claimMine(1, 1)], 7, 5),
    development(27, 'eastKilbride', RegionId.Southport, 4, immediate(acquire(1)), [layTrack(4, 2)], 8, 4),
    development(28, 'lochgoilhead', RegionId.Southport, 4, immediate(hunt(1)), [extract({ bonusOre: 2, temporaryToolLevels: 2, addsScourge: true }), claimMine(1, 1)], 9, 6),
    development(29, 'kirriemuir', RegionId.TheSpine, 4, immediate(acquire(1)), [layTrack(4, 2)], 9, 3),
    // Card 30 has no city printed on the v0.50 sheet (docs/rules-questions.md item 31).
    development(30, DornochDurNodeId, RegionId.TheSpine, 4, immediate(extract()), [acquire(2), hunt(2)], 8, 4)
]

export const EndOfEraCards: EndOfEraCard[] = [
    { id: 'era1', kind: CardKind.EndOfEra, era: 1, baseCost: 0, pointBuyCost: 10, pointBuyVictoryPoints: 5, goldPrice: 6, silverPrice: 6 },
    { id: 'era2', kind: CardKind.EndOfEra, era: 2, baseCost: 0, pointBuyCost: 15, pointBuyVictoryPoints: 5, goldPrice: 8, silverPrice: 8 }
]

export const GameOverCard: GameOverCard = { id: 'gameOver', kind: CardKind.GameOver, cashPerVictoryPoint: 5 }

export const AllCards: Card[] = [...PlayerCards, ...DevelopmentCards, ...EndOfEraCards, GameOverCard]

export const CardsById: Record<string, Card> = Object.fromEntries(AllCards.map((card) => [card.id, card]))

export function getCard(cardId: string): Card {
    const card = CardsById[cardId]
    if (!card) {
        throw Error(`Unknown card ${cardId}`)
    }
    return card
}

export function developmentCardIdsForDecade(decade: number): string[] {
    return DevelopmentCards.filter((card) => card.decade === decade).map((card) => card.id)
}

export function cardPrices(card: Card): { goldPrice: number; silverPrice: number } | undefined {
    if (card.kind === CardKind.Development || card.kind === CardKind.EndOfEra) {
        return { goldPrice: card.goldPrice, silverPrice: card.silverPrice }
    }
    return undefined
}
