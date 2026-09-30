import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { RockyVenturesPlayerState, HydratedRockyVenturesPlayerState } from './playerState.js'
import { CompanyState, HydratedCompanyState } from './company.js'
import { BoardState, HydratedBoardState } from './board.js'
import { MineToken } from '../data/mineTokens.js'
import { CompanyId } from '../data/companies.js'
import { AgreementLetter } from '../data/agreements.js'
import { WeaponTokenKind } from '../data/weaponBag.js'
import { MachineState } from '../definition/states.js'
import { type Card, type CardAction, CardBonusKind, CardKind, cardPrices, getCard } from '../data/cards.js'
import {
    DornochGoldPriceSlotIndex,
    EmptySlotDornochGoldPrice,
    EmptySlotManorGoldPrice,
    EmptySlotSilverPrice,
    ManorGoldPriceSlotIndex,
    SilverPriceSlotIndex
} from '../data/setup.js'
import { DeliveryCityId } from '../data/board.js'
import { StatEvent } from './stats.js'
import { DummyState } from './dummy.js'

export type MarketState = Type.Static<typeof MarketState>
export const MarketState = Type.Object({
    drawPile: Type.Array(Type.String()),
    slots: Type.Array(Type.String())
})

export type MineSupplies = Type.Static<typeof MineSupplies>
export const MineSupplies = Type.Object({
    goldA: Type.Array(MineToken),
    goldB: Type.Array(MineToken),
    silverA: Type.Array(MineToken),
    silverB: Type.Array(MineToken)
})

export type DragonState = Type.Static<typeof DragonState>
export const DragonState = Type.Object({
    trackerTokens: Type.Array(Type.Enum(WeaponTokenKind)),
    summoned: Type.Boolean(),
    hits: Type.Number(),
    killed: Type.Boolean()
})

export type PendingShare = Type.Static<typeof PendingShare>
export const PendingShare = Type.Object({
    companyIds: Type.Array(Type.Enum(CompanyId)),
    amount: Type.Number(),
    cardId: Type.Optional(Type.String())
})

export type PendingAgreementBuy = Type.Static<typeof PendingAgreementBuy>
export const PendingAgreementBuy = Type.Object({
    cityId: Type.Enum(DeliveryCityId),
    income: Type.Number()
})

export type FreeTrackState = Type.Static<typeof FreeTrackState>
export const FreeTrackState = Type.Object({
    companyId: Type.Enum(CompanyId),
    remaining: Type.Number(),
    agreement: Type.String(),
    resumeState: Type.Enum(MachineState)
})

export type PendingHunt = Type.Static<typeof PendingHunt>
export const PendingHunt = Type.Object({
    region: Type.String(),
    drawn: Type.Array(Type.Enum(WeaponTokenKind)),
    apply: Type.Number()
})

export type PointBuyState = Type.Static<typeof PointBuyState>
export const PointBuyState = Type.Object({
    cardId: Type.String(),
    queue: Type.Array(Type.String())
})

export type RockyVenturesGameState = Type.Static<typeof RockyVenturesGameState>
export const RockyVenturesGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(RockyVenturesPlayerState),
            machineState: Type.Enum(MachineState),
            board: BoardState,
            companies: Type.Array(CompanyState),
            market: MarketState,
            mineSupplies: MineSupplies,
            scourgeDeck: Type.Array(Type.String()),
            removedScourges: Type.Array(Type.String()),
            weaponBag: Type.Record(Type.String(), Type.Number()),
            dragon: DragonState,
            agreementStacks: Type.Record(Type.String(), Type.Array(Type.Enum(AgreementLetter))),
            gemsSpent: Type.Number(),
            era: Type.Number(),
            turnActionsTaken: Type.Array(Type.String()),
            turnTrackCompanies: Type.Array(Type.String()),
            turnOver: Type.Boolean(),
            pendingShare: Type.Optional(PendingShare),
            pointBuy: Type.Optional(PointBuyState),
            pendingHunt: Type.Optional(PendingHunt),
            pendingAgreementBuy: Type.Optional(PendingAgreementBuy),
            freeTrack: Type.Optional(FreeTrackState),
            bonusInvest: Type.Optional(Type.Boolean()),
            borrowedCardId: Type.Optional(Type.String()),
            immediateCardId: Type.Optional(Type.String()),
            immediateStart: Type.Optional(Type.Number()),
            turnCopied: Type.Optional(Type.Boolean()),
            statEvents: Type.Array(StatEvent),
            dummy: Type.Optional(DummyState)
        })
    ])
)

export const RockyVenturesGameStateValidator = Compile(RockyVenturesGameState)

export class HydratedRockyVenturesGameState
    extends HydratableGameState<typeof RockyVenturesGameState, HydratedRockyVenturesPlayerState>
    implements RockyVenturesGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedRockyVenturesPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedBoardState
    declare companies: HydratedCompanyState[]
    declare market: MarketState
    declare mineSupplies: MineSupplies
    declare scourgeDeck: string[]
    declare removedScourges: string[]
    declare weaponBag: Record<string, number>
    declare dragon: DragonState
    declare agreementStacks: Record<string, AgreementLetter[]>
    declare gemsSpent: number
    declare era: number
    declare turnActionsTaken: string[]
    declare turnTrackCompanies: string[]
    declare turnOver: boolean
    declare pendingShare?: PendingShare
    declare pointBuy?: PointBuyState
    declare pendingHunt?: PendingHunt
    declare pendingAgreementBuy?: PendingAgreementBuy
    declare freeTrack?: FreeTrackState
    declare bonusInvest?: boolean
    declare borrowedCardId?: string
    declare immediateCardId?: string
    declare immediateStart?: number
    declare turnCopied?: boolean
    declare statEvents: StatEvent[]
    declare dummy?: DummyState

    constructor(data: RockyVenturesGameState) {
        super(data, RockyVenturesGameStateValidator)
        this.players = data.players.map((player) => new HydratedRockyVenturesPlayerState(player))
        this.companies = data.companies.map((company) => new HydratedCompanyState(company))
        this.board = new HydratedBoardState(data.board)
    }

    actionCardId(playerId: string): string | undefined {
        return this.immediateCardId ?? this.borrowedCardId ?? this.getPlayerState(playerId).pawnCardId
    }

    actionCardActions(playerId: string): CardAction[] {
        const cardId = this.actionCardId(playerId)
        if (cardId === undefined) {
            return []
        }
        const card = getCard(cardId)
        if (this.immediateCardId !== undefined) {
            return card.kind === CardKind.Development && card.bonus.kind === CardBonusKind.ImmediateAction
                ? [card.bonus.action]
                : []
        }
        if (card.kind !== CardKind.Player && card.kind !== CardKind.Development) {
            return []
        }
        return card.actions
    }

    get turnActionsSinceImmediate(): string[] {
        return this.immediateStart === undefined
            ? this.turnActionsTaken
            : this.turnActionsTaken.slice(this.immediateStart)
    }

    getCompany(companyId: CompanyId): HydratedCompanyState {
        const company = this.companies.find((candidate) => candidate.id === companyId)
        if (!company) {
            throw Error(`No company found with id ${companyId}`)
        }
        return company
    }

    marketCard(slotIndex: number): Card | undefined {
        const cardId = this.market.slots[slotIndex]
        return cardId === undefined ? undefined : getCard(cardId)
    }

    goldPriceFor(cityId: DeliveryCityId): number {
        const slotIndex =
            cityId === DeliveryCityId.Dornoch ? DornochGoldPriceSlotIndex : ManorGoldPriceSlotIndex
        const fallback =
            cityId === DeliveryCityId.Dornoch ? EmptySlotDornochGoldPrice : EmptySlotManorGoldPrice
        return this.priceFromSlot(slotIndex, 'goldPrice') ?? fallback
    }

    get silverPrice(): number {
        return this.priceFromSlot(SilverPriceSlotIndex, 'silverPrice') ?? EmptySlotSilverPrice
    }

    // The decade printed on the back of the top draw-pile card; undefined when the face-up Game
    // Over card is all that remains.
    get nextDrawPileDecade(): number | undefined {
        const cardId = this.market.drawPile[0]
        if (cardId === undefined) {
            return undefined
        }
        const card = getCard(cardId)
        switch (card.kind) {
            case CardKind.Development:
                return card.decade
            case CardKind.EndOfEra:
                return card.era + 1
            default:
                return undefined
        }
    }

    weaponTokensRemaining(kind: WeaponTokenKind): number {
        return this.weaponBag[kind] ?? 0
    }

    private priceFromSlot(slotIndex: number, key: 'goldPrice' | 'silverPrice'): number | undefined {
        const card = this.marketCard(slotIndex)
        return card ? cardPrices(card)?.[key] : undefined
    }
}
