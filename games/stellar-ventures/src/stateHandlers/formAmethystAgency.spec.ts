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
import { FormAmethystAgencyStateHandler } from './formAmethystAgency.js'
import { HydratedPlaceShareBid, PlaceShareBid } from '../actions/placeShareBid.js'
import { HydratedPassShareBid, PassShareBid } from '../actions/passShareBid.js'
import {
    HydratedChooseAmethystHomePlanet,
    ChooseAmethystHomePlanet
} from '../actions/chooseAmethystHomePlanet.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { AmethystCandidateHomeHexIds } from '../data/alphaBoard.js'
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
    initialState.era = 3
    initialState.machineState = MachineState.FormAmethystAgency
    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function placeShareBid(
    state: HydratedStellarVenturesGameState,
    handler: FormAmethystAgencyStateHandler,
    playerId: string,
    amount: number
) {
    const context = createMachineContext(state)
    const action = new HydratedPlaceShareBid({
        id: `bid-${playerId}-${amount}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PlaceShareBid,
        playerId,
        amount
    } as PlaceShareBid)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.FormAmethystAgency) {
        handler.enter(context)
    }
}

function passShareBid(
    state: HydratedStellarVenturesGameState,
    handler: FormAmethystAgencyStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedPassShareBid({
        id: `pass-bid-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PassShareBid,
        playerId
    } as PassShareBid)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.FormAmethystAgency) {
        handler.enter(context)
    }
}

function chooseAmethystHomePlanet(
    state: HydratedStellarVenturesGameState,
    handler: FormAmethystAgencyStateHandler,
    playerId: string,
    hexId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedChooseAmethystHomePlanet({
        id: `choose-home-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.ChooseAmethystHomePlanet,
        playerId,
        hexId
    } as ChooseAmethystHomePlanet)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    return action
}

describe('FormAmethystAgencyStateHandler', () => {
    it('opens the Formation Auction with the Director bidding first', () => {
        const state = createTestState()
        const handler = new FormAmethystAgencyStateHandler()

        handler.enter(createMachineContext(state))

        expect(state.activeShareAuction).toBeDefined()
        expect(state.shareAuctionBidOrder?.[0]).toBe(state.directorPlayerId)
        expect(state.shareAuctionCurrentBidderId).toBe(state.directorPlayerId)
        expect(state.activePlayerIds).toEqual([state.directorPlayerId])
    })

    it('only allows the current bidder to place or pass', () => {
        const state = createTestState()
        const handler = new FormAmethystAgencyStateHandler()
        handler.enter(createMachineContext(state))

        const [bidder, other] = state.shareAuctionBidOrder!
        const context = createMachineContext(state)

        expect(handler.validActionsForPlayer(other!, context)).toEqual([])
        expect(handler.validActionsForPlayer(bidder!, context)).toEqual([ActionType.PlaceShareBid])
    })

    it("resolves the auction, issuing Amethyst Agency's first Share to the winner, and awaits their Home Planet choice", () => {
        const state = createTestState()
        const handler = new FormAmethystAgencyStateHandler()
        handler.enter(createMachineContext(state))

        const [b1, b2, b3, b4] = state.shareAuctionBidOrder!
        expect(b1).toBe(state.directorPlayerId)

        placeShareBid(state, handler, b1!, 4)
        passShareBid(state, handler, b2!)
        passShareBid(state, handler, b3!)
        passShareBid(state, handler, b4!)

        const corporation = state.getCorporation(CorporationId.AmethystAgency)
        expect(state.activeShareAuction).toBeUndefined()
        expect(corporation.getPresidentPlayerId()).toBe(b1)
        expect(corporation.treasury).toBe(4)
        expect(corporation.issuedShareCount).toBe(1)
        expect(corporation.active).toBe(false) // not fully formed until its Home Planet is chosen
        expect(state.activePlayerIds).toEqual([b1])
    })

    it('restricts the Home Planet choice to the elected President, among the 3 candidate planets', () => {
        const state = createTestState()
        const handler = new FormAmethystAgencyStateHandler()
        handler.enter(createMachineContext(state))

        const [b1, b2] = state.shareAuctionBidOrder!
        placeShareBid(state, handler, b1!, 0)
        passShareBid(state, handler, b2!)
        // Remaining bidders auto-pass in turn since the auction ends once only b1 is left, but
        // exercise the rest of bid order too for realism.
        for (const playerId of state.shareAuctionBidOrder ?? []) {
            if (playerId !== b1 && playerId !== b2 && state.activeShareAuction) {
                passShareBid(state, handler, playerId)
            }
        }

        expect(
            HydratedChooseAmethystHomePlanet.canChooseAmethystHomePlanet(state, b2!)
        ).toBe(false)
        expect(
            HydratedChooseAmethystHomePlanet.canChooseAmethystHomePlanet(state, b1!)
        ).toBe(true)
        expect(HydratedChooseAmethystHomePlanet.availableHomePlanetHexIds(state)).toEqual(
            AmethystCandidateHomeHexIds
        )

        const context = createMachineContext(state)
        expect(handler.validActionsForPlayer(b2!, context)).toEqual([])
        expect(handler.validActionsForPlayer(b1!, context)).toEqual([
            ActionType.ChooseAmethystHomePlanet
        ])
    })

    it('choosing a Home Planet places a free Outpost, activates the Corporation, and appends it to Corporation Turn Order at position 6', () => {
        const state = createTestState()
        const handler = new FormAmethystAgencyStateHandler()
        handler.enter(createMachineContext(state))

        const [b1] = state.shareAuctionBidOrder!
        placeShareBid(state, handler, b1!, 0)
        for (const playerId of state.shareAuctionBidOrder ?? []) {
            if (playerId !== b1 && state.activeShareAuction) {
                passShareBid(state, handler, playerId)
            }
        }

        const turnOrderBefore = [...state.corporationTurnOrder]
        const chosenHexId = AmethystCandidateHomeHexIds[0]!

        chooseAmethystHomePlanet(state, handler, b1!, chosenHexId)

        const corporation = state.getCorporation(CorporationId.AmethystAgency)
        expect(state.board.hasOutpost(chosenHexId, CorporationId.AmethystAgency)).toBe(true)
        expect(corporation.homePlanetId).toBe(chosenHexId)
        expect(corporation.active).toBe(true)
        expect(corporation.turnOrderPosition).toBe(5)
        expect(state.corporationTurnOrder).toEqual([...turnOrderBefore, CorporationId.AmethystAgency])
        // Confirmed from the Alpha map: all 3 Amethyst Agency candidate Home Planets are value 2.
        expect(state.board.miningCapacityForCorporation(CorporationId.AmethystAgency)).toBe(2)
        expect(state.machineState).toBe(MachineState.IssueShare)
        expect(state.activeCorporationIndex).toBe(0)

        // Amethyst Agency FAQ (page 23): gains its Formation Power directly, never drafting a
        // second one from the Corporate Power pool the way an Initial Auction President would.
        expect(corporation.hasActivePower(CorporatePowerId.SecretAgents)).toBe(true)
        expect(corporation.powers).toHaveLength(1)
    })

    it('rejects a Home Planet choice for a hex that is not one of the 3 candidates', () => {
        const state = createTestState()
        const handler = new FormAmethystAgencyStateHandler()
        handler.enter(createMachineContext(state))

        const [b1] = state.shareAuctionBidOrder!
        placeShareBid(state, handler, b1!, 0)
        for (const playerId of state.shareAuctionBidOrder ?? []) {
            if (playerId !== b1 && state.activeShareAuction) {
                passShareBid(state, handler, playerId)
            }
        }

        const action = new HydratedChooseAmethystHomePlanet({
            id: `choose-home-${b1}-${state.actionCount}`,
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.ChooseAmethystHomePlanet,
            playerId: b1!,
            hexId: '2,0' // a Deep Space hex - not one of Amethyst Agency's candidates
        } as ChooseAmethystHomePlanet)

        expect(() => action.apply(state, createMachineContext(state))).toThrow()
    })
})
