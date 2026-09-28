// Auto-generated transcription of the Alpha map board (SV_BOARD_ALPHA_FINAL).
// Generated from a hex-by-hex visual pass over the printed board, cross-checked with a
// generated verification overlay image and corrections from the rulebook co-designer
// before being treated as final.
//
// Amethyst Agency is not part of the Initial Auction (see StartingCorporationIds) - it enters
// the game at the start of Round 3, when players choose ONE of its 3 possible home planets
// below. All 3 are modeled as ordinary HomePlanet hexes with homeCorporationId: AmethystAgency
// and baseValue: 2 (vs. 1 for the other 5 corps' single home planets) - the "choose one of 3"
// entry mechanic itself isn't implemented yet.
//
// Remaining flagged assumption: ringed-planet vs plain-sphere vs small-moon art variants are
// purely cosmetic in this data - only baseValue matters for gameplay.
import { CorporationId } from '../model/corporation.js'
import { Hex, HexType } from '../model/board.js'

export const AlphaBoardHexes: Hex[] = [
    // Row 0 (0,0 / 1,0 / 8,0 / 9,0 / 16,0 / 17,0 / 18,0 confirmed off the physical board - removed)
    { id: '2,0', coordinate: { q: 2, r: 0 }, type: HexType.DeepSpace, outposts: [] },
    { id: '3,0', coordinate: { q: 3, r: 0 }, type: HexType.HomePlanet, baseValue: 1, homeCorporationId: CorporationId.PinkInc, outposts: [] },
    { id: '4,0', coordinate: { q: 4, r: 0 }, type: HexType.Sun, hasSun: true, outposts: [] },
    { id: '5,0', coordinate: { q: 5, r: 0 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '6,0', coordinate: { q: 6, r: 0 }, type: HexType.AlienPlanet, outposts: [] },
    { id: '7,0', coordinate: { q: 7, r: 0 }, type: HexType.DeepSpace, outposts: [] },
    { id: '10,0', coordinate: { q: 10, r: 0 }, type: HexType.DeepSpace, outposts: [] },
    { id: '11,0', coordinate: { q: 11, r: 0 }, type: HexType.DeepSpace, outposts: [] },
    { id: '12,0', coordinate: { q: 12, r: 0 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '13,0', coordinate: { q: 13, r: 0 }, type: HexType.DeepSpace, outposts: [] },
    { id: '14,0', coordinate: { q: 14, r: 0 }, type: HexType.NeutralPlanet, baseValue: 4, outposts: [] },
    { id: '15,0', coordinate: { q: 15, r: 0 }, type: HexType.HomePlanet, baseValue: 2, homeCorporationId: CorporationId.AmethystAgency, outposts: [] },
    // Row 1
    { id: '1,1', coordinate: { q: 1, r: 1 }, type: HexType.AlienPlanet, outposts: [] },
    { id: '2,1', coordinate: { q: 2, r: 1 }, type: HexType.DeepSpace, outposts: [] },
    { id: '3,1', coordinate: { q: 3, r: 1 }, type: HexType.DeepSpace, outposts: [] },
    { id: '4,1', coordinate: { q: 4, r: 1 }, type: HexType.Sun, hasSun: true, outposts: [] },
    { id: '5,1', coordinate: { q: 5, r: 1 }, type: HexType.DeepSpace, outposts: [] },
    { id: '6,1', coordinate: { q: 6, r: 1 }, type: HexType.DeepSpace, outposts: [] },
    { id: '7,1', coordinate: { q: 7, r: 1 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '9,1', coordinate: { q: 9, r: 1 }, type: HexType.HomePlanet, baseValue: 1, homeCorporationId: CorporationId.ScarletSyndicate, outposts: [] },
    { id: '10,1', coordinate: { q: 10, r: 1 }, type: HexType.DeepSpace, outposts: [] },
    { id: '11,1', coordinate: { q: 11, r: 1 }, type: HexType.Anomaly, outposts: [] },
    { id: '12,1', coordinate: { q: 12, r: 1 }, type: HexType.DeepSpace, outposts: [] },
    { id: '13,1', coordinate: { q: 13, r: 1 }, type: HexType.DeepSpace, outposts: [] },
    { id: '14,1', coordinate: { q: 14, r: 1 }, type: HexType.DeepSpace, outposts: [] },
    { id: '15,1', coordinate: { q: 15, r: 1 }, type: HexType.DeepSpace, outposts: [] },
    // Row 2
    { id: '0,2', coordinate: { q: 0, r: 2 }, type: HexType.DeepSpace, outposts: [] },
    { id: '1,2', coordinate: { q: 1, r: 2 }, type: HexType.HomePlanet, baseValue: 1, homeCorporationId: CorporationId.CeruleanCouncil, outposts: [] },
    { id: '2,2', coordinate: { q: 2, r: 2 }, type: HexType.NeutralPlanet, baseValue: 1, outposts: [] },
    { id: '3,2', coordinate: { q: 3, r: 2 }, type: HexType.DeepSpace, outposts: [] },
    { id: '4,2', coordinate: { q: 4, r: 2 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '5,2', coordinate: { q: 5, r: 2 }, type: HexType.DeepSpace, outposts: [] },
    { id: '6,2', coordinate: { q: 6, r: 2 }, type: HexType.DeepSpace, outposts: [] },
    { id: '7,2', coordinate: { q: 7, r: 2 }, type: HexType.NeutralPlanet, baseValue: 1, outposts: [] },
    { id: '8,2', coordinate: { q: 8, r: 2 }, type: HexType.DeepSpace, outposts: [] },
    { id: '9,2', coordinate: { q: 9, r: 2 }, type: HexType.Anomaly, outposts: [] },
    { id: '10,2', coordinate: { q: 10, r: 2 }, type: HexType.Anomaly, outposts: [] },
    { id: '11,2', coordinate: { q: 11, r: 2 }, type: HexType.Anomaly, outposts: [] },
    { id: '12,2', coordinate: { q: 12, r: 2 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '13,2', coordinate: { q: 13, r: 2 }, type: HexType.DeepSpace, outposts: [] },
    { id: '14,2', coordinate: { q: 14, r: 2 }, type: HexType.DeepSpace, outposts: [] },
    { id: '15,2', coordinate: { q: 15, r: 2 }, type: HexType.AlienPlanet, outposts: [] },
    // Row 3
    { id: '-1,3', coordinate: { q: -1, r: 3 }, type: HexType.NeutralPlanet, baseValue: 1, outposts: [] },
    { id: '0,3', coordinate: { q: 0, r: 3 }, type: HexType.DeepSpace, outposts: [] },
    { id: '1,3', coordinate: { q: 1, r: 3 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '2,3', coordinate: { q: 2, r: 3 }, type: HexType.DeepSpace, outposts: [] },
    { id: '3,3', coordinate: { q: 3, r: 3 }, type: HexType.DeepSpace, outposts: [] },
    { id: '4,3', coordinate: { q: 4, r: 3 }, type: HexType.DeepSpace, outposts: [] },
    { id: '5,3', coordinate: { q: 5, r: 3 }, type: HexType.NeutralPlanet, baseValue: 1, outposts: [] },
    { id: '6,3', coordinate: { q: 6, r: 3 }, type: HexType.DeepSpace, outposts: [] },
    { id: '7,3', coordinate: { q: 7, r: 3 }, type: HexType.Anomaly, outposts: [] },
    { id: '8,3', coordinate: { q: 8, r: 3 }, type: HexType.Anomaly, outposts: [] },
    { id: '9,3', coordinate: { q: 9, r: 3 }, type: HexType.NeutralPlanet, baseValue: 1, outposts: [] },
    { id: '10,3', coordinate: { q: 10, r: 3 }, type: HexType.DeepSpace, outposts: [] },
    { id: '11,3', coordinate: { q: 11, r: 3 }, type: HexType.DeepSpace, outposts: [] },
    { id: '12,3', coordinate: { q: 12, r: 3 }, type: HexType.DeepSpace, outposts: [] },
    { id: '13,3', coordinate: { q: 13, r: 3 }, type: HexType.DeepSpace, outposts: [] },
    { id: '14,3', coordinate: { q: 14, r: 3 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '15,3', coordinate: { q: 15, r: 3 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    // Row 4
    { id: '-2,4', coordinate: { q: -2, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '-1,4', coordinate: { q: -1, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '0,4', coordinate: { q: 0, r: 4 }, type: HexType.HomePlanet, baseValue: 1, homeCorporationId: CorporationId.GambogeGuild, outposts: [] },
    { id: '1,4', coordinate: { q: 1, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '2,4', coordinate: { q: 2, r: 4 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '3,4', coordinate: { q: 3, r: 4 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '4,4', coordinate: { q: 4, r: 4 }, type: HexType.Sun, hasSun: true, outposts: [] },
    { id: '5,4', coordinate: { q: 5, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '6,4', coordinate: { q: 6, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '7,4', coordinate: { q: 7, r: 4 }, type: HexType.HomePlanet, baseValue: 2, homeCorporationId: CorporationId.AmethystAgency, outposts: [] },
    { id: '8,4', coordinate: { q: 8, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '9,4', coordinate: { q: 9, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '10,4', coordinate: { q: 10, r: 4 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '11,4', coordinate: { q: 11, r: 4 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '12,4', coordinate: { q: 12, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '13,4', coordinate: { q: 13, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '14,4', coordinate: { q: 14, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    { id: '15,4', coordinate: { q: 15, r: 4 }, type: HexType.DeepSpace, outposts: [] },
    // Row 5
    { id: '-3,5', coordinate: { q: -3, r: 5 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '-2,5', coordinate: { q: -2, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '-1,5', coordinate: { q: -1, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '0,5', coordinate: { q: 0, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '1,5', coordinate: { q: 1, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '2,5', coordinate: { q: 2, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '3,5', coordinate: { q: 3, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '4,5', coordinate: { q: 4, r: 5 }, type: HexType.AlienPlanet, outposts: [] },
    { id: '5,5', coordinate: { q: 5, r: 5 }, type: HexType.Sun, hasSun: true, outposts: [] },
    { id: '6,5', coordinate: { q: 6, r: 5 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '7,5', coordinate: { q: 7, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '8,5', coordinate: { q: 8, r: 5 }, type: HexType.NeutralPlanet, baseValue: 4, outposts: [] },
    { id: '9,5', coordinate: { q: 9, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '10,5', coordinate: { q: 10, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '11,5', coordinate: { q: 11, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '12,5', coordinate: { q: 12, r: 5 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '13,5', coordinate: { q: 13, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    { id: '14,5', coordinate: { q: 14, r: 5 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '15,5', coordinate: { q: 15, r: 5 }, type: HexType.DeepSpace, outposts: [] },
    // Row 6
    { id: '-3,6', coordinate: { q: -3, r: 6 }, type: HexType.AlienPlanet, outposts: [] },
    { id: '-2,6', coordinate: { q: -2, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    { id: '-1,6', coordinate: { q: -1, r: 6 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '0,6', coordinate: { q: 0, r: 6 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '1,6', coordinate: { q: 1, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    { id: '2,6', coordinate: { q: 2, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    { id: '3,6', coordinate: { q: 3, r: 6 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '4,6', coordinate: { q: 4, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    { id: '5,6', coordinate: { q: 5, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    { id: '6,6', coordinate: { q: 6, r: 6 }, type: HexType.Sun, hasSun: true, outposts: [] },
    { id: '7,6', coordinate: { q: 7, r: 6 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '8,6', coordinate: { q: 8, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    { id: '9,6', coordinate: { q: 9, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    { id: '10,6', coordinate: { q: 10, r: 6 }, type: HexType.NeutralPlanet, baseValue: 4, outposts: [] },
    { id: '11,6', coordinate: { q: 11, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    { id: '12,6', coordinate: { q: 12, r: 6 }, type: HexType.Anomaly, outposts: [] },
    { id: '13,6', coordinate: { q: 13, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    { id: '14,6', coordinate: { q: 14, r: 6 }, type: HexType.DeepSpace, outposts: [] },
    // Row 7
    { id: '-3,7', coordinate: { q: -3, r: 7 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '-2,7', coordinate: { q: -2, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '-1,7', coordinate: { q: -1, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '0,7', coordinate: { q: 0, r: 7 }, type: HexType.HomePlanet, baseValue: 2, homeCorporationId: CorporationId.AmethystAgency, outposts: [] },
    { id: '1,7', coordinate: { q: 1, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '2,7', coordinate: { q: 2, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '3,7', coordinate: { q: 3, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '4,7', coordinate: { q: 4, r: 7 }, type: HexType.Sun, hasSun: true, outposts: [] },
    { id: '5,7', coordinate: { q: 5, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '6,7', coordinate: { q: 6, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '7,7', coordinate: { q: 7, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '8,7', coordinate: { q: 8, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '9,7', coordinate: { q: 9, r: 7 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '10,7', coordinate: { q: 10, r: 7 }, type: HexType.Anomaly, outposts: [] },
    { id: '11,7', coordinate: { q: 11, r: 7 }, type: HexType.Anomaly, outposts: [] },
    { id: '12,7', coordinate: { q: 12, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    { id: '13,7', coordinate: { q: 13, r: 7 }, type: HexType.DeepSpace, outposts: [] },
    // Row 8
    { id: '-3,8', coordinate: { q: -3, r: 8 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '-2,8', coordinate: { q: -2, r: 8 }, type: HexType.DeepSpace, outposts: [] },
    { id: '-1,8', coordinate: { q: -1, r: 8 }, type: HexType.Sun, hasSun: true, outposts: [] },
    { id: '0,8', coordinate: { q: 0, r: 8 }, type: HexType.DeepSpace, outposts: [] },
    { id: '1,8', coordinate: { q: 1, r: 8 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '2,8', coordinate: { q: 2, r: 8 }, type: HexType.DeepSpace, outposts: [] },
    { id: '3,8', coordinate: { q: 3, r: 8 }, type: HexType.DeepSpace, outposts: [] },
    { id: '4,8', coordinate: { q: 4, r: 8 }, type: HexType.Sun, hasSun: true, outposts: [] },
    { id: '5,8', coordinate: { q: 5, r: 8 }, type: HexType.DeepSpace, outposts: [] },
    { id: '6,8', coordinate: { q: 6, r: 8 }, type: HexType.DeepSpace, outposts: [] },
    { id: '7,8', coordinate: { q: 7, r: 8 }, type: HexType.NeutralPlanet, baseValue: 4, outposts: [] },
    { id: '8,8', coordinate: { q: 8, r: 8 }, type: HexType.DeepSpace, outposts: [] },
    { id: '9,8', coordinate: { q: 9, r: 8 }, type: HexType.DeepSpace, outposts: [] },
    { id: '10,8', coordinate: { q: 10, r: 8 }, type: HexType.Anomaly, outposts: [] },
    // Mega Earth's printed art spans 3 hexes (11,8 / 11,9 / 12,8), all typed MegaEarth.
    // Building an outpost on any one of the 3 counts toward the same shared cap (up to 4
    // corporations total across all 3, tracked via megaEarth.fillOrder) - future Expand
    // Network / build-outpost logic needs to check outposts across all 3 hexes together,
    // not just the one hex being built on.
    { id: '11,8', coordinate: { q: 11, r: 8 }, type: HexType.MegaEarth, outposts: [] },
    { id: '12,8', coordinate: { q: 12, r: 8 }, type: HexType.MegaEarth, outposts: [] },
    // Row 9
    { id: '-3,9', coordinate: { q: -3, r: 9 }, type: HexType.DeepSpace, outposts: [] },
    { id: '-2,9', coordinate: { q: -2, r: 9 }, type: HexType.DeepSpace, outposts: [] },
    { id: '-1,9', coordinate: { q: -1, r: 9 }, type: HexType.NeutralPlanet, baseValue: 1, outposts: [] },
    { id: '0,9', coordinate: { q: 0, r: 9 }, type: HexType.DeepSpace, outposts: [] },
    { id: '1,9', coordinate: { q: 1, r: 9 }, type: HexType.DeepSpace, outposts: [] },
    { id: '2,9', coordinate: { q: 2, r: 9 }, type: HexType.DeepSpace, outposts: [] },
    { id: '3,9', coordinate: { q: 3, r: 9 }, type: HexType.NeutralPlanet, baseValue: 1, outposts: [] },
    { id: '5,9', coordinate: { q: 5, r: 9 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '6,9', coordinate: { q: 6, r: 9 }, type: HexType.DeepSpace, outposts: [] },
    { id: '7,9', coordinate: { q: 7, r: 9 }, type: HexType.NeutralPlanet, baseValue: 3, outposts: [] },
    { id: '8,9', coordinate: { q: 8, r: 9 }, type: HexType.Sun, hasSun: true, outposts: [] },
    { id: '9,9', coordinate: { q: 9, r: 9 }, type: HexType.DeepSpace, outposts: [] },
    { id: '10,9', coordinate: { q: 10, r: 9 }, type: HexType.DeepSpace, outposts: [] },
    { id: '11,9', coordinate: { q: 11, r: 9 }, type: HexType.MegaEarth, outposts: [] },
    // Row 10
    { id: '-3,10', coordinate: { q: -3, r: 10 }, type: HexType.AlienPlanet, outposts: [] },
    { id: '-2,10', coordinate: { q: -2, r: 10 }, type: HexType.DeepSpace, outposts: [] },
    { id: '-1,10', coordinate: { q: -1, r: 10 }, type: HexType.NeutralPlanet, baseValue: 2, outposts: [] },
    { id: '0,10', coordinate: { q: 0, r: 10 }, type: HexType.NeutralPlanet, baseValue: 1, outposts: [] },
    { id: '1,10', coordinate: { q: 1, r: 10 }, type: HexType.HomePlanet, baseValue: 1, homeCorporationId: CorporationId.FrostFederated, outposts: [] },
    { id: '2,10', coordinate: { q: 2, r: 10 }, type: HexType.DeepSpace, outposts: [] },
    { id: '5,10', coordinate: { q: 5, r: 10 }, type: HexType.AlienPlanet, outposts: [] },
    { id: '6,10', coordinate: { q: 6, r: 10 }, type: HexType.DeepSpace, outposts: [] },
    { id: '7,10', coordinate: { q: 7, r: 10 }, type: HexType.DeepSpace, outposts: [] },
    { id: '8,10', coordinate: { q: 8, r: 10 }, type: HexType.DeepSpace, outposts: [] },
    { id: '9,10', coordinate: { q: 9, r: 10 }, type: HexType.DeepSpace, outposts: [] },
    { id: '10,10', coordinate: { q: 10, r: 10 }, type: HexType.DeepSpace, outposts: [] },
]

// The 3 candidate home planets Amethyst Agency chooses from when it enters at Round 3 - not
// all 3 end up in play, only whichever one is chosen.
export const AmethystCandidateHomeHexIds: string[] = AlphaBoardHexes.filter(
    (hex) => hex.homeCorporationId === CorporationId.AmethystAgency
).map((hex) => hex.id)

// Ascending, indexed by (total Outposts currently on Mega-Earth across all 3 physical hexes) - 1:
// the 1st Outpost built there raises Mega-Earth's shared Mining Capacity value to 6, the 2nd to
// 9, the 3rd to 12, the 4th (and last - Mega-Earth only has room for 4 Corporations) to 15. See
// currentMegaEarthValue() in board.ts. Confirmed against the rulebook's worked example (page 14):
// with 2 Corporations already present (value 9) a 3rd builds there, raising the shared value to
// 12 - the 2 existing Corporations' Mining Capacity each go up +3 (9 to 12), and the new 3rd
// Corporation gains +12.
export const MegaEarthValueTrack = [6, 9, 12, 15]