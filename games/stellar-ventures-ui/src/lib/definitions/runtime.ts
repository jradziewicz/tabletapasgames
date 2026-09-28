import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import { Definition } from '@tabletop/stellar-ventures'
import type { StellarVenturesGameState, HydratedStellarVenturesGameState } from '@tabletop/stellar-ventures'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { StellarVenturesColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { StellarVenturesGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

// Real palette, re-picked directly from the co-designer's own SV_PLAYER_MARKERS_TOKENS_FINAL.pdf
// player-token art (see playerSymbolDisplay.ts) rather than the old placeholder hex values - each
// Color's fill now matches that seat's own token exactly. `text`/`contrast` are whichever of
// black/white reads against that fill (WCAG relative luminance).
const stellarVenturesPlayerColorPalette: PlayerColorPalette = {
    [Color.Green]: {
        fill: '#c8d530',
        text: '#000000',
        contrast: '#000000'
    },
    [Color.Yellow]: {
        fill: '#dd6b15',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Blue]: {
        fill: '#4ab171',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Red]: {
        fill: '#0069a9',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Black]: {
        fill: '#b81a5d',
        text: '#ffffff',
        contrast: '#ffffff'
    }
}

export const StellarVenturesUiRuntime: GameUIRuntime<
    StellarVenturesGameState,
    HydratedStellarVenturesGameState
> = {
    ...Definition.runtime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: StellarVenturesGameSession,
    colorizer: new StellarVenturesColorizer(),
    playerColorPalette: stellarVenturesPlayerColorPalette
}
