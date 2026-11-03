import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from '../definition/gameDefinition.js'
import type { RockyVenturesGameState } from '../model/gameState.js'
import { DeliveryCityId } from '../data/board.js'
import { AgreementLetter, TwoSidedAgreementLetters } from '../data/agreements.js'
import { TwoSidedAgreementGameIds } from './runningGameMigrations.js'

const engine = new GameEngine(Definition.runtime)

// A stored state as an older game would have it: original agreements and the 1-gem start.
function oldGameState(gameId: string): RockyVenturesGameState {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: gameId,
            typeId: Definition.info.id,
            ownerId: 'p0',
            seed: 1,
            config: normalizeGameConfig(defaultGameConfig(Definition.info.configurator?.options ?? [])),
            players: [0, 1].map((index) => ({ id: `p${index}`, name: `P${index}`, isHuman: true, status: PlayerStatus.Joined }))
        },
        Definition
    )
    const state = structuredClone(engine.startGame(game).initialState) as RockyVenturesGameState
    state.agreementStacks = {
        [DeliveryCityId.Dornoch]: [AgreementLetter.C, AgreementLetter.A, AgreementLetter.D, AgreementLetter.B],
        [DeliveryCityId.Manor]: [AgreementLetter.B, AgreementLetter.D, AgreementLetter.A, AgreementLetter.C]
    }
    for (const player of state.players) {
        player.gems = 1
    }
    return state
}

describe('switching a running game to the two-sided agreements', () => {
    it('swaps the piles and adds a gem in a listed game', () => {
        const stored = oldGameState('listed-game')
        TwoSidedAgreementGameIds.push(stored.gameId)
        const state = Definition.runtime.hydrator.hydrateState(stored)
        expect(state.agreementStacks[DeliveryCityId.Dornoch]).toEqual(TwoSidedAgreementLetters)
        expect(state.agreementStacks[DeliveryCityId.Manor]).toEqual(TwoSidedAgreementLetters)
        expect(state.players.map((player) => player.gems)).toEqual([2, 2])

        // Loading the switched state again changes nothing more.
        const again = Definition.runtime.hydrator.hydrateState(structuredClone(state.dehydrate()))
        expect(again.players.map((player) => player.gems)).toEqual([2, 2])
        TwoSidedAgreementGameIds.pop()
    })

    it('leaves other games alone', () => {
        const state = Definition.runtime.hydrator.hydrateState(oldGameState('other-game'))
        expect(state.agreementStacks[DeliveryCityId.Dornoch]![0]).toBe(AgreementLetter.C)
        expect(state.players.map((player) => player.gems)).toEqual([1, 1])
    })
})
