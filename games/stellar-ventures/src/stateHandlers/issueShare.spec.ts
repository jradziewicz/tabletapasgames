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
import { DraftPowerStateHandler } from './draftPower.js'
import { IssueShareStateHandler } from './issueShare.js'
import { HydratedPlaceBid, PlaceBid } from '../actions/placeBid.js'
import { HydratedPassAuction, PassAuction } from '../actions/passAuction.js'
import { HydratedDraftPower, DraftPower } from '../actions/draftPower.js'
import { HydratedIssueShare, IssueShare } from '../actions/issueShare.js'
import { HydratedDeclineIssueShare, DeclineIssueShare } from '../actions/declineIssueShare.js'
import { HydratedPlaceShareBid, PlaceShareBid } from '../actions/placeShareBid.js'
import { HydratedPassShareBid, PassShareBid } from '../actions/passShareBid.js'
import { HydratedLeakedResearch, LeakedResearch } from '../actions/leakedResearch.js'
import { ActionType } from '../definition/actions.js'
import { CorporatePowerId, type CorporationId } from '../model/corporation.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

// Drives the game all the way through Setup's Initial Auction (every corporation gets a
// President, one bid then one pass each) so tests here start with a real, already-presidented
// Corporation sitting at Issue Share - the same place a real game reaches this step from.
function createTestStateAtIssueShare(playerCount = 4) {
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

    const initialAuctionHandler = new InitialAuctionStateHandler()
    initialAuctionHandler.enter(createMachineContext(initialState))

    // Each auction's winning President also drafts a second Corporate Power (rulebook page 11's
    // step 4) before the next auction (or Issue Share) begins - see stateHandlers/draftPower.ts.
    // Tests here just need to get past it, so draft whatever's first in the available row.
    function draftFirstAvailablePowerIfPending() {
        if (initialState.machineState !== MachineState.DraftPower) {
            return
        }
        const corporationId = initialState.draftPowerCorporationId
        const powerId = initialState.availableCorporatePowerIds[0]
        if (!corporationId || !powerId) {
            throw new Error('Expected a pending Corporation and available Power to draft')
        }
        const presidentPlayerId = initialState.getCorporation(corporationId).getPresidentPlayerId()
        if (!presidentPlayerId) {
            throw new Error('Expected a President to draft a Corporate Power')
        }
        const draftContext = createMachineContext(initialState)
        const draftAction = new HydratedDraftPower({
            id: `draft-${corporationId}-${initialState.actionCount}`,
            gameId: initialState.gameId,
            source: ActionSource.User,
            type: ActionType.DraftPower,
            playerId: presidentPlayerId,
            powerId
        } as DraftPower)
        draftAction.apply(initialState, draftContext)
        initialState.machineState = new DraftPowerStateHandler().onAction(
            draftAction,
            draftContext
        ) as MachineState
        if (initialState.machineState === MachineState.InitialAuction) {
            // Actually starts the next Corporation's auction (activeInitialAuction,
            // initialAuctionBidOrder, etc.) - nothing else does this once the draft resolves.
            initialAuctionHandler.enter(draftContext)
        }
    }

    // Run all 5 corporation auctions: the first bidder in each corp's bid order wins it (bids
    // once, everyone else passes in turn), so each corp ends up with a real President.
    while (
        initialState.machineState === MachineState.InitialAuction ||
        initialState.machineState === MachineState.DraftPower
    ) {
        draftFirstAvailablePowerIfPending()
        if (initialState.machineState !== MachineState.InitialAuction) {
            continue
        }
        const bidOrder = initialState.initialAuctionBidOrder
        const firstBidder = bidOrder?.[0]
        if (!bidOrder || !firstBidder) {
            throw new Error('Expected an active bid order')
        }

        const bidContext = createMachineContext(initialState)
        const bidAction = new HydratedPlaceBid({
            id: `bid-${firstBidder}-${initialState.actionCount}`,
            gameId: initialState.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: firstBidder,
            amount: 1
        } as PlaceBid)
        bidAction.apply(initialState, bidContext)
        initialState.machineState = initialAuctionHandler.onAction(
            bidAction,
            bidContext
        ) as MachineState
        if (initialState.machineState === MachineState.InitialAuction) {
            initialAuctionHandler.enter(bidContext)
        }

        for (let i = 1; i < bidOrder.length && initialState.machineState === MachineState.InitialAuction; i++) {
            const passer = bidOrder[i]
            if (!passer) continue
            const passContext = createMachineContext(initialState)
            const passAction = new HydratedPassAuction({
                id: `pass-${passer}-${initialState.actionCount}`,
                gameId: initialState.gameId,
                source: ActionSource.User,
                type: ActionType.PassAuction,
                playerId: passer
            } as PassAuction)
            passAction.apply(initialState, passContext)
            initialState.machineState = initialAuctionHandler.onAction(
                passAction,
                passContext
            ) as MachineState
            if (initialState.machineState === MachineState.InitialAuction) {
                initialAuctionHandler.enter(passContext)
            }
        }
    }

    // Now sitting at IssueShare for the first corporation - run the IssueShare handler's enter()
    // so activePlayerIds reflects that corporation's President, as the real game engine would.
    new IssueShareStateHandler().enter(createMachineContext(initialState))

    return initialState
}

// Only IssueShare itself has a registered handler right now (ExpandNetworkOrWormhole doesn't
// yet), so - mirroring the real engine, which only calls the NEXT state's handler.enter() -
// these helpers call enter() again only when the action kept us in IssueShare (e.g. bidding
// continues). Once we transition away, nothing should touch activePlayerIds further.
function issueShare(
    state: HydratedStellarVenturesGameState,
    handler: IssueShareStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedIssueShare({
        id: `issue-share-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.IssueShare,
        playerId
    } as IssueShare)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.IssueShare) {
        handler.enter(context)
    }
}

function declineIssueShare(
    state: HydratedStellarVenturesGameState,
    handler: IssueShareStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedDeclineIssueShare({
        id: `decline-issue-share-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DeclineIssueShare,
        playerId
    } as DeclineIssueShare)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
}

function placeShareBid(
    state: HydratedStellarVenturesGameState,
    handler: IssueShareStateHandler,
    playerId: string,
    amount: number
) {
    const context = createMachineContext(state)
    const action = new HydratedPlaceShareBid({
        id: `share-bid-${playerId}-${amount}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PlaceShareBid,
        playerId,
        amount
    } as PlaceShareBid)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.IssueShare) {
        handler.enter(context)
    }
}

function passShareBid(
    state: HydratedStellarVenturesGameState,
    handler: IssueShareStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedPassShareBid({
        id: `pass-share-bid-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PassShareBid,
        playerId
    } as PassShareBid)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.IssueShare) {
        handler.enter(context)
    }
}

function leakedResearch(
    state: HydratedStellarVenturesGameState,
    handler: IssueShareStateHandler,
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
    if (state.machineState === MachineState.IssueShare) {
        handler.enter(context)
    }
}

describe('IssueShareStateHandler', () => {
    it('makes only the Corporation President able to act when no auction is active', () => {
        const state = createTestStateAtIssueShare(4)
        expect(state.machineState).toBe(MachineState.IssueShare)

        const corporationId = state.activeCorporationId
        expect(corporationId).toBeDefined()
        if (!corporationId) return
        const president = state.getCorporation(corporationId).getPresidentPlayerId()
        expect(president).toBeDefined()
        expect(state.activePlayerIds).toEqual([president])
    })

    it('lets the President decline, moving straight to Expand Network / Wormhole', () => {
        const state = createTestStateAtIssueShare(4)
        const handler = new IssueShareStateHandler()
        const corporationId = state.activeCorporationId
        if (!corporationId) throw new Error('Expected an active corporation')
        const president = state.getCorporation(corporationId).getPresidentPlayerId()
        if (!president) throw new Error('Expected a president')

        const sharesBefore = state.getCorporation(corporationId).issuedShareCount
        declineIssueShare(state, handler, president)

        expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
        expect(state.activePlayerIds).toEqual([])
        expect(state.getCorporation(corporationId).issuedShareCount).toBe(sharesBefore)
    })

    it('auto-declines and skips straight to Expand Network / Wormhole when no Shares are left to issue', () => {
        const state = createTestStateAtIssueShare(4)
        const handler = new IssueShareStateHandler()
        const corporationId = state.activeCorporationId
        if (!corporationId) throw new Error('Expected an active corporation')
        const corporation = state.getCorporation(corporationId)
        const president = corporation.getPresidentPlayerId()
        if (!president) throw new Error('Expected a president')

        // Issue away every remaining Share so none are left for this Corporation to offer.
        let sequence = 1000
        while (corporation.availableShareCount > 0) {
            corporation.issueShareToPlayer(president, sequence++)
        }

        const context = createMachineContext(state)
        handler.enter(context)

        // Still shows the President as the nominal active player (mirrors the normal path) so
        // the queued system action below passes the engine's isPlayerAllowed check, but a real
        // President never has to do anything here - see the queued Decline next.
        expect(state.activePlayerIds).toEqual([president])
        const pending = context.getPendingActions()
        expect(pending).toHaveLength(1)
        expect(pending[0]?.type).toBe(ActionType.DeclineIssueShare)
        expect((pending[0] as DeclineIssueShare).playerId).toBe(president)

        // Simulate the real game engine draining that queued system action.
        const queuedAction = new HydratedDeclineIssueShare(pending[0] as DeclineIssueShare)
        queuedAction.apply(state, context)
        state.machineState = handler.onAction(queuedAction, context) as MachineState

        expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
        expect(state.activePlayerIds).toEqual([])
    })

    it('runs a share auction to completion, charging the highest bidder', () => {
        const state = createTestStateAtIssueShare(4)
        const handler = new IssueShareStateHandler()
        const corporationId = state.activeCorporationId
        if (!corporationId) throw new Error('Expected an active corporation')
        const president = state.getCorporation(corporationId).getPresidentPlayerId()
        if (!president) throw new Error('Expected a president')

        issueShare(state, handler, president)
        expect(state.activeShareAuction).toBeDefined()
        // Bidding starts with (and proceeds clockwise from) the President.
        expect(state.shareAuctionBidOrder?.[0]).toBe(president)
        expect(state.shareAuctionCurrentBidderId).toBe(president)

        const bidOrder = state.shareAuctionBidOrder!
        const [b1, b2, b3, b4] = bidOrder
        if (!b1 || !b2 || !b3 || !b4) throw new Error('Expected 4 players in bid order')

        const b3FundsBefore = state.getPlayerState(b3).liquidFunds
        const treasuryBefore = state.getCorporation(corporationId).treasury
        const sharesBefore = state.getCorporation(corporationId).issuedShareCount

        placeShareBid(state, handler, b1, 5)
        passShareBid(state, handler, b2)
        placeShareBid(state, handler, b3, 10)
        passShareBid(state, handler, b4)
        passShareBid(state, handler, b1)

        expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
        expect(state.activeShareAuction).toBeUndefined()
        expect(state.activePlayerIds).toEqual([])

        const corporation = state.getCorporation(corporationId)
        expect(corporation.issuedShareCount).toBe(sharesBefore + 1)
        expect(corporation.treasury).toBe(treasuryBefore + 10)
        expect(state.getPlayerState(b3).liquidFunds).toBe(b3FundsBefore - 10)
        expect(corporation.shareCountForPlayer(b3)).toBeGreaterThan(0)
    })

    it('requires the President to open the auction with a bid (even $0) before passing', () => {
        const state = createTestStateAtIssueShare(4)
        const handler = new IssueShareStateHandler()
        const corporationId = state.activeCorporationId
        if (!corporationId) throw new Error('Expected an active corporation')
        const president = state.getCorporation(corporationId).getPresidentPlayerId()
        if (!president) throw new Error('Expected a president')

        issueShare(state, handler, president)
        expect(HydratedPassShareBid.canPassShareBid(state, president)).toBe(false)
        expect(() => passShareBid(state, handler, president)).toThrow()
    })

    it('forces a winner via a $0 opening bid when everyone else passes', () => {
        const state = createTestStateAtIssueShare(4)
        const handler = new IssueShareStateHandler()
        const corporationId = state.activeCorporationId
        if (!corporationId) throw new Error('Expected an active corporation')
        const president = state.getCorporation(corporationId).getPresidentPlayerId()
        if (!president) throw new Error('Expected a president')

        issueShare(state, handler, president)
        const bidOrder = state.shareAuctionBidOrder!
        const [b1, b2, b3, b4] = bidOrder
        if (!b1 || !b2 || !b3 || !b4) throw new Error('Expected 4 players in bid order')
        expect(b1).toBe(president)

        const treasuryBefore = state.getCorporation(corporationId).treasury
        const sharesBefore = state.getCorporation(corporationId).issuedShareCount
        const presidentFundsBefore = state.getPlayerState(president).liquidFunds

        // The President must open with a bid - $0 is allowed - then everyone else passes
        // without ever bidding themselves.
        placeShareBid(state, handler, president, 0)
        passShareBid(state, handler, b2)
        passShareBid(state, handler, b3)
        passShareBid(state, handler, b4)

        expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
        const corporation = state.getCorporation(corporationId)
        expect(corporation.issuedShareCount).toBe(sharesBefore + 1)
        expect(corporation.treasury).toBe(treasuryBefore)
        expect(state.getPlayerState(president).liquidFunds).toBe(presidentFundsBefore)
        // The President (still the same one - they just picked up a second share) gets it free.
        expect(corporation.getPresidentPlayerId()).toBe(president)
    })

    it('resolves cleanly when the President opens at exactly their own full Liquid Funds', () => {
        // Regression test: the President opening the bid at an amount that maxes out their own
        // Liquid Funds used to make nextAuctionBidderId's "can they afford the next minimum bid"
        // auto-skip incorrectly wrap around and auto-pass the President themselves (mistaking
        // "can't afford to out-bid their own leading bid" for "can't afford to keep bidding"),
        // leaving zero non-passed participants and throwing when the auction tried to resolve.
        const state = createTestStateAtIssueShare(4)
        const handler = new IssueShareStateHandler()
        const corporationId = state.activeCorporationId
        if (!corporationId) throw new Error('Expected an active corporation')
        const president = state.getCorporation(corporationId).getPresidentPlayerId()
        if (!president) throw new Error('Expected a president')

        issueShare(state, handler, president)
        const bidOrder = state.shareAuctionBidOrder!
        const [b1, b2, b3, b4] = bidOrder
        if (!b1 || !b2 || !b3 || !b4) throw new Error('Expected 4 players in bid order')
        expect(b1).toBe(president)

        state.getPlayerState(president).liquidFunds = 8
        const treasuryBefore = state.getCorporation(corporationId).treasury
        const sharesBefore = state.getCorporation(corporationId).issuedShareCount

        placeShareBid(state, handler, president, 8)
        expect(() => passShareBid(state, handler, b2)).not.toThrow()
        expect(() => passShareBid(state, handler, b3)).not.toThrow()
        expect(() => passShareBid(state, handler, b4)).not.toThrow()

        expect(state.machineState).toBe(MachineState.ExpandNetworkOrWormhole)
        const corporation = state.getCorporation(corporationId)
        expect(corporation.issuedShareCount).toBe(sharesBefore + 1)
        expect(corporation.treasury).toBe(treasuryBefore + 8)
        expect(state.getPlayerState(president).liquidFunds).toBe(0)
        expect(corporation.getPresidentPlayerId()).toBe(president)
    })

    it('does not allow a non-President to issue or decline a share', () => {
        const state = createTestStateAtIssueShare(4)
        const corporationId = state.activeCorporationId
        if (!corporationId) throw new Error('Expected an active corporation')
        const corporation = state.getCorporation(corporationId)
        const president = corporation.getPresidentPlayerId()
        const other = state.players.map((p) => p.playerId).find((id) => id !== president)
        if (!other) throw new Error('Expected another player')

        expect(HydratedIssueShare.canIssueShare(state, other)).toBe(false)
        expect(HydratedDeclineIssueShare.canDeclineIssueShare(state, other)).toBe(false)
        if (president) {
            expect(HydratedIssueShare.canIssueShare(state, president)).toBe(true)
            expect(HydratedDeclineIssueShare.canDeclineIssueShare(state, president)).toBe(true)
        }
    })

    describe('Leaked Research ("Anytime" - before the auction opens)', () => {
        it("activates Wormhole Technology, loops back to Issue Share, and doesn't disturb the pending decision", () => {
            const state = createTestStateAtIssueShare(4)
            const handler = new IssueShareStateHandler()
            const corporationId = state.activeCorporationId
            if (!corporationId) throw new Error('Expected an active corporation')
            const corporation = state.getCorporation(corporationId)
            const president = corporation.getPresidentPlayerId()
            if (!president) throw new Error('Expected a president')
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            // Every player starts with 1 Alien Technology Cube already (Setup - see
            // STARTING_ALIEN_TECH_CUBES in definition/initializer.ts) - capture it so the +1/-1
            // below nets back to that starting count instead of assuming it started at 0.
            const cubesBeforeAdd = state.getPlayerState(president).alienTechCubes
            state.getPlayerState(president).addAlienTechCubes(1)
            const context = createMachineContext(state)

            expect(handler.validActionsForPlayer(president, context)).toContain(
                ActionType.LeakedResearch
            )

            leakedResearch(state, handler, president, corporationId)

            expect(corporation.wormholeActive).toBe(true)
            expect(state.getPlayerState(president).alienTechCubes).toBe(cubesBeforeAdd)
            expect(state.machineState).toBe(MachineState.IssueShare)
            expect(state.activePlayerIds).toEqual([president])
            // Still free to Issue or Decline afterward, exactly as before.
            expect(HydratedIssueShare.canIssueShare(state, president)).toBe(true)
            expect(HydratedDeclineIssueShare.canDeclineIssueShare(state, president)).toBe(true)
        })

        it('is not offered once a share auction is underway', () => {
            const state = createTestStateAtIssueShare(4)
            const handler = new IssueShareStateHandler()
            const corporationId = state.activeCorporationId
            if (!corporationId) throw new Error('Expected an active corporation')
            const corporation = state.getCorporation(corporationId)
            const president = corporation.getPresidentPlayerId()
            if (!president) throw new Error('Expected a president')
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            state.getPlayerState(president).addAlienTechCubes(1)

            issueShare(state, handler, president)

            expect(
                HydratedLeakedResearch.canLeakedResearch(state, president, corporationId)
            ).toBe(false)
            expect(HydratedLeakedResearch.canOfferLeakedResearch(state, president)).toBe(false)
        })

        it('is not offered to a non-President, even with the power active', () => {
            const state = createTestStateAtIssueShare(4)
            const corporationId = state.activeCorporationId
            if (!corporationId) throw new Error('Expected an active corporation')
            const corporation = state.getCorporation(corporationId)
            const president = corporation.getPresidentPlayerId()
            const other = state.players.map((p) => p.playerId).find((id) => id !== president)
            if (!other) throw new Error('Expected another player')
            corporation.powers.push({ id: CorporatePowerId.LeakedResearch })
            state.getPlayerState(other).addAlienTechCubes(1)

            expect(HydratedLeakedResearch.canOfferLeakedResearch(state, other)).toBe(false)
        })
    })
})
