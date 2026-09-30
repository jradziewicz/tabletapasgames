import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import { Definition } from '@tabletop/rocky-ventures'
import type { RockyVenturesGameState, HydratedRockyVenturesGameState } from '@tabletop/rocky-ventures'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { RockyVenturesColorizer, PlayerColorHex } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { RockyVenturesGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

const rockyVenturesPlayerColorPalette: PlayerColorPalette = {
    [Color.Yellow]: { fill: PlayerColorHex[Color.Yellow]!, text: '#000000', contrast: '#000000' },
    [Color.Purple]: { fill: PlayerColorHex[Color.Purple]!, text: '#ffffff', contrast: '#ffffff' },
    [Color.White]: { fill: PlayerColorHex[Color.White]!, text: '#000000', contrast: '#000000' },
    [Color.Green]: { fill: PlayerColorHex[Color.Green]!, text: '#ffffff', contrast: '#ffffff' },
    [Color.Red]: { fill: PlayerColorHex[Color.Red]!, text: '#ffffff', contrast: '#ffffff' }
}

export const RockyVenturesUiRuntime: GameUIRuntime<
    RockyVenturesGameState,
    HydratedRockyVenturesGameState
> = {
    ...Definition.runtime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: RockyVenturesGameSession,
    colorizer: new RockyVenturesColorizer(),
    playerColorPalette: rockyVenturesPlayerColorPalette
}
