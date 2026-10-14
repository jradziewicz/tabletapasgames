import { DefaultStateLogger, GameVisibility, type GameDefinition } from '@tabletop/common'
import type { HydratedLocustGameState, LocustGameState } from '../model/gameState.js'
import { LocustGameStateValidator } from '../model/gameState.js'
import { LocustHydrator } from './hydrator.js'
import { LocustGameInitializer } from './initializer.js'
import { LocustApiActions } from './apiActions.js'
import { LocustStateHandlers } from './stateHandlers.js'
import { LocustColors } from './colors.js'
import { LocustConfigurator } from './configurator.js'
import { LocustPreferenceDefinition } from './preferences.js'
import { GAME_VERSION } from './version.js'
import { MaxPlayers, MinPlayers } from '../data/rules.js'

// The export MUST be named Definition and be of type GameDefinition
export const Definition: GameDefinition<LocustGameState, HydratedLocustGameState> = {
    info: {
        id: 'locust',
        metadata: {
            name: 'Locust: Swarm or Die',
            designer: 'Pontus Nilsson',
            description:
                'Breed, jump and swarm your grasshoppers across a drying land as the rain moves on. Two players duel with two colours each.',
            year: '2026',
            minPlayers: MinPlayers,
            maxPlayers: MaxPlayers,
            defaultPlayerCount: 3,
            version: GAME_VERSION,
            beta: true,
            // Alpha testers only (assigned on the /admin Users tab) until launch
            visibility: GameVisibility.Alpha
        },
        configurator: new LocustConfigurator(),
        preferences: LocustPreferenceDefinition
    },
    runtime: {
        initializer: new LocustGameInitializer(),
        hydrator: new LocustHydrator(),
        stateHandlers: LocustStateHandlers,
        apiActions: LocustApiActions,
        playerColors: LocustColors,
        canonicalStateValidator: LocustGameStateValidator,
        stateLogger: new DefaultStateLogger()
    }
}
