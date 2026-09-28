import {
    GameCategory,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { ScrapLowestShipStateHandler } from './scrapLowestShip.js'
import { HydratedScrapLowestShip, isScrapLowestShip } from '../actions/scrapLowestShip.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

function createTestState(playerCount = 4) {
    const players: Player[] = Array.from({ length: playerCount }, (_, index) => ({
        id: `p${index + 1}`,
        isHuman: true,
        userId: `u${index + 1}`,
        name: `Player ${index + 1}`,
        status: PlayerStatus.Joined
    }))

    const game: Game = {
        id: 'game-1',
        typeId: 'stellar-ventures',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Stellar Ventures Test',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }

    const initialState = new StellarVenturesGameInitializer().initializeGameState(game, state)
    initialState.machineState = MachineState.ScrapLowestShip
    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

// Mirrors ReleaseDividendsStateHandler's spec: enter() queues a System action, and this helper
// pops/applies/transitions exactly as the engine would, without any player ever submitting
// anything themselves.
function runScrapLowestShip(state: HydratedStellarVenturesGameState, handler: ScrapLowestShipStateHandler) {
    const context = createMachineContext(state)
    handler.enter(context)

    const pending = context.getPendingActions()
    expect(pending).toHaveLength(1)
    expect(isScrapLowestShip(pending[0])).toBe(true)

    const actionData = context.nextPendingAction()
    if (!actionData || !isScrapLowestShip(actionData)) {
        throw Error('Expected a queued ScrapLowestShip action')
    }
    const action = new HydratedScrapLowestShip(actionData)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    return action
}

describe('ScrapLowestShipStateHandler', () => {
    it('queues a System ScrapLowestShip action with no player involvement', () => {
        const state = createTestState()
        const handler = new ScrapLowestShipStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        expect(state.activePlayerIds).toEqual([])
        expect(handler.validActionsForPlayer('p1', context)).toEqual([])
        const pending = context.getPendingActions()
        expect(pending).toHaveLength(1)
        expect(pending[0]?.playerId).toBeUndefined()
        expect(isScrapLowestShip(pending[0])).toBe(true)
    })

    it("removes one Ship token from the Shipyard's current lowest available section", () => {
        const state = createTestState()
        const handler = new ScrapLowestShipStateHandler()
        const levelOneSection = state.shipyard.sectionForLevel(1)!
        const remainingBefore = levelOneSection.remainingShips

        const action = runScrapLowestShip(state, handler)

        expect(action.scrappedLevel).toBe(1)
        expect(levelOneSection.remainingShips).toBe(remainingBefore - 1)
        expect(state.machineState).toBe(MachineState.DeliverShips)
    })

    it('does not decrement the unlimited Level 8 section, but still resolves its first-ship effects', () => {
        const state = createTestState()
        const handler = new ScrapLowestShipStateHandler()
        // Exhaust every finite section so Level 8 (unlimited) becomes the lowest available.
        for (const level of [1, 2, 3, 5]) {
            state.shipyard.sectionForLevel(level)!.remainingShips = 0
        }
        const level8Section = state.shipyard.sectionForLevel(8)!
        // Confirmed from the Alpha map's printed Shipyard track: Level 8 scraps Level 3.
        level8Section.scrapTargetLevel = 3
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.deliveredShipLevels = [3]
        corporation.cargo = 5

        const action = runScrapLowestShip(state, handler)

        expect(action.scrappedLevel).toBe(8)
        expect(level8Section.remainingShips).toBe(0) // unchanged - unlimited
        expect(level8Section.firstShipOrdered).toBe(true)
        expect(level8Section.hasTriggeredScrappingEvent).toBe(true)
        expect(corporation.deliveredShipLevels).toEqual([])
        expect(corporation.cargo).toBe(4)
    })

    it("flags itself as revealing info when it happens to flip a section's Alien Shipyard tile", () => {
        const state = createTestState()
        const handler = new ScrapLowestShipStateHandler()
        state.shipyard.sectionForLevel(1)!.alienTileChevrons = 2

        const action = runScrapLowestShip(state, handler)

        expect(state.shipyard.sectionForLevel(1)!.alienTileRevealed).toBe(true)
        // A System action, but still flagged - Undo must not be able to step back past whichever
        // human action led to it (see GameSession.undoableAction).
        expect(action.revealsInfo).toBe(true)
    })

    it("does not flag itself as revealing info once a section's tile is already used up", () => {
        const state = createTestState()
        const handler = new ScrapLowestShipStateHandler()
        state.shipyard.sectionForLevel(1)!.firstShipOrdered = true

        const action = runScrapLowestShip(state, handler)

        expect(action.revealsInfo).toBeUndefined()
    })

    it("does not re-trigger a section's first-ship effects once they've already resolved", () => {
        const state = createTestState()
        const handler = new ScrapLowestShipStateHandler()
        state.shipyard.sectionForLevel(1)!.remainingShips = 0
        state.shipyard.sectionForLevel(2)!.remainingShips = 0
        const levelThreeSection = state.shipyard.sectionForLevel(3)!
        const remainingBefore = levelThreeSection.remainingShips
        levelThreeSection.firstShipOrdered = true // already resolved via a prior Order Ship
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.deliveredShipLevels = [1]
        corporation.cargo = 5

        const action = runScrapLowestShip(state, handler)

        expect(action.scrappedLevel).toBe(3)
        expect(levelThreeSection.remainingShips).toBe(remainingBefore - 1) // supply still drops
        // The Scrapping Event does not fire again - the Level-1 Ship survives.
        expect(corporation.deliveredShipLevels).toEqual([1])
        expect(corporation.cargo).toBe(5)
    })

    it('detours to Offer Spare Parts when the triggered Scrapping Event would remove a Delivered Ship from its holder', () => {
        const state = createTestState()
        const handler = new ScrapLowestShipStateHandler()
        for (const level of [1, 2, 3, 5]) {
            state.shipyard.sectionForLevel(level)!.remainingShips = 0
        }
        state.shipyard.sectionForLevel(8)!.scrapTargetLevel = 3

        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.powers = [{ id: CorporatePowerId.SpareParts }]
        corporation.deliveredShipLevels = [3]
        corporation.cargo = 5

        const action = runScrapLowestShip(state, handler)

        expect(action.scrappedLevel).toBe(8)
        expect(state.machineState).toBe(MachineState.OfferSpareParts)
        expect(state.pendingSparePartsCorporationId).toBe(CorporationId.PinkInc)
        expect(state.pendingSparePartsShipLevel).toBe(3)
        expect(state.pendingSparePartsResumeState).toBe(MachineState.DeliverShips)
        expect(corporation.deliveredShipLevels).toEqual([])
        expect(corporation.cargo).toBe(5)
    })
})
