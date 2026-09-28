import shipLevel1 from '$lib/images/ships/shipLevel1.png'
import shipLevel2 from '$lib/images/ships/shipLevel2.png'
import shipLevel3 from '$lib/images/ships/shipLevel3.png'
import shipLevel5 from '$lib/images/ships/shipLevel5.png'
import shipLevel8 from '$lib/images/ships/shipLevel8.png'

// Real vector Ship-icon renders (clean upright outlines, one per Ship level) - shared by every
// place a specific Ship's own art is needed: the Shipyard picker (ShipyardPanel.svelte) and the
// Corporation Charter's "Ordered Ships" tracker (CorporationCharter.svelte).
export const ShipLevelIcons: Record<number, string> = {
    1: shipLevel1,
    2: shipLevel2,
    3: shipLevel3,
    5: shipLevel5,
    8: shipLevel8
}

// Real ship-icon pixel aspect ratios (width/height) for each Ship level's own trimmed art - the
// actual shape being packed/positioned, needed anywhere a Ship icon's rendered width must be
// derived from a fixed height (or vice versa). Measured directly against the co-designer's own
// SV_WOODEN_01.pdf renders (flat-color rocket icons with a baked-in drop shadow, replacing the
// earlier thin-outline style - not photographed pieces, so no rotation correction is needed - see
// the Charter comment below).
export const ShipAspect: Record<number, number> = {
    1: 300 / 535,
    2: 347 / 573,
    3: 351 / 611,
    5: 355 / 649,
    8: 371 / 685
}
