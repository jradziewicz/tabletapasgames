// Setup constants from the draft rulebook.
// Money for the first player to act; each later seat starts with $1 more (see initializer)
export const StartingMoney = 15
export const StartingGems = 2
export const StartingClaimTokens = 4
export const StartingVictoryPoints = 10
export const StartingWeaponLevel = 1
export const StartingToolLevel = 1

// Market slots in order from oldest ($1) to newest ($8); cards slide toward index 0.
export const MarketSlotPrices: number[] = [1, 2, 3, 5, 8]
export const MarketSize = MarketSlotPrices.length
export const DornochGoldPriceSlotIndex = 3
export const SilverPriceSlotIndex = 2
export const ManorGoldPriceSlotIndex = 1
export const TaxSlotIndex = 0

// Printed on the board next to each price slot; used once that market slot is empty.
export const EmptySlotDornochGoldPrice = 10
export const EmptySlotManorGoldPrice = 9
export const EmptySlotSilverPrice = 6

export const DornochDurStartingMineLevel = 5

// Every railroad company starts with $5 in its treasury (Justin, 2026-09-28; rulebook pending).
export const StartingCompanyTreasury = 5

// Gem-spend end trigger: 9 gems spent in a 3 player game, 12 in a 4-5 player game (the board's gem
// track markers read "3" on the 9th hex and "4/5" on the 12th; Justin, 2026-09-29).
export function gemTriggerThreshold(playerCount: number): number {
    if (playerCount <= 2) {
        return 6
    }
    return playerCount >= 4 ? 12 : 9
}

export const MinPlayers = 2
export const MaxPlayers = 5

export const TaxBaseIncome = 2
export function taxIncomeFor(tuckedCount: number): number {
    return TaxBaseIncome + tuckedCount
}
export const PawnSkipCost = 1
