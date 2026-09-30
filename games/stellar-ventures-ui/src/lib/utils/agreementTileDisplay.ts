import type { CorporationId, Hex } from '@tabletop/stellar-ventures'
import alienAgreementTile4 from '$lib/images/agreement/alienAgreementTile4.png'
import alienTile0 from '$lib/images/shipyard/alienTile0.png'
import alienTile1 from '$lib/images/shipyard/alienTile1.png'
import alienTile2 from '$lib/images/shipyard/alienTile2.png'
import alienTile3 from '$lib/images/shipyard/alienTile3.png'
import alienHexBack from '$lib/images/board/alienHexBack.png'

// The 10 Alien Agreement Tiles (rulebook's "10 x Alien Agreement Tiles" component, Setup step 6:
// "shuffle... deal 1 face-down to each of the 7 Alien Planet hexes... returning the other 3 to
// the box"), rendered on the Agreement tab (AgreementPanel.svelte) - distinct from the 5 Alien
// Shipyard Tiles (ShipyardPanel.svelte) even though both use the same alien-mask "chevron"
// artwork and, per the game's co-designer, the literal same face-down back art - reused directly
// below rather than duplicated as a second binary asset. Distribution
// (definition/initializer.ts's ALIEN_AGREEMENT_TILE_CHEVRONS = [0,1,1,1,2,2,2,2,3,4]): 1x0, 3x1,
// 4x2, 1x3, 1x4 - a wider spread than the Shipyard's 5 tiles (which only go 0-3), so 0-3
// chevrons reuse the Shipyard's own icons (the art is identical either way) while 4 gets its own
// dedicated render. 0 is the alien head with a red X: the separate alienAgreementTile0.png render
// is just the bare alien head, indistinguishable from the face-down back, so a revealed 0 tile
// looked like it had never been flipped.
export const AlienAgreementTileRevealedIcons: Record<number, string> = {
    0: alienTile0,
    1: alienTile1,
    2: alienTile2,
    3: alienTile3,
    4: alienAgreementTile4
}

// The hidden (face-down) side of an Alien Agreement Tile is its own dedicated hex-shaped art
// (alienHexBack.png, from the game's co-designer - see Board.svelte, which has always used it
// correctly) - NOT the Shipyard's own alienTileHidden.png, which despite sharing the same
// alien-mask "chevron" look on the revealed faces, prints a visibly different back (this was
// wrongly assumed shared and used here until the co-designer caught it).
export const AlienAgreementTileHiddenIcon = alienHexBack

/**
 * The one Alien Agreement Tile a signed Corporation actually flipped to sign (see
 * actions/signTheAgreement.ts step 1 - "Flip the Alien Agreement Tile") - shared by the Agreement
 * tab (AgreementPanel.svelte, replacing the handshake token once signed) and the Sign The
 * Agreement walkthrough (Board.svelte, step 2's tile-flip visual). A Corporation can only ever
 * sign once, and a hex's tile is only ever flipped by that one signing action (Nebular Explorers
 * deals a fresh, still-hidden tile to a newly-converted hex rather than flipping one - see
 * actions/nebularExplorers.ts), so the Alien Planet hex where this Corporation holds an Outpost
 * AND the tile is no longer hidden is that one signing hex - unless two Corporations happen to
 * share that same hex (a hex can hold up to 2 Outposts) and only one of them actually signed
 * there, in which case this picks whichever matching hex comes first rather than trying to
 * disambiguate further. Returns undefined if this Corporation hasn't signed (or the signing hex
 * can't be found), same as before.
 */
export function findSignedAgreementHex(
    alienPlanetHexes: Hex[],
    corporationId: CorporationId
): Hex | undefined {
    return alienPlanetHexes.find(
        (hex) => hex.outposts.includes(corporationId) && hex.alienAgreementTileHidden === false
    )
}

// Column widths measured directly off theAgreement.png (the co-designer's own Trackers &
// Agreement sheet, page 1, at its full 2965x592 - The Agreement's own 4 columns plus the still-
// blank Alien Shareholdings section to its right) - the four "N Planets" columns aren't quite
// perfectly even (the 2 Planets column's own corner notch eats a little extra width), so this
// reads their real boundaries (497/981/1465/1941 out of 2965px total) rather than assuming a
// plain split. The trailing entry is a spacer the same width as the Alien Shareholdings section.
// Shared by the Agreement tab (AgreementPanel.svelte) and the Sign The Agreement walkthrough's
// step 4 (Board.svelte), so both always agree on where each "N Planets" column actually sits.
export const AGREEMENT_TRACK_PLANET_COUNTS = [2, 3, 4, 5]
export const AGREEMENT_TRACK_COLUMN_WIDTH_PCT = [
    (497 / 2965) * 100,
    ((981 - 497) / 2965) * 100,
    ((1465 - 981) / 2965) * 100,
    ((1941 - 1465) / 2965) * 100,
    ((2965 - 1941) / 2965) * 100
]

// Left edge of each of the Agreement Track's 5 sections, as a running total of
// AGREEMENT_TRACK_COLUMN_WIDTH_PCT - needed to place anything directly ON the art itself
// (overlaid, at the right x position) rather than in a separate row below it.
export const AGREEMENT_TRACK_COLUMN_LEFT_PCT: number[] = (() => {
    let cumulative = 0
    return AGREEMENT_TRACK_COLUMN_WIDTH_PCT.map((width) => {
        const left = cumulative
        cumulative += width
        return left
    })
})()

// Vertical placement within the art, eyeballed from the co-designer's own close-up crops of it:
// each "N Planets" column has its planet icons (with a connecting track line between them,
// evidently meant for exactly this kind of marker) roughly mid-height, well clear of the
// "!$X > bag" figures above and the "-> +$X"/"N PLANETS" label below - and the Alien
// Shareholdings section has its "ALIEN SHAREHOLDINGS" banner only across its own top ~20%,
// leaving the rest open. Sized modestly so neither piece spreads into that surrounding text -
// TOP_PCT is adjusted alongside each HEIGHT_PCT change so the piece keeps the same vertical
// center it always has (42+20/2=52 for the Token, 58+26/2=71 for the Share) rather than drifting
// as it's resized. Shared by AgreementPanel.svelte (every Corporation that's actually signed,
// persisted for the rest of the game) and OfferSignTheAgreementPanel.svelte (the one Corporation
// currently signing, during its own local reveal), so both places a Token/Share can appear on
// this art agree on exactly where.
export const AGREEMENT_TOKEN_HEIGHT_PCT = 20 * 0.67 // 33% smaller than its original 20
export const AGREEMENT_TOKEN_TOP_PCT = 52 - AGREEMENT_TOKEN_HEIGHT_PCT / 2
export const AGREEMENT_SHARE_HEIGHT_PCT = 26 * 1.33 // 33% larger than its original 26
export const AGREEMENT_SHARE_TOP_PCT = 71 - AGREEMENT_SHARE_HEIGHT_PCT / 2

export function signedAgreementTileIcon(
    alienPlanetHexes: Hex[],
    corporationId: CorporationId
): string | undefined {
    const hex = findSignedAgreementHex(alienPlanetHexes, corporationId)
    if (!hex || hex.alienAgreementTileChevrons === undefined) {
        return undefined
    }
    return AlienAgreementTileRevealedIcons[hex.alienAgreementTileChevrons]
}
