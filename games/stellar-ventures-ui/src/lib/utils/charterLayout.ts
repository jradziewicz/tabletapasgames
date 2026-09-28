import { CHARTER_ASPECT } from './corporationDisplay.js'
import { POWER_CARD_ASPECT } from './corporatePowerImages.js'

// Shared Charter-notch geometry, measured directly against the Charter art (2127x1536) - see
// CorporationCharterWithPowers.svelte for the full measurement notes on where these numbers come
// from. Re-exported here so anything that overlays its own Power art onto a Charter image OUTSIDE
// that component (the Sign The Agreement walkthrough's step 1/5 overlays in Board.svelte) lines
// up with the exact same slots, rather than hand-copying these magic numbers a second time.
export const CHARTER_EDGE_TOP_PCT = (1450 / 1536) * 100

const RAW_NOTCH_SLOTS = [
    { left: (610 / 2127) * 100, width: ((1148 - 610) / 2127) * 100 },
    { left: (1407 / 2127) * 100, width: ((1945 - 1407) / 2127) * 100 }
]
// Sized to sit flush with the notch (99% of its width - just enough to leave the notch's own
// scalloped stroke visible at the edges), per the co-designer. Re-centered within the notch span
// so the 1% shrink comes off both edges evenly.
const NOTCH_CARD_SCALE = 0.99
export const CHARTER_NOTCH_SLOTS = RAW_NOTCH_SLOTS.map((slot) => {
    const width = slot.width * NOTCH_CARD_SCALE
    const left = slot.left + (slot.width - width) / 2
    return { left, width }
})

// A card's rendered height, as a % of the Charter box's OWN height (not width) - needed to stack
// a second row of overlaid cards directly beneath the first with no gap, since these are all
// positioned absolutely (with no normal-flow height of their own to stack against).
export const CHARTER_NOTCH_CARD_HEIGHT_PCT_OF_CHARTER =
    (CHARTER_NOTCH_SLOTS[0]!.width * CHARTER_ASPECT) / POWER_CARD_ASPECT
