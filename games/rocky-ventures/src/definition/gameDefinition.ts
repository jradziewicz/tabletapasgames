import { DefaultStateLogger, GameVisibility, type GameDefinition } from '@tabletop/common'
import type { HydratedRockyVenturesGameState, RockyVenturesGameState } from '../model/gameState.js'
import { RockyVenturesHydrator } from './hydrator.js'
import { RockyVenturesGameInitializer } from './initializer.js'
import { RockyVenturesApiActions } from './apiActions.js'
import { RockyVenturesStateHandlers } from './stateHandlers.js'
import { RockyVenturesColors } from './colors.js'
import { RockyVenturesConfigurator } from './configurator.js'
import { RockyVenturesPreferenceDefinition } from './preferences.js'
import { GAME_VERSION } from './version.js'
import { MaxPlayers, MinPlayers } from '../data/setup.js'

// The export MUST be named Definition and be of type GameDefinition
export const Definition: GameDefinition<RockyVenturesGameState, HydratedRockyVenturesGameState> = <
    GameDefinition<RockyVenturesGameState, HydratedRockyVenturesGameState>
>{
    info: {
        id: 'rockyventures',
        metadata: {
            name: 'Rocky Ventures',
            designer: 'Pontus Nilsson',
            description:
                'Claim mines, lay track, hunt the scourge and sell your ore in a land of dwarves and dragons.',
            year: '2026',
            minPlayers: MinPlayers,
            maxPlayers: MaxPlayers,
            defaultPlayerCount: 4,
            version: GAME_VERSION,
            beta: true,
            // Alpha testers only (assigned on the /admin Users tab) until launch
            visibility: GameVisibility.Alpha
        },
        configurator: new RockyVenturesConfigurator(),
        preferences: RockyVenturesPreferenceDefinition
    },
    runtime: {
        initializer: new RockyVenturesGameInitializer(),
        hydrator: new RockyVenturesHydrator(),
        stateHandlers: RockyVenturesStateHandlers,
        apiActions: RockyVenturesApiActions,
        playerColors: RockyVenturesColors,
        stateLogger: new DefaultStateLogger()
    }
}
