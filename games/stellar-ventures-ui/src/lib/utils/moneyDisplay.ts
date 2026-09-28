import money1 from '$lib/images/currency/money1.png'
import money5 from '$lib/images/currency/money5.png'
import money10 from '$lib/images/currency/money10.png'
import money50 from '$lib/images/currency/money50.png'

// The four physical Money token denominations cut from the game's punchboard, largest first so
// callers building a "how you'd actually pay this out at the table" breakdown (see
// moneyBreakdown below) can greedily consume them in the order a player would reach for them.
export const MoneyDenominations = [50, 10, 5, 1] as const
export type MoneyDenomination = (typeof MoneyDenominations)[number]

export const MoneyTokenIcons: Record<MoneyDenomination, string> = {
    50: money50,
    10: money10,
    5: money5,
    1: money1
}

export type MoneyBreakdownEntry = { denomination: MoneyDenomination; count: number }

// Greedy largest-denomination-first breakdown of a Credits amount into physical Money tokens -
// e.g. 47 -> [{denomination:10,count:4},{denomination:5,count:1},{denomination:1,count:2}] -
// mirrors how a player would actually make change with the token set on the table. Zero-count
// denominations are omitted, so a caller rendering one "stack" per entry never shows more than
// MoneyDenominations.length icons regardless of how large the amount is.
export function moneyBreakdown(amount: number): MoneyBreakdownEntry[] {
    let remaining = Math.max(0, Math.trunc(amount))
    const result: MoneyBreakdownEntry[] = []
    for (const denomination of MoneyDenominations) {
        const count = Math.floor(remaining / denomination)
        if (count > 0) {
            result.push({ denomination, count })
            remaining -= count * denomination
        }
    }
    return result
}
