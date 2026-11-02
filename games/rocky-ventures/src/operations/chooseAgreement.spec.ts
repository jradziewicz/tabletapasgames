import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { DeliveryCityId } from '../data/board.js'
import { AgreementLetter } from '../data/agreements.js'
import { awardAgreement, reasonChooseAgreementInvalid } from './invest.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'choose-agreement',
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

describe('choosing an agreement when investing', () => {
    const city = DeliveryCityId.Dornoch

    it('takes the top agreement for free', () => {
        const state = startedState()
        const player = state.players[0]!
        const top = state.agreementStacks[city]![0]!
        const gems = player.gems
        awardAgreement(state, player.playerId, city)
        expect(player.agreements).toEqual([{ cityId: city, letter: top }])
        expect(player.gems).toBe(gems)
    })

    it('takes any other agreement for 1 gem, which leaves the game', () => {
        const state = startedState()
        const player = state.players[0]!
        state.agreementStacks[city] = [AgreementLetter.A, AgreementLetter.B, AgreementLetter.C, AgreementLetter.D]
        player.gems = 2
        expect(reasonChooseAgreementInvalid(state, player.playerId, city, AgreementLetter.C)).toBeUndefined()
        awardAgreement(state, player.playerId, city, AgreementLetter.C)
        expect(player.agreements).toEqual([{ cityId: city, letter: AgreementLetter.C }])
        expect(state.agreementStacks[city]).toEqual([AgreementLetter.A, AgreementLetter.B, AgreementLetter.D])
        expect(player.gems).toBe(1)
        expect(state.gemsSpent).toBe(1)
    })

    it('needs a gem to choose anything but the top one', () => {
        const state = startedState()
        const player = state.players[0]!
        state.agreementStacks[city] = [AgreementLetter.A, AgreementLetter.B]
        player.gems = 0
        expect(reasonChooseAgreementInvalid(state, player.playerId, city, AgreementLetter.B)).toBe(
            'Choosing an agreement other than the top one costs a gem'
        )
        expect(reasonChooseAgreementInvalid(state, player.playerId, city, AgreementLetter.A)).toBeUndefined()
    })
})
