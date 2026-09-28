import {
    ActionSource,
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
import { OrderShipsStateHandler } from './orderShips.js'
import { HydratedOrderShip, OrderShip } from '../actions/orderShip.js'
import { HydratedDeclineOrderShips, DeclineOrderShips } from '../actions/declineOrderShips.js'
import { HydratedLeakedResearch, LeakedResearch } from '../actions/leakedResearch.js'
import {
    HydratedForcedShipPurchase,
    ForcedShipPurchase
} from '../actions/forcedShipPurchase.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

function createTestState(playerCount = 2) {
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

    const pinkIncIndex = initialState.corporationTurnOrder.indexOf(CorporationId.PinkInc)
    initialState.activeCorporationIndex = pinkIncIndex
    const corporation = initialState.getCorporation(CorporationId.PinkInc)
    corporation.issueShareToPlayer('p1', 0)
    corporation.treasury = 50
    initialState.machineState = MachineState.OrderShips

    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function orderShip(
    state: HydratedStellarVenturesGameState,
    handler: OrderShipsStateHandler,
    playerId: string,
    level: number
) {
    const context = createMachineContext(state)
    const action = new HydratedOrderShip({
        id: `order-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.OrderShip,
        playerId,
        level
    } as OrderShip)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.OrderShips) {
        handler.enter(context)
    }
    return action
}

function declineOrderShips(
    state: HydratedStellarVenturesGameState,
    handler: OrderShipsStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedDeclineOrderShips({
        id: `decline-${playerId}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DeclineOrderShips,
        playerId
    } as DeclineOrderShips)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.OrderShips) {
        handler.enter(context)
    }
}

function leakedResearch(
    state: HydratedStellarVenturesGameState,
    handler: OrderShipsStateHandler,
    playerId: string,
    corporationId: CorporationId
) {
    const context = createMachineContext(state)
    const action = new HydratedLeakedResearch({
        id: `leaked-research-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.LeakedResearch,
        playerId,
        corporationId
    } as LeakedResearch)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.OrderShips) {
        handler.enter(context)
    }
}

function forcedShipPurchase(
    state: HydratedStellarVenturesGameState,
    handler: OrderShipsStateHandler,
    playerId: string,
    hexIds: string[]
) {
    const context = createMachineContext(state)
    const action = new HydratedForcedShipPurchase({
        id: `forced-ship-purchase-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.ForcedShipPurchase,
        playerId,
        hexIds
    } as ForcedShipPurchase)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.OrderShips) {
        handler.enter(context)
    }
    return action
}

describe('OrderShipsStateHandler', () => {
    it('starts with the active Corporation President as the only active player', () => {
        const state = createTestState()
        const handler = new OrderShipsStateHandler()
        handler.enter(createMachineContext(state))
        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('forces at least 1 Ship to be Ordered for a Corporation with none, and blocks Decline', () => {
        const state = createTestState()
        const handler = new OrderShipsStateHandler()
        const context = createMachineContext(state)

        expect(HydratedDeclineOrderShips.canDeclineOrderShips(state, 'p1')).toBe(false)
        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.OrderShip])

        orderShip(state, handler, 'p1', 1)

        const corporation = state.getCorporation(CorporationId.PinkInc)
        expect(corporation.orderedShipLevels).toEqual([1])
        expect(corporation.treasury).toBe(50 - 1)
        expect(HydratedDeclineOrderShips.canDeclineOrderShips(state, 'p1')).toBe(true)
    })

    it('allows Ordering up to 1 Ship per empty column, then blocks a 4th', () => {
        const state = createTestState()
        const handler = new OrderShipsStateHandler()

        orderShip(state, handler, 'p1', 1)
        orderShip(state, handler, 'p1', 1)
        orderShip(state, handler, 'p1', 1)

        const corporation = state.getCorporation(CorporationId.PinkInc)
        expect(corporation.orderedShipLevels).toEqual([1, 1, 1])
        expect(HydratedOrderShip.canOrderShip(state, 'p1', 1)).toBe(false)
        expect(HydratedOrderShip.canOfferOrderShip(state, 'p1')).toBe(false)
    })

    it('only allows Ordering from the Shipyard current lowest available level', () => {
        const state = createTestState()
        // Deplete Level 1 entirely so Level 2 becomes the lowest available.
        state.shipyard.sectionForLevel(1)!.remainingShips = 0

        expect(HydratedOrderShip.canOrderShip(state, 'p1', 1)).toBe(false)
        expect(HydratedOrderShip.canOrderShip(state, 'p1', 2)).toBe(true)
    })

    it('rejects OrderShip and DeclineOrderShips from a non-President player', () => {
        const state = createTestState()
        expect(HydratedOrderShip.canOrderShip(state, 'p2', 1)).toBe(false)
        expect(HydratedDeclineOrderShips.canDeclineOrderShips(state, 'p2')).toBe(false)
    })

    it('flips the Alien Shipyard tile only on a section\'s first-ever Ship Order', () => {
        const state = createTestState()
        state.shipyard.sectionForLevel(1)!.remainingShips = 0
        state.shipyard.sectionForLevel(2)!.alienTileChevrons = 2
        const startingAlienCapacity = state.alienCorporation.miningCapacity
        const handler = new OrderShipsStateHandler()

        const firstOrder = orderShip(state, handler, 'p1', 2)
        expect(state.alienCorporation.miningCapacity).toBe(startingAlienCapacity + 2 * 3)
        expect(state.shipyard.sectionForLevel(2)!.alienTileRevealed).toBe(true)
        // Undo must not be able to step back past whichever Order happens to be the one that
        // reveals a hidden tile - see GameSession.undoableAction.
        expect(firstOrder.revealsInfo).toBe(true)

        const secondOrder = orderShip(state, handler, 'p1', 2)
        // Second Order from the same (already-revealed) section does not re-trigger the bump,
        // and - since nothing hidden was revealed this time - stays freely undoable.
        expect(state.alienCorporation.miningCapacity).toBe(startingAlienCapacity + 2 * 3)
        expect(secondOrder.revealsInfo).toBeUndefined()
    })

    it('does not flag an Order as revealing info when its section has no Alien Shipyard tile', () => {
        const state = createTestState()
        state.shipyard.sectionForLevel(1)!.alienTileChevrons = undefined
        const handler = new OrderShipsStateHandler()

        const order = orderShip(state, handler, 'p1', 1)
        expect(order.revealsInfo).toBeUndefined()
    })

    it('triggers a Scrapping Event across every Corporation on the first Ship Ordered from that section', () => {
        const state = createTestState()
        // Deplete Levels 1 and 2 so Level 3 (which scraps Level 1 - see initializer.ts) becomes
        // the lowest available.
        state.shipyard.sectionForLevel(1)!.remainingShips = 0
        state.shipyard.sectionForLevel(2)!.remainingShips = 0

        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        pinkInc.deliveredShipLevels = [1, 2]
        pinkInc.cargo = 5

        const frostFederated = state.getCorporation(CorporationId.FrostFederated)
        frostFederated.deliveredShipLevels = [1]
        frostFederated.cargo = 3
        frostFederated.orderedShipLevels = [1]

        const handler = new OrderShipsStateHandler()
        orderShip(state, handler, 'p1', 3)

        // PinkInc's own Level-1 Delivered Ship is scrapped (Level-2 is untouched).
        expect(pinkInc.deliveredShipLevels).toEqual([2])
        expect(pinkInc.cargo).toBe(4)

        // FrostFederated's Level-1 Ships (Delivered AND still-Ordered) are removed too, even
        // though it isn't the active Corporation - Scrapping Events apply to everyone.
        expect(frostFederated.deliveredShipLevels).toEqual([])
        expect(frostFederated.orderedShipLevels).toEqual([])
        expect(frostFederated.cargo).toBe(2)

        expect(state.shipyard.sectionForLevel(3)!.hasTriggeredScrappingEvent).toBe(true)
    })

    it('detours to Offer Spare Parts when the triggered Scrapping Event would remove a Delivered Ship from its holder', () => {
        const state = createTestState()
        state.shipyard.sectionForLevel(1)!.remainingShips = 0
        state.shipyard.sectionForLevel(2)!.remainingShips = 0

        const frostFederated = state.getCorporation(CorporationId.FrostFederated)
        frostFederated.powers = [{ id: CorporatePowerId.SpareParts }]
        frostFederated.deliveredShipLevels = [1]
        frostFederated.cargo = 5

        const handler = new OrderShipsStateHandler()
        orderShip(state, handler, 'p1', 3)

        expect(state.machineState).toBe(MachineState.OfferSpareParts)
        expect(state.pendingSparePartsCorporationId).toBe(CorporationId.FrostFederated)
        expect(state.pendingSparePartsShipLevel).toBe(1)
        expect(state.pendingSparePartsResumeState).toBe(MachineState.OrderShips)
        // Not yet scrapped for real - still pending the President's decision.
        expect(frostFederated.deliveredShipLevels).toEqual([])
        expect(frostFederated.cargo).toBe(5)
    })

    it('advances to the next Corporation\'s Issue Share on Decline', () => {
        const state = createTestState()
        const handler = new OrderShipsStateHandler()
        orderShip(state, handler, 'p1', 1) // satisfy the Forced Purchase minimum

        const startingIndex = state.activeCorporationIndex
        declineOrderShips(state, handler, 'p1')

        expect(state.activeCorporationIndex).toBe(startingIndex + 1)
        expect(state.machineState).toBe(MachineState.IssueShare)
        expect(state.activePlayerIds).toEqual([])
    })

    it('advances to Release Dividends once the last Corporation in turn order Declines', () => {
        const state = createTestState()
        const handler = new OrderShipsStateHandler()
        state.activeCorporationIndex = state.corporationTurnOrder.length - 1
        const lastCorporation = state.getCorporation(state.activeCorporationId!)
        lastCorporation.issueShareToPlayer('p1', 0)
        lastCorporation.treasury = 50

        orderShip(state, handler, 'p1', 1)
        declineOrderShips(state, handler, 'p1')

        expect(state.machineState).toBe(MachineState.ReleaseDividends)
    })

    describe('Leaked Research ("Anytime")', () => {
        it("activates Wormhole Technology, loops back to Order Ships, and doesn't consume the Ship-order decision", () => {
            const state = createTestState()
            const handler = new OrderShipsStateHandler()
            handler.enter(createMachineContext(state))
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            // Every player starts with 1 Alien Technology Cube already (Setup - see
            // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +1/-1
            // below nets back to that starting count instead of assuming it started at 0.
            const cubesBeforeAdd = state.getPlayerState('p1').alienTechCubes
            state.getPlayerState('p1').addAlienTechCubes(1)
            const context = createMachineContext(state)

            expect(handler.validActionsForPlayer('p1', context)).toContain(
                ActionType.LeakedResearch
            )

            leakedResearch(state, handler, 'p1', CorporationId.PinkInc)

            expect(corporation.wormholeActive).toBe(true)
            expect(state.getPlayerState('p1').alienTechCubes).toBe(cubesBeforeAdd)
            expect(state.machineState).toBe(MachineState.OrderShips)
            expect(state.activePlayerIds).toEqual(['p1'])
            // The Forced Purchase requirement (this Corporation has no Ships at all) still
            // applies exactly as before.
            expect(HydratedDeclineOrderShips.canDeclineOrderShips(state, 'p1')).toBe(false)
        })

        it('is not offered to a non-President, even with the power active', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            state.getPlayerState('p2').addAlienTechCubes(1)

            expect(HydratedLeakedResearch.canOfferLeakedResearch(state, 'p2')).toBe(false)
        })
    })

    describe('Forced Purchase "No Credits?" Loans', () => {
        it('takes exactly the minimum Loans needed from unbuilt supply, then Orders the Ship, in one action', () => {
            const state = createTestState()
            const handler = new OrderShipsStateHandler()
            handler.enter(createMachineContext(state))
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.treasury = 0
            const unbuiltBefore = corporation.unbuiltOutposts
            const loanCountBefore = corporation.loanCount

            expect(HydratedOrderShip.canOfferOrderShip(state, 'p1')).toBe(false)
            expect(HydratedDeclineOrderShips.canDeclineOrderShips(state, 'p1')).toBe(false)
            expect(handler.validActionsForPlayer('p1', createMachineContext(state))).toContain(
                ActionType.ForcedShipPurchase
            )

            // Level-1 Ship costs ₮1 - 1 Loan (+₮3) covers it with ₮2 left over.
            forcedShipPurchase(state, handler, 'p1', [])

            expect(corporation.orderedShipLevels).toEqual([1])
            expect(corporation.loanCount).toBe(loanCountBefore + 1)
            expect(corporation.treasury).toBe(0 + 3 - 1)
            expect(corporation.unbuiltOutposts).toBe(unbuiltBefore - 1)
            // The Forced Purchase minimum is now met.
            expect(HydratedDeclineOrderShips.canDeclineOrderShips(state, 'p1')).toBe(true)
        })

        it('flags itself as revealing info when it happens to flip a section\'s Alien Shipyard tile', () => {
            const state = createTestState()
            const handler = new OrderShipsStateHandler()
            handler.enter(createMachineContext(state))
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.treasury = 0
            state.shipyard.sectionForLevel(1)!.alienTileChevrons = 2

            const action = forcedShipPurchase(state, handler, 'p1', [])

            expect(state.shipyard.sectionForLevel(1)!.alienTileRevealed).toBe(true)
            expect(action.revealsInfo).toBe(true)
        })

        function findValuedHex(state: HydratedStellarVenturesGameState) {
            const entry = Object.entries(state.board.hexes).find(
                ([, hex]) => hex.baseValue !== undefined && hex.baseValue > 0
            )
            if (!entry) {
                throw Error('Expected at least one hex with a positive baseValue on the test board')
            }
            return entry
        }

        it('takes Outposts off the board once unbuilt supply is exhausted, reducing Mining Capacity', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.treasury = 0
            corporation.unbuiltOutposts = 0
            const [hexId, hex] = findValuedHex(state)
            hex.outposts.push(CorporationId.PinkInc)
            const miningCapacityBefore = state.board.miningCapacityForCorporation(CorporationId.PinkInc)

            expect(HydratedForcedShipPurchase.canForcedShipPurchase(state, 'p1', [])).toBe(false)
            expect(HydratedForcedShipPurchase.canForcedShipPurchase(state, 'p1', [hexId])).toBe(true)

            const handler = new OrderShipsStateHandler()
            forcedShipPurchase(state, handler, 'p1', [hexId])

            expect(corporation.orderedShipLevels).toEqual([1])
            expect(corporation.loanCount).toBe(1)
            expect(corporation.unbuiltOutposts).toBe(0)
            expect(hex.outposts).not.toContain(CorporationId.PinkInc)
            expect(state.board.miningCapacityForCorporation(CorporationId.PinkInc)).toBeLessThan(
                miningCapacityBefore
            )
        })

        it('rejects a hexIds count that differs from the exact number of Loans needed', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.treasury = 0
            corporation.unbuiltOutposts = 0
            const [hexId, hex] = findValuedHex(state)
            hex.outposts.push(CorporationId.PinkInc)

            expect(HydratedForcedShipPurchase.canForcedShipPurchase(state, 'p1', [])).toBe(false)
            expect(
                HydratedForcedShipPurchase.canForcedShipPurchase(state, 'p1', [hexId, hexId])
            ).toBe(false)
        })

        it('is not offered once the Corporation can already afford the cheapest Ship outright', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.treasury = 50

            expect(HydratedForcedShipPurchase.canOfferForcedShipPurchase(state, 'p1')).toBe(false)
        })

        it('is not offered to a non-President', () => {
            const state = createTestState()
            const corporation = state.getCorporation(CorporationId.PinkInc)
            corporation.treasury = 0

            expect(HydratedForcedShipPurchase.canOfferForcedShipPurchase(state, 'p2')).toBe(false)
        })
    })
})
