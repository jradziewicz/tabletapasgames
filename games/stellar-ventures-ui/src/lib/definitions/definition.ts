import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Definition } from '@tabletop/stellar-ventures'
import type { StellarVenturesGameState, HydratedStellarVenturesGameState } from '@tabletop/stellar-ventures'
import coverImg from '$lib/images/stellarventures-cover.jpg'

export const UiDefinition: GameUiDefinition<
    StellarVenturesGameState,
    HydratedStellarVenturesGameState
> = {
    info: {
        ...Definition.info,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).StellarVenturesUiRuntime
    }
}
