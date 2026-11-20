import { OreKind } from '../data/mineTokens.js'
import { CardKind, getCard } from '../data/cards.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import type { HydratedRockyVenturesPlayerState } from '../model/playerState.js'
import { FirstEraCardId, SecondEraCardId, ThirdEraCardId } from './market.js'
import { recordVictoryPoints } from './stats.js'

// The player who buys a Feast card scores a bonus for where they rank in that Feast's category
// (Justin, 2026-11-13). Ties share the rank; 4th place and below score nothing.
export const FeastBuyerBonuses: Record<string, { points: number[]; measure: (state: HydratedRockyVenturesGameState, player: HydratedRockyVenturesPlayerState) => number }> = {
    // The Lantern Feast: position on the tool track.
    [FirstEraCardId]: { points: [3, 2, 1], measure: (_state, player) => player.toolLevel },
    // The Feast of the Deep Seam: share multipliers held.
    [SecondEraCardId]: {
        points: [4, 3, 2],
        measure: (state, player) =>
            player.shares.reduce((sum, share) => sum + state.getCompany(share.companyId).multiplierForShare(share.shareIndex), 0)
    },
    // The Golden Table: gold mines the player currently holds a claim on (Justin, 2026-11-17).
    [ThirdEraCardId]: {
        points: [5, 4, 3],
        measure: (state, player) =>
            Object.values(state.board.mines).filter(
                (site) => site?.ownerPlayerId === player.playerId && site.token?.ore === OreKind.Gold
            ).length
    }
}

type Measure = (state: HydratedRockyVenturesGameState, player: HydratedRockyVenturesPlayerState) => number

// The three possible Feasts for each Feast card (Justin, 2026-11-20). Each game draws one per card
// at setup; the card keeps its slot's points (1st / 2nd / 3rd).
export interface FeastCategory {
    id: string
    cardId: string
    name: string
    // What it counts, for labels: "tool level", "Mana mines held"...
    measureLabel: string
    shortLabel: string
    measure: Measure
}

const minesHeld = (ore: OreKind): Measure => (state, player) =>
    Object.values(state.board.mines).filter((site) => site?.ownerPlayerId === player.playerId && site.token?.ore === ore).length

export const FeastCategories: FeastCategory[] = [
    { id: 'tool', cardId: FirstEraCardId, name: 'Feast of the Lantern', measureLabel: 'tool level', shortLabel: 'TOOL', measure: (_state, player) => player.toolLevel },
    { id: 'weapon', cardId: FirstEraCardId, name: 'Feast of the Forge', measureLabel: 'weapon level', shortLabel: 'WEAPON', measure: (_state, player) => player.weaponLevel },
    { id: 'manaMines', cardId: FirstEraCardId, name: 'Feast of the Mana Spring', measureLabel: 'mines held that give Mana', shortLabel: 'MANA', measure: minesHeld(OreKind.Silver) },
    { id: 'hits', cardId: SecondEraCardId, name: 'Feast of the Warrior', measureLabel: 'hits (battle axe)', shortLabel: 'HITS', measure: (_state, player) => player.huntHits ?? 0 },
    { id: 'shares', cardId: SecondEraCardId, name: 'Feast of the Mogul', measureLabel: 'share multipliers', shortLabel: 'SHARES', measure: FeastBuyerBonuses[SecondEraCardId]!.measure },
    { id: 'gems', cardId: SecondEraCardId, name: 'Feast of the Hoard', measureLabel: 'unspent gems', shortLabel: 'GEMS', measure: (_state, player) => player.gems },
    { id: 'goldMines', cardId: ThirdEraCardId, name: 'Feast of the Deep Seam', measureLabel: 'gold mines held', shortLabel: 'GOLD', measure: minesHeld(OreKind.Gold) },
    { id: 'emptyMines', cardId: ThirdEraCardId, name: 'Feast of the Hollow', measureLabel: 'empty mines (Mana tokens kept)', shortLabel: 'EMPTY', measure: (_state, player) => player.emptyMines ?? 0 },
    {
        id: 'devCards',
        cardId: ThirdEraCardId,
        name: 'Feast of the Guild',
        measureLabel: 'development cards in tableau',
        shortLabel: 'CARDS',
        measure: (_state, player) => player.tableau.filter((cardId) => getCard(cardId).kind === CardKind.Development).length
    }
]

export const FeastCategoriesById: Record<string, FeastCategory> = Object.fromEntries(FeastCategories.map((category) => [category.id, category]))

// One Feast per card, drawn at setup.
export function pickFeastCategories(random: () => number): Record<string, string> {
    const picks: Record<string, string> = {}
    for (const cardId of [FirstEraCardId, SecondEraCardId, ThirdEraCardId]) {
        const options = FeastCategories.filter((category) => category.cardId === cardId)
        picks[cardId] = options[Math.floor(random() * options.length)]!.id
    }
    return picks
}

// This game's Feast for a Feast card, if it uses the drawn Feasts.
export function feastCategoryFor(state: HydratedRockyVenturesGameState, cardId: string): FeastCategory | undefined {
    const id = state.feastCategories?.[cardId]
    return id ? FeastCategoriesById[id] : undefined
}

// Points by rank and what is ranked, for this game's Feast card.
export function feastBonusRule(state: HydratedRockyVenturesGameState, cardId: string): { points: number[]; measure: Measure } | undefined {
    const bonus = FeastBuyerBonuses[cardId]
    if (!bonus) return undefined
    const category = feastCategoryFor(state, cardId)
    return { points: bonus.points, measure: category?.measure ?? bonus.measure }
}

export function feastBuyerBonus(state: HydratedRockyVenturesGameState, playerId: string, cardId: string): number {
    const bonus = feastBonusRule(state, cardId)
    if (!state.feastBuyerBonus || !bonus) {
        return 0
    }
    const mine = bonus.measure(state, state.getPlayerState(playerId))
    const rank = 1 + state.players.filter((player) => bonus.measure(state, player) > mine).length
    return bonus.points[rank - 1] ?? 0
}

export function scoreFeastBuyerBonus(state: HydratedRockyVenturesGameState, playerId: string, cardId: string) {
    const points = feastBuyerBonus(state, playerId, cardId)
    if (points > 0) {
        state.getPlayerState(playerId).addVictoryPoints(points)
        recordVictoryPoints(state, playerId, points, 'feastBonus', { cardId })
    }
}
