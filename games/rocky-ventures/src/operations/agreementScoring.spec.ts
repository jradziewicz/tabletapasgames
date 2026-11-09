import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import { AgreementLetter } from '../data/agreements.js'
import { DeliveryCityId } from '../data/board.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { goldSaleAgreements } from './extract.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'agreement-scoring',
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 1,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1, 2].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    return Definition.runtime.hydrator.hydrateState(engine.startGame(game).initialState) as HydratedRockyVenturesGameState
}

describe('agreements that score on delivery', () => {
    it('is on for new games', () => {
        expect(startedState().agreementsScoreOnDelivery).toBe(true)
    })

    it('still finds the unflipped front for a gold sale into its city', () => {
        const state = startedState()
        const player = state.players[0]!
        player.agreements = [{ cityId: DeliveryCityId.Dornoch, letter: AgreementLetter.Three, flipped: false }] as typeof player.agreements
        expect(goldSaleAgreements(state, player.playerId, DeliveryCityId.Dornoch).pointBuy?.letter).toBe(AgreementLetter.Three)
        expect(goldSaleAgreements(state, player.playerId, DeliveryCityId.Manor).pointBuy).toBeUndefined()
    })
})
