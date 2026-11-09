import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { DeliveryCityId } from '../data/board.js'
import { AgreementLetter } from '../data/agreements.js'
import { awardAgreement, reasonChooseAgreementInvalid } from './invest.js'
import { goldSaleAgreements } from './extract.js'
import { HydratedAgreementPointBuy } from '../actions/agreementPointBuy.js'
import { ActionType } from '../definition/actions.js'

const engine = new GameEngine(Definition.runtime)

function startedState(): HydratedRockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: 'two-sided-agreements',
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

describe('two-sided agreements', () => {
    const city = DeliveryCityId.Dornoch
    const ordered = [AgreementLetter.One, AgreementLetter.Two, AgreementLetter.Three, AgreementLetter.Four]

    it('starts each city pile in order, 1 on top', () => {
        const state = startedState()
        expect(state.agreementStacks[DeliveryCityId.Dornoch]).toEqual(ordered)
        expect(state.agreementStacks[DeliveryCityId.Manor]).toEqual(ordered)
    })

    it('cannot be chosen out of order', () => {
        const state = startedState()
        const player = state.players[0]!
        player.gems = 3
        expect(reasonChooseAgreementInvalid(state, player.playerId, city, AgreementLetter.Three)).toBe(
            'Two-sided agreements are taken in order from the top of the pile'
        )
        expect(reasonChooseAgreementInvalid(state, player.playerId, city, AgreementLetter.One)).toBeUndefined()
    })

    it('offers the front point buy until a second agreement from the city flips it', () => {
        const state = startedState()
        const player = state.players[0]!
        awardAgreement(state, player.playerId, city)
        expect(goldSaleAgreements(state, player.playerId, city)).toEqual({
            oreBonus: false,
            discount: false,
            ignoreDragon: false,
            pointBuy: { letter: AgreementLetter.One, cost: 3, victoryPoints: 3, fromIncome: false }
        })

        awardAgreement(state, player.playerId, city)
        expect(player.agreements).toEqual([
            { cityId: city, letter: AgreementLetter.One, flipped: true },
            { cityId: city, letter: AgreementLetter.Two }
        ])
        expect(goldSaleAgreements(state, player.playerId, city)).toEqual({
            oreBonus: true,
            discount: false,
            ignoreDragon: false,
            pointBuy: { letter: AgreementLetter.Two, cost: 5, victoryPoints: 4, fromIncome: false }
        })
        expect(goldSaleAgreements(state, player.playerId, DeliveryCityId.Manor).pointBuy).toBeUndefined()
    })

    it('stacks the backs of every flipped agreement', () => {
        const state = startedState()
        const player = state.players[0]!
        for (let i = 0; i < 4; i++) {
            awardAgreement(state, player.playerId, city)
        }
        expect(goldSaleAgreements(state, player.playerId, city)).toEqual({
            oreBonus: true,
            discount: true,
            ignoreDragon: true,
            pointBuy: { letter: AgreementLetter.Four, cost: 9, victoryPoints: 6, fromIncome: false }
        })
    })

    it('leaves the original agreements working as before', () => {
        const state = startedState()
        const player = state.players[0]!
        player.agreements = [
            { cityId: city, letter: AgreementLetter.A },
            { cityId: city, letter: AgreementLetter.D }
        ]
        expect(goldSaleAgreements(state, player.playerId, city)).toEqual({
            oreBonus: true,
            discount: false,
            ignoreDragon: false,
            pointBuy: { letter: AgreementLetter.D, cost: 6, victoryPoints: 3, fromIncome: true }
        })
    })

    it('charges the front card price for the point buy', () => {
        const state = startedState()
        const player = state.players[0]!
        state.activePlayerIds = [player.playerId]
        player.money = 10
        const victoryPoints = player.victoryPoints
        state.pendingAgreementBuy = {
            cityId: city,
            income: 4,
            letter: AgreementLetter.Three,
            cost: 7,
            victoryPoints: 5
        }
        new HydratedAgreementPointBuy({
            id: 'buy',
            gameId: state.gameId,
            source: 'user',
            type: ActionType.AgreementPointBuy,
            playerId: player.playerId,
            buy: true
        } as never).apply(state)
        expect(player.money).toBe(3)
        expect(player.victoryPoints).toBe(victoryPoints + 5)
        expect(state.pendingAgreementBuy).toBeUndefined()
    })
})
