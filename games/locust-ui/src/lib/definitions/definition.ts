import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Definition } from '@tabletop/locust'
import type { LocustGameState, HydratedLocustGameState } from '@tabletop/locust'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<LocustGameState, HydratedLocustGameState> = {
    info: {
        ...Definition.info,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).LocustUiRuntime
    }
}
