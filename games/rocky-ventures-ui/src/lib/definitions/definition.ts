import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Definition } from '@tabletop/rocky-ventures'
import type { RockyVenturesGameState, HydratedRockyVenturesGameState } from '@tabletop/rocky-ventures'
import coverImg from '$lib/images/rockyventures-cover.jpg'

export const UiDefinition: GameUiDefinition<RockyVenturesGameState, HydratedRockyVenturesGameState> = {
    info: {
        ...Definition.info,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).RockyVenturesUiRuntime
    }
}
