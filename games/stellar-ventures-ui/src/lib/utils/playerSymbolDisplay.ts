import { Color } from '@tabletop/common'
import playerSymbolGreen from '$lib/images/players/playerSymbolGreen.png'
import playerSymbolYellow from '$lib/images/players/playerSymbolYellow.png'
import playerSymbolBlue from '$lib/images/players/playerSymbolBlue.png'
import playerSymbolRed from '$lib/images/players/playerSymbolRed.png'
import playerSymbolBlack from '$lib/images/players/playerSymbolBlack.png'
import voteTokenGreen from '$lib/images/boardroom/voteTokenGreen.png'
import voteTokenYellow from '$lib/images/boardroom/voteTokenYellow.png'
import voteTokenBlue from '$lib/images/boardroom/voteTokenBlue.png'
import voteTokenRed from '$lib/images/boardroom/voteTokenRed.png'
import voteTokenBlack from '$lib/images/boardroom/voteTokenBlack.png'

// The 5 player-identity tokens from the co-designer's own SV_PLAYER_MARKERS_TOKENS_FINAL.pdf -
// round physical marker/token art, one per seat, each its own brand color baked into the art
// itself. These replace the plain CSS `background-color` dot PlayersPanel.svelte used to show a
// player's Color (see runtime.ts/colorizer.ts for the matching hex palette, re-picked from this
// same art so the two stay in lockstep). Keyed by the same `Color` enum StellarVenturesColors
// (definition/colors.ts) assigns to seats in order - the enum's own name (e.g. Color.Green) is
// just this game's internal seat identifier now, not a literal description of the token's hue.
export const PlayerSymbolIcons: Partial<Record<Color, string>> = {
    [Color.Green]: playerSymbolGreen,
    [Color.Yellow]: playerSymbolYellow,
    [Color.Blue]: playerSymbolBlue,
    [Color.Red]: playerSymbolRed,
    [Color.Black]: playerSymbolBlack
}

// The Boardroom Battle vote tokens from the same SV_WOODEN_01.pdf as the Ships/Outposts (pages
// 19-23) - neutral gray wooden pieces, one per seat, each stamped with that seat's own glyph
// (mountain, flag, "S", bars, dot) so a placed vote reads as "whose" without needing player
// color at all. Confirmed shape-for-shape against PlayerSymbolIcons above (same glyph per
// Color), so these share its keys - used by BoardroomBattlePanel.svelte to render each vote
// placed on a Corporation's vote-space banner (CorporationPrivateVoteBanners in
// corporationDisplay.ts).
export const PlayerVoteTokenIcons: Partial<Record<Color, string>> = {
    [Color.Green]: voteTokenGreen,
    [Color.Yellow]: voteTokenYellow,
    [Color.Blue]: voteTokenBlue,
    [Color.Red]: voteTokenRed,
    [Color.Black]: voteTokenBlack
}
