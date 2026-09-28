import { Color } from '@tabletop/common'
import investorBoardArt from '$lib/images/investor/investorBoard.png'
import markerPersonMagenta from '$lib/images/investor/markerPersonMagenta.png'
import markerWedgeGreen from '$lib/images/investor/markerWedgeGreen.png'
import markerFlagOrange from '$lib/images/investor/markerFlagOrange.png'
import markerZigzagTeal from '$lib/images/investor/markerZigzagTeal.png'
import markerBarsBlue from '$lib/images/investor/markerBarsBlue.png'

// The Investor Board - each player's own mat for taking an Investor Shenanigans/Alien Tech
// Shenanigans action. Used to show that player's Liquid/Frozen Funds as physical Money tokens
// piled on its own printed zones, and (see below) their Investor Action / Alien Tech Action
// Action Discs - see InvestorBoard.svelte, InvestorActionPanel.svelte, AlienTechActionPanel.svelte.
export const InvestorBoardImage = investorBoardArt
export const INVESTOR_BOARD_ASPECT = 3780 / 2835

// The 5 Action Disc markers from the co-designer's own SV_WOODEN_01.pdf (pages 24-28) - matched
// to Color the same way PlayerVoteTokenIcons matches its own 5 pieces (playerSymbolDisplay.ts):
// by comparing each marker's own dominant rendered color against PlayerSymbolIcons' dominant
// color (measured, not eyeballed - Color.Black's token renders magenta, Color.Green's renders
// yellow-green, etc., since - per that file's own comment - these Color names are just internal
// seat ids, not literal hues). One marker per player, used for BOTH their Investor Action AND
// Alien Tech Action disc (same token tracks both rows - confirmed by the co-designer) - unlike
// PlayerVoteTokenIcons/PlayerSymbolIcons this only needs one shared map, not two.
export const InvestorActionDiscIcons: Partial<Record<Color, string>> = {
    [Color.Black]: markerPersonMagenta,
    [Color.Green]: markerWedgeGreen,
    [Color.Yellow]: markerFlagOrange,
    [Color.Blue]: markerZigzagTeal,
    [Color.Red]: markerBarsBlue
}
