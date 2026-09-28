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
import { InitialAuctionStateHandler } from './initialAuction.js'
import { turnOrderStartingWith } from '../operations/auction.js'
import { DraftPowerStateHandler } from './draftPower.js'
import { HydratedPlaceBid, PlaceBid } from '../actions/placeBid.js'
import { HydratedPassAuction, PassAuction } from '../actions/passAuction.js'
import { HydratedDraftPower, DraftPower } from '../actions/draftPower.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId, OutpostSupplyByCorporationId } from '../model/corporation.js'
import { HexType } from '../model/board.js'
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

    // GameEngine.startGame() calls the initial state handler's enter() right after
    // initialization (it isn't called by the initializer itself) - mirror that here so the
    // first Corporation's auction is actually started before tests interact with it.
    const handler = new InitialAuctionStateHandler()
    handler.enter(createMachineContext(initialState))

    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

// Auction resolution now always detours through Draft Power (rulebook page 11's step 4) before
// either the next Corporation's auction or Corporation Round begins - see
// stateHandlers/draftPower.ts. Tests that just need to get past this pick whatever's first in
// the available row.
function draftFirstAvailablePower(
    state: HydratedStellarVenturesGameState,
    context: MachineContext<HydratedStellarVenturesGameState>
) {
    if (state.machineState !== MachineState.DraftPower) {
        return
    }
    const corporationId = state.draftPowerCorporationId
    if (!corporationId) {
        throw new Error('Expected a Corporation pending Draft Power')
    }
    const powerId = state.availableCorporatePowerIds[0]
    if (!powerId) {
        throw new Error('Expected an available Corporate Power to draft in tests')
    }
    const presidentPlayerId = state.getCorporation(corporationId).getPresidentPlayerId()
    if (!presidentPlayerId) {
        throw new Error('Expected a President to draft a Corporate Power')
    }

    const draftHandler = new DraftPowerStateHandler()
    const action = new HydratedDraftPower({
        id: `draft-${corporationId}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DraftPower,
        playerId: presidentPlayerId,
        powerId
    } as DraftPower)
    action.apply(state, context)
    const nextState = draftHandler.onAction(action, context)
    state.machineState = nextState as MachineState
}

function placeBid(
    state: HydratedStellarVenturesGameState,
    handler: InitialAuctionStateHandler,
    playerId: string,
    amount: number
) {
    const context = createMachineContext(state)
    const action = new HydratedPlaceBid({
        id: `bid-${playerId}-${amount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PlaceBid,
        playerId,
        amount
    } as PlaceBid)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    draftFirstAvailablePower(state, context)
    if (state.machineState === MachineState.InitialAuction) {
        handler.enter(context)
    }
}

function passBid(
    state: HydratedStellarVenturesGameState,
    handler: InitialAuctionStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedPassAuction({
        id: `pass-${playerId}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PassAuction,
        playerId
    } as PassAuction)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    draftFirstAvailablePower(state, context)
    if (state.machineState === MachineState.InitialAuction) {
        handler.enter(context)
    }
}

describe('InitialAuctionStateHandler', () => {
    it('starts the first auction on entry, bidding in reverse turn order', () => {
        const state = createTestState(4)
        expect(state.machineState).toBe(MachineState.InitialAuction)
        expect(state.initialAuctionQueue.length).toBe(4) // 5 corporations minus the one popped on entry
        expect(state.activeInitialAuction).toBeDefined()
        expect(state.activeInitialAuctionCorporationId).toBeDefined()

        const expectedBidOrder = [...state.turnManager.turnOrder].reverse()
        expect(state.initialAuctionBidOrder).toEqual(expectedBidOrder)
        expect(state.initialAuctionCurrentBidderId).toBe(expectedBidOrder[0])
        expect(state.activePlayerIds).toEqual([expectedBidOrder[0]])
    })

    it('runs the Corporation Round turn order in reverse of the Initial Auction queue', () => {
        // Confirmed by the game's co-designer: whichever Corporation gets auctioned (and drafts
        // its second Power) first should be the LAST to actually take a turn once the
        // Corporation Round begins - a balancing tradeoff for that early pick.
        const state = createTestState(4)
        const fullAuctionOrder = [state.activeInitialAuctionCorporationId, ...state.initialAuctionQueue]
        expect(state.corporationTurnOrder).toEqual([...fullAuctionOrder].reverse())
    })

    it('sets up Setup values per the rulebook (starting funds, shares, shipyard)', () => {
        const state = createTestState(4)

        // 120-fund pool split evenly among 4 players.
        for (const player of state.players) {
            expect(player.liquidFunds).toBe(30)
        }

        // Setup step 16.e: every player starts with 6 Boardroom Votes.
        for (const player of state.players) {
            expect(player.boardroomVotes).toBe(6)
        }

        // Confirmed by the game's co-designer: every player also starts with 1 Alien
        // Technology Cube.
        for (const player of state.players) {
            expect(player.alienTechCubes).toBe(1)
        }

        // Every corporation has 5 shares, except Amethyst Agency which has 3.
        for (const corporation of state.corporations) {
            const expectedShares = corporation.id === CorporationId.AmethystAgency ? 3 : 5
            expect(corporation.shares.length).toBe(expectedShares)
        }

        // Amethyst Agency has a CorporationState from the start, but sits out - inactive, no
        // Home Planet, not part of Corporation Turn Order - until it's formed at the start of
        // Era 3 (rulebook page 9). It begins with Wormhole Technology already Active though
        // (rulebook page 3's setup reminder), unlike every other Corporation.
        const amethystAgency = state.getCorporation(CorporationId.AmethystAgency)
        expect(amethystAgency.active).toBe(false)
        expect(amethystAgency.wormholeActive).toBe(true)
        expect(amethystAgency.homePlanetId).toBeUndefined()
        expect(amethystAgency.turnOrderPosition).toBe(5)
        expect(state.corporationTurnOrder).not.toContain(CorporationId.AmethystAgency)
        expect(state.corporationTurnOrder.length).toBe(5)

        // Setup step 15b: every starting Corporation's Charter begins with the "Alien Explorers"
        // Corporate Power active. Amethyst Agency instead begins with no Powers yet - it gains
        // "Secret Agents" once formed at Era 3 (see actions/chooseAmethystHomePlanet.ts).
        for (const corporation of state.corporations) {
            const expectedHasAlienExplorers = corporation.id !== CorporationId.AmethystAgency
            expect(corporation.hasActivePower(CorporatePowerId.AlienExplorers)).toBe(
                expectedHasAlienExplorers
            )
        }

        // Setup step 17: of the 18 Neutral Corporate Power tiles, only 11 are used this game -
        // 6 dealt into a visible row and 5 into a hidden draw pile (the other 7 are left out
        // entirely, returned to the box unused).
        expect(state.availableCorporatePowerIds).toHaveLength(6)
        expect(state.corporatePowerDrawPileIds).toHaveLength(5)
        const allDealtIds = [...state.availableCorporatePowerIds, ...state.corporatePowerDrawPileIds]
        expect(new Set(allDealtIds).size).toBe(11) // no duplicates
        expect(allDealtIds).not.toContain(CorporatePowerId.AlienExplorers)
        expect(allDealtIds).not.toContain(CorporatePowerId.SecretAgents)

        // Setup places 1 Home Planet Outpost for each of the 5 starting Corporations, so each
        // begins 1 short of its full physical Outpost supply (OutpostSupplyByCorporationId) -
        // Amethyst Agency hasn't placed its Home Planet Outpost yet, so it starts at its full
        // supply of 15.
        for (const corporation of state.corporations) {
            const expectedUnbuilt =
                OutpostSupplyByCorporationId[corporation.id] -
                (corporation.id === CorporationId.AmethystAgency ? 0 : 1)
            expect(corporation.unbuiltOutposts).toBe(expectedUnbuilt)
        }

        // Shipyard starts with 9/7/9/5 ships at levels 1/2/3/5; Level 8 is unlimited (the board
        // prints an infinity symbol there rather than a count - see the initializer).
        const shipCounts = Object.fromEntries(
            state.shipyard.sections.map((section) => [section.level, section])
        )
        expect(shipCounts[1]?.remainingShips).toBe(9)
        expect(shipCounts[2]?.remainingShips).toBe(7)
        expect(shipCounts[3]?.remainingShips).toBe(9)
        expect(shipCounts[5]?.remainingShips).toBe(5)
        expect(shipCounts[8]?.unlimited).toBe(true)
    })

    it('New Investor Setup assigns Presidents to the 5 starting Corporations only, never Amethyst Agency', () => {
        const players: Player[] = Array.from({ length: 4 }, (_, index) => ({
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
            config: { useNewInvestorSetup: true },
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

        expect(initialState.machineState).toBe(MachineState.IssueShare)
        for (const corporation of initialState.corporations) {
            if (corporation.id === CorporationId.AmethystAgency) {
                expect(corporation.issuedShareCount).toBe(0)
                expect(corporation.getPresidentPlayerId()).toBeUndefined()
            } else {
                expect(corporation.issuedShareCount).toBe(1)
                expect(corporation.getPresidentPlayerId()).toBeDefined()
            }
        }
    })

    it('deals 3 of the 5 Alien Shipyard Tiles onto Levels 2, 3 and 5, hidden until revealed', () => {
        const state = createTestState(4)

        const shipCounts = Object.fromEntries(
            state.shipyard.sections.map((section) => [section.level, section])
        )

        // Levels 1 and 8 have no Alien Shipyard Tile hex on the Alpha map.
        expect(shipCounts[1]?.alienTileChevrons).toBeUndefined()
        expect(shipCounts[8]?.alienTileChevrons).toBeUndefined()

        // Levels 2, 3 and 5 each get 1 of the 5 physical tiles (chevron counts 3, 2, 1, 1, 0 -
        // confirmed from SV_PUNCHBOARD_FINAL.pdf), dealt but not yet revealed.
        const dealtChevrons = [
            shipCounts[2]?.alienTileChevrons,
            shipCounts[3]?.alienTileChevrons,
            shipCounts[5]?.alienTileChevrons
        ]
        for (const chevrons of dealtChevrons) {
            expect(chevrons).not.toBeUndefined()
            expect([0, 1, 2, 3]).toContain(chevrons)
        }
        expect(shipCounts[2]?.alienTileRevealed).toBeUndefined()
        expect(shipCounts[3]?.alienTileRevealed).toBeUndefined()
        expect(shipCounts[5]?.alienTileRevealed).toBeUndefined()
    })

    it('deals 1 of the 10 Alien Agreement Tiles face-down to each of the 7 Alien Planet hexes', () => {
        const state = createTestState(4)

        const alienPlanetHexes = Object.values(state.board.hexes).filter(
            (hex) => hex.type === HexType.AlienPlanet
        )
        expect(alienPlanetHexes).toHaveLength(7)

        for (const hex of alienPlanetHexes) {
            expect(hex.alienAgreementTileHidden).toBe(true)
            expect([0, 1, 2, 3, 4]).toContain(hex.alienAgreementTileChevrons)
        }

        // Every non-Alien-Planet hex gets no tile at all.
        const otherHexes = Object.values(state.board.hexes).filter(
            (hex) => hex.type !== HexType.AlienPlanet
        )
        for (const hex of otherHexes) {
            expect(hex.alienAgreementTileHidden).toBeUndefined()
            expect(hex.alienAgreementTileChevrons).toBeUndefined()
        }
    })

    it('runs a full auction to completion and issues the winner a share', () => {
        const state = createTestState(4)
        const handler = new InitialAuctionStateHandler()
        const bidOrder = [...state.turnManager.turnOrder].reverse()
        const [p1, p2, p3, p4] = bidOrder
        if (!p1 || !p2 || !p3 || !p4) {
            throw new Error('Expected 4 players in bid order')
        }
        const corporationId = state.activeInitialAuctionCorporationId
        expect(corporationId).toBeDefined()
        if (!corporationId) return

        placeBid(state, handler, p1, 5)
        passBid(state, handler, p2)
        placeBid(state, handler, p3, 10)
        passBid(state, handler, p4)
        // p1 and p3 are still active at this point (count 2); p1 passing brings it down to the
        // single remaining active bidder (p3), which resolves the auction in p3's favor.
        passBid(state, handler, p1)

        const corporation = state.getCorporation(corporationId)
        expect(corporation.getPresidentPlayerId()).toBe(p3)
        expect(corporation.treasury).toBe(10)
        // 4 players share the 120-fund starting pool: 120 / 4 = 30 each.
        expect(state.getPlayerState(p3).liquidFunds).toBe(30 - 10)

        // Auction state should be cleared and the next corporation's auction started, having
        // drafted a second Corporate Power along the way (see draftFirstAvailablePower).
        expect(state.activeInitialAuctionCorporationId).not.toBe(corporationId)
        expect(state.activeInitialAuction).toBeDefined()
        expect(state.machineState).toBe(MachineState.InitialAuction)
        expect(corporation.powers).toHaveLength(2)
        expect(corporation.hasActivePower(CorporatePowerId.AlienExplorers)).toBe(true)
    })

    it("starts every subsequent auction with (and proceeding clockwise from) the previous auction's winner, not reverse turn order again", () => {
        // Confirmed by the game's co-designer: only the very first Corporation's auction bids in
        // reverse turn order. Every auction after that should instead start with whoever just
        // won, not repeat the same reverse-turn-order start.
        const state = createTestState(4)
        const handler = new InitialAuctionStateHandler()
        const firstBidOrder = [...state.turnManager.turnOrder].reverse()
        const [p1, p2, p3, p4] = firstBidOrder
        if (!p1 || !p2 || !p3 || !p4) {
            throw new Error('Expected 4 players in bid order')
        }

        // Resolve the first auction with p3 as the winner (same sequence as the "runs a full
        // auction to completion" test above).
        placeBid(state, handler, p1, 5)
        passBid(state, handler, p2)
        placeBid(state, handler, p3, 10)
        passBid(state, handler, p4)
        passBid(state, handler, p1)

        expect(state.previousInitialAuctionWinnerId).toBe(p3)

        const expectedSecondBidOrder = turnOrderStartingWith(state.turnManager.turnOrder, p3)
        // The previous (reverse turn order) start should not still apply.
        expect(expectedSecondBidOrder).not.toEqual(firstBidOrder)
        expect(state.initialAuctionBidOrder).toEqual(expectedSecondBidOrder)
        expect(state.initialAuctionCurrentBidderId).toBe(expectedSecondBidOrder[0])
        expect(state.activePlayerIds).toEqual([expectedSecondBidOrder[0]])
    })

    it('auto-skips a player who cannot afford to outbid the current high bid', () => {
        // Confirmed by the game's co-designer: a player who mathematically can't cover the next
        // minimum bid should be skipped over automatically, moving straight on to the next
        // player who actually could bid, rather than requiring them to manually click Pass.
        const state = createTestState(4)
        const handler = new InitialAuctionStateHandler()
        const bidOrder = [...state.turnManager.turnOrder].reverse()
        const [p1, p2, p3, p4] = bidOrder
        if (!p1 || !p2 || !p3 || !p4) {
            throw new Error('Expected 4 players in bid order')
        }

        // 4 players share the 120-fund starting pool: 120 / 4 = 30 each. Drop p2 down to 10 so
        // it can't cover a bid above 10.
        state.getPlayerState(p2).liquidFunds = 10

        placeBid(state, handler, p1, 15)

        // p2 can't afford the 16 needed to outbid 15, so it should be auto-passed and skipped
        // straight through to p3.
        expect(state.initialAuctionCurrentBidderId).toBe(p3)
        const auction = state.activeInitialAuction
        expect(auction?.participants.find((participant) => participant.playerId === p2)?.passed).toBe(
            true
        )
    })

    it("stops the winning President's bidder-turn to draft a second Corporate Power first", () => {
        const state = createTestState(4)
        const handler = new InitialAuctionStateHandler()
        const bidOrder = [...state.turnManager.turnOrder].reverse()
        const [p1, p2, p3, p4] = bidOrder
        if (!p1 || !p2 || !p3 || !p4) {
            throw new Error('Expected 4 players in bid order')
        }
        const corporationId = state.activeInitialAuctionCorporationId
        expect(corporationId).toBeDefined()
        if (!corporationId) return
        const availableBefore = [...state.availableCorporatePowerIds]

        // Manually drive the auction to resolution without the draftFirstAvailablePower helper,
        // so DraftPower's own intermediate state is observable.
        const context = createMachineContext(state)
        const bid = new HydratedPlaceBid({
            id: 'bid-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: p1,
            amount: 5
        } as PlaceBid)
        bid.apply(state, context)
        state.machineState = handler.onAction(bid, context) as MachineState
        for (const playerId of [p2, p3, p4]) {
            const pass = new HydratedPassAuction({
                id: `pass-${playerId}`,
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.PassAuction,
                playerId
            } as PassAuction)
            pass.apply(state, context)
            state.machineState = handler.onAction(pass, context) as MachineState
        }

        expect(state.machineState).toBe(MachineState.DraftPower)
        expect(state.draftPowerCorporationId).toBe(corporationId)
        expect(state.draftPowerResumeState).toBe(MachineState.InitialAuction)

        const draftHandler = new DraftPowerStateHandler()
        draftHandler.enter(context)
        expect(state.activePlayerIds).toEqual([p1])
        expect(draftHandler.validActionsForPlayer(p1, context)).toEqual([ActionType.DraftPower])
        expect(draftHandler.validActionsForPlayer(p2, context)).toEqual([])

        const chosenPowerId = availableBefore[0]!
        const draft = new HydratedDraftPower({
            id: 'draft-p1',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.DraftPower,
            playerId: p1,
            powerId: chosenPowerId
        } as DraftPower)
        draft.apply(state, context)
        state.machineState = draftHandler.onAction(draft, context) as MachineState

        expect(state.getCorporation(corporationId).hasActivePower(chosenPowerId)).toBe(true)
        expect(state.availableCorporatePowerIds).not.toContain(chosenPowerId)
        expect(state.availableCorporatePowerIds).toHaveLength(availableBefore.length - 1)
        expect(state.draftPowerCorporationId).toBeUndefined()
        expect(state.draftPowerResumeState).toBeUndefined()
        expect(state.machineState).toBe(MachineState.InitialAuction)
    })

    it('requires the opening bidder to bid (even $0) before anyone may pass', () => {
        const state = createTestState(4)
        const handler = new InitialAuctionStateHandler()
        const bidOrder = [...state.turnManager.turnOrder].reverse()
        const [p1] = bidOrder
        if (!p1) {
            throw new Error('Expected an opening bidder')
        }
        expect(HydratedPassAuction.canPassAuction(state, p1)).toBe(false)
        expect(() => passBid(state, handler, p1)).toThrow()
    })

    it('forces a winner via a $0 opening bid when everyone else passes', () => {
        const state = createTestState(4)
        const handler = new InitialAuctionStateHandler()
        const bidOrder = [...state.turnManager.turnOrder].reverse()
        const [p1, p2, p3, p4] = bidOrder
        if (!p1 || !p2 || !p3 || !p4) {
            throw new Error('Expected 4 players in bid order')
        }
        const corporationId = state.activeInitialAuctionCorporationId
        expect(corporationId).toBeDefined()
        if (!corporationId) return

        // p1 (the opening bidder) must open with a bid - $0 is allowed - and everyone else
        // then passes without ever bidding.
        placeBid(state, handler, p1, 0)
        passBid(state, handler, p2)
        passBid(state, handler, p3)
        passBid(state, handler, p4)

        const corporation = state.getCorporation(corporationId)
        expect(corporation.getPresidentPlayerId()).toBe(p1)
        expect(corporation.treasury).toBe(0)
        expect(state.getPlayerState(p1).liquidFunds).toBe(30)
        expect(state.getPlayerState(p4).liquidFunds).toBe(30)

        expect(state.activeInitialAuctionCorporationId).not.toBe(corporationId)
        expect(state.activeInitialAuction).toBeDefined()
        expect(state.machineState).toBe(MachineState.InitialAuction)
    })

    it('transitions to IssueShare once every corporation has been auctioned', () => {
        const state = createTestState(2)
        const handler = new InitialAuctionStateHandler()
        const [p1, p2] = state.turnManager.turnOrder
        if (!p1 || !p2) {
            throw new Error('Expected 2 players')
        }

        const seenCorporationIds = new Set<CorporationId>()
        // 5 corporations total; run each auction with one bid then one pass.
        for (let i = 0; i < 5; i++) {
            expect(state.machineState).toBe(MachineState.InitialAuction)
            const corporationId = state.activeInitialAuctionCorporationId
            expect(corporationId).toBeDefined()
            if (!corporationId) return
            seenCorporationIds.add(corporationId)

            const bidder = state.initialAuctionCurrentBidderId
            const other = bidder === p1 ? p2 : p1
            placeBid(state, handler, bidder!, 1)
            passBid(state, handler, other)
        }

        expect(seenCorporationIds.size).toBe(5)
        expect(state.initialAuctionQueue.length).toBe(0)
        expect(state.activeInitialAuction).toBeUndefined()
        expect(state.machineState).toBe(MachineState.IssueShare)

        // Every one of the 5 starting Corporations drafted a power (1 per auction), and the
        // hidden draw pile was revealed into the visible row once the 5th (final) draft resolved
        // (rulebook page 11: "Reveal remaining Corporate Powers from the pile").
        for (const corporationId of seenCorporationIds) {
            expect(state.getCorporation(corporationId).powers).toHaveLength(2)
        }
        expect(state.corporatePowerDrawPileIds).toHaveLength(0)
        expect(state.availableCorporatePowerIds).toHaveLength(6 - 5 + 5) // 6 - 5 drafted + 5 revealed
    })
})
