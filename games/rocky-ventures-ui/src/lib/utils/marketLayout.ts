// Art-space (2000 x 1481) boxes of the development-card slots printed down the right edge of the
// v0.50 board. Cards sit rotated 90 degrees clockwise (card top to the right), like the labels.
export interface MarketSlotBox {
    x: number
    y: number
    width: number
    height: number
}

export const MarketSlotBoxWidth = 238
export const MarketSlotBoxHeight = 169
const SlotX = 1637

export const DrawPileBox: MarketSlotBox = { x: SlotX, y: 81, width: MarketSlotBoxWidth, height: MarketSlotBoxHeight }

// Indexed like the market slots: 0 = $1 (bottom) ... 4 = $8 (top).
export const MarketSlotBoxes: MarketSlotBox[] = [996, 813, 630, 447, 264].map((y) => ({
    x: SlotX,
    y,
    width: MarketSlotBoxWidth,
    height: MarketSlotBoxHeight
}))
