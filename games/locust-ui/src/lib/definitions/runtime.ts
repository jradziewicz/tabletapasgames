import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import { Definition } from '@tabletop/locust'
import type { LocustGameState, HydratedLocustGameState } from '@tabletop/locust'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { LocustColorizer, ColonyHex } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { LocustGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

const paletteEntry = (color: Color, text: string) => {
    const fill = ColonyHex[color] ?? '#555555'
    return { fill, text, contrast: text }
}

const locustPlayerColorPalette: PlayerColorPalette = {
    [Color.Green]: paletteEntry(Color.Green, '#ffffff'),
    [Color.Yellow]: paletteEntry(Color.Yellow, '#000000'),
    [Color.Blue]: paletteEntry(Color.Blue, '#ffffff'),
    [Color.Red]: paletteEntry(Color.Red, '#ffffff')
}

export const LocustUiRuntime: GameUIRuntime<LocustGameState, HydratedLocustGameState> = {
    ...Definition.runtime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: LocustGameSession,
    colorizer: new LocustColorizer(),
    playerColorPalette: locustPlayerColorPalette
}
