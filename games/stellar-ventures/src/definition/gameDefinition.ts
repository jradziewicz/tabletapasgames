import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import type {
    HydratedStellarVenturesGameState,
    StellarVenturesGameState
} from '../model/gameState.js'
import { StellarVenturesHydrator } from './hydrator.js'
import { StellarVenturesGameInitializer } from './initializer.js'
import { StellarVenturesApiActions } from './apiActions.js'
import { StellarVenturesStateHandlers } from './stateHandlers.js'
import { StellarVenturesColors } from './colors.js'
import { StellarVenturesConfigurator } from './configurator.js'
import { StellarVenturesPreferenceDefinition } from './preferences.js'
import { GAME_VERSION } from './version.js'

// The export MUST be named Definition and be of type GameDefinition
export const Definition: GameDefinition<StellarVenturesGameState, HydratedStellarVenturesGameState> =
    <GameDefinition<StellarVenturesGameState, HydratedStellarVenturesGameState>>{
    info: {
        id: 'stellarventures',
        metadata: {
            name: 'Stellar Ventures',
            designer: 'Pontus Nilsson',
            description:
                'Invest in galactic corporations, explore alien planets, and dominate the stars!',
            year: '2026',
            minPlayers: 3,
            maxPlayers: 5,
            defaultPlayerCount: 4,
            version: GAME_VERSION,
            beta: false
        },
        configurator: new StellarVenturesConfigurator(),
        preferences: StellarVenturesPreferenceDefinition
    },
    runtime: {
        initializer: new StellarVenturesGameInitializer(),
        hydrator: new StellarVenturesHydrator(),
        stateHandlers: StellarVenturesStateHandlers,
        apiActions: StellarVenturesApiActions,
        playerColors: StellarVenturesColors,
        stateLogger: new DefaultStateLogger()
    }
}
