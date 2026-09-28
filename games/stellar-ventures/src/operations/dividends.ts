import { CorporationStatus } from '../model/corporation.js'

/**
 * The Dividend payout table, transcribed directly from the game board (far left side, next to
 * the Corporation Status legend). Indexed by "row" 0-13 (13 standing in for the printed "13+").
 *
 * The board actually prints two side-by-side tables:
 *   - CARGO / MINING CAPACITY: maps a raw Cargo value (0-13, direct) or a raw Mining Capacity
 *     value (0-39+, banded in groups of 3 - see dividendRowForMiningCapacity) to this same
 *     shared row number.
 *   - The payout table below, keyed by Corporate Status (Private/Minor/Major - see
 *     CorporationState.status): the actual ₮ amount paid per Share held.
 *
 * Per the rulebook: "Compare the rows of the Mining Capacity and CARGO tokens. The lower token
 * sets the payout row." (see dividendRowForCorporation).
 */
export const DividendPayoutTable: Record<
    number,
    Record<CorporationStatus, number>
> = {
    0: { [CorporationStatus.Private]: 2, [CorporationStatus.Minor]: 1, [CorporationStatus.Major]: 1 },
    1: { [CorporationStatus.Private]: 2, [CorporationStatus.Minor]: 1, [CorporationStatus.Major]: 1 },
    2: { [CorporationStatus.Private]: 4, [CorporationStatus.Minor]: 2, [CorporationStatus.Major]: 1 },
    3: { [CorporationStatus.Private]: 6, [CorporationStatus.Minor]: 3, [CorporationStatus.Major]: 2 },
    4: { [CorporationStatus.Private]: 8, [CorporationStatus.Minor]: 4, [CorporationStatus.Major]: 2 },
    5: { [CorporationStatus.Private]: 10, [CorporationStatus.Minor]: 5, [CorporationStatus.Major]: 3 },
    6: { [CorporationStatus.Private]: 12, [CorporationStatus.Minor]: 6, [CorporationStatus.Major]: 3 },
    7: { [CorporationStatus.Private]: 14, [CorporationStatus.Minor]: 7, [CorporationStatus.Major]: 4 },
    8: { [CorporationStatus.Private]: 16, [CorporationStatus.Minor]: 8, [CorporationStatus.Major]: 4 },
    9: { [CorporationStatus.Private]: 18, [CorporationStatus.Minor]: 9, [CorporationStatus.Major]: 5 },
    10: { [CorporationStatus.Private]: 20, [CorporationStatus.Minor]: 10, [CorporationStatus.Major]: 5 },
    11: { [CorporationStatus.Private]: 22, [CorporationStatus.Minor]: 11, [CorporationStatus.Major]: 6 },
    12: { [CorporationStatus.Private]: 24, [CorporationStatus.Minor]: 12, [CorporationStatus.Major]: 6 },
    13: { [CorporationStatus.Private]: 26, [CorporationStatus.Minor]: 13, [CorporationStatus.Major]: 7 }
}

export const MAX_DIVIDEND_ROW = 13

// Cargo maps directly onto the shared row number (it's printed 0-13+ on the board, with no
// sub-banding), just capped at MAX_DIVIDEND_ROW.
export function dividendRowForCargo(cargo: number): number {
    return Math.max(0, Math.min(MAX_DIVIDEND_ROW, cargo))
}

// Mining Capacity is printed in bands of 3 (1-3 -> row 1, 4-6 -> row 2, ..., 37-39 -> row 13,
// and anything beyond via the "40+" overflow marker also caps at row 13, same as Cargo).
export function dividendRowForMiningCapacity(miningCapacity: number): number {
    if (miningCapacity <= 0) {
        return 0
    }
    return Math.min(MAX_DIVIDEND_ROW, Math.ceil(miningCapacity / 3))
}

// The amount paid to Frozen Funds for EACH Share held, per the rulebook: "Compare the rows of
// the Mining Capacity and CARGO tokens. The lower token sets the payout row. Check Corporate
// Status for the payout column."
export function dividendPayoutPerShare(
    cargo: number,
    miningCapacity: number,
    status: CorporationStatus
): number {
    const row = Math.min(dividendRowForCargo(cargo), dividendRowForMiningCapacity(miningCapacity))
    return DividendPayoutTable[row]![status]
}
