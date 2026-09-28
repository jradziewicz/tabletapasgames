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
import { BoardroomBattleStateHandler } from './boardroomBattle.js'
import { HydratedPlaceBoardroomVote, PlaceBoardroomVote } from '../actions/placeBoardroomVote.js'
import {
    HydratedDeclineBoardroomVote,
    DeclineBoardroomVote
} from '../actions/declineBoardroomVote.js'
import {
    HydratedChooseBoardroomBattleCorporation,
    ChooseBoardroomBattleCorporation
} from '../actions/chooseBoardroomBattleCorporation.js'
import { HydratedPlaceShareBid, PlaceShareBid } from '../actions/placeShareBid.js'
import { HydratedPassShareBid, PassShareBid } from '../actions/passShareBid.js'
import { HydratedFinePrint, FinePrint } from '../actions/finePrint.js'
import { HydratedDeclineFinePrint, DeclineFinePrint } from '../actions/declineFinePrint.js'
import { ActionType } from '../definition/actions.js'
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
    initialState.machineState = MachineState.BoardroomBattle
    // Every Corporation already has a President from Setup's Initial Auction in a real game;
    // give each one here too so Share auctions in these tests have somewhere to add a winner.
    initialState.corporations.forEach((corporation, index) => {
        const presidentId = initialState.players[index % initialState.players.length]?.playerId
        if (presidentId) {
            corporation.issueShareToPlayer(presidentId, index)
        }
        corporation.treasury = 50
    })

    return initialState
}

function createMachineContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function placeBoardroomVote(
    state: HydratedStellarVenturesGameState,
    handler: BoardroomBattleStateHandler,
    playerId: string,
    corporationId: CorporationId,
    amount: number
) {
    const context = createMachineContext(state)
    const action = new HydratedPlaceBoardroomVote({
        id: `place-vote-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PlaceBoardroomVote,
        playerId,
        corporationId,
        amount
    } as PlaceBoardroomVote)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.BoardroomBattle) {
        handler.enter(context)
    }
}

function declineBoardroomVote(
    state: HydratedStellarVenturesGameState,
    handler: BoardroomBattleStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedDeclineBoardroomVote({
        id: `decline-vote-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DeclineBoardroomVote,
        playerId
    } as DeclineBoardroomVote)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.BoardroomBattle) {
        handler.enter(context)
    }
}

function chooseBoardroomBattleCorporation(
    state: HydratedStellarVenturesGameState,
    handler: BoardroomBattleStateHandler,
    playerId: string,
    corporationId: CorporationId
) {
    const context = createMachineContext(state)
    const action = new HydratedChooseBoardroomBattleCorporation({
        id: `choose-corp-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.ChooseBoardroomBattleCorporation,
        playerId,
        corporationId
    } as ChooseBoardroomBattleCorporation)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.BoardroomBattle) {
        handler.enter(context)
    }
}

function placeShareBid(
    state: HydratedStellarVenturesGameState,
    handler: BoardroomBattleStateHandler,
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
    if (state.machineState === MachineState.BoardroomBattle) {
        handler.enter(context)
    }
}

function passShareBid(
    state: HydratedStellarVenturesGameState,
    handler: BoardroomBattleStateHandler,
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
    if (state.machineState === MachineState.BoardroomBattle) {
        handler.enter(context)
    }
}

function finePrint(
    state: HydratedStellarVenturesGameState,
    handler: BoardroomBattleStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedFinePrint({
        id: `fine-print-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.FinePrint,
        playerId
    } as FinePrint)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.BoardroomBattle) {
        handler.enter(context)
    }
}

function declineFinePrint(
    state: HydratedStellarVenturesGameState,
    handler: BoardroomBattleStateHandler,
    playerId: string
) {
    const context = createMachineContext(state)
    const action = new HydratedDeclineFinePrint({
        id: `decline-fine-print-${playerId}-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.DeclineFinePrint,
        playerId
    } as DeclineFinePrint)
    action.apply(state, context)
    const nextState = handler.onAction(action, context)
    state.machineState = nextState as MachineState
    if (state.machineState === MachineState.BoardroomBattle) {
        handler.enter(context)
    }
}

describe('BoardroomBattleStateHandler', () => {
    it('starts voting with the Director as the only active player', () => {
        const state = createTestState()
        const handler = new BoardroomBattleStateHandler()
        handler.enter(createMachineContext(state))

        expect(state.activePlayerIds).toEqual([state.directorPlayerId])
        expect(state.boardroomBattleVoteOrder?.[0]).toBe(state.directorPlayerId)
        expect(state.boardroomBattleCurrentVoterId).toBe(state.directorPlayerId)
    })

    it('only allows the current voter to place or decline a Vote', () => {
        const state = createTestState()
        const handler = new BoardroomBattleStateHandler()
        handler.enter(createMachineContext(state))

        const [voter, other] = state.boardroomBattleVoteOrder!
        expect(voter).toBeDefined()
        expect(other).toBeDefined()
        const context = createMachineContext(state)

        expect(HydratedPlaceBoardroomVote.canOfferPlaceBoardroomVote(state, other!)).toBe(false)
        expect(HydratedDeclineBoardroomVote.canDeclineBoardroomVote(state, other!)).toBe(false)
        expect(handler.validActionsForPlayer(other!, context)).toEqual([])
        expect(handler.validActionsForPlayer(voter!, context)).toEqual([
            ActionType.PlaceBoardroomVote,
            ActionType.DeclineBoardroomVote
        ])
    })

    it('runs the whole vote once each and, with a clear winner, opens the forced auction at the Director', () => {
        const state = createTestState()
        const handler = new BoardroomBattleStateHandler()
        handler.enter(createMachineContext(state))

        const voteOrder = state.boardroomBattleVoteOrder!
        const [v1, v2, v3, v4] = voteOrder
        expect(v1).toBe(state.directorPlayerId)

        placeBoardroomVote(state, handler, v1!, CorporationId.PinkInc, 3)
        declineBoardroomVote(state, handler, v2!)
        placeBoardroomVote(state, handler, v3!, CorporationId.FrostFederated, 1)
        declineBoardroomVote(state, handler, v4!)

        // PinkInc had the clear majority (3 vs 1) - no tie-break needed.
        expect(state.boardroomBattleTiedCorporationIds).toBeUndefined()
        expect(state.boardroomBattleCorporationId).toBe(CorporationId.PinkInc)
        expect(state.activeShareAuction).toBeDefined()
        expect(state.shareAuctionBidOrder?.[0]).toBe(state.directorPlayerId)
        expect(state.shareAuctionCurrentBidderId).toBe(state.directorPlayerId)
        expect(state.activePlayerIds).toEqual([state.directorPlayerId])

        // v1's 3 Votes (on the winner) are gone for good; v3's 1 Vote (on a loser) came back.
        expect(state.getPlayerState(v1!).boardroomVotes).toBe(6 - 3)
        expect(state.getPlayerState(v3!).boardroomVotes).toBe(6)
    })

    it('restricts the tie-break choice to the Director and to the tied Corporations', () => {
        const state = createTestState()
        const handler = new BoardroomBattleStateHandler()
        handler.enter(createMachineContext(state))

        const voteOrder = state.boardroomBattleVoteOrder!
        const [v1, v2, v3, v4] = voteOrder

        placeBoardroomVote(state, handler, v1!, CorporationId.PinkInc, 2)
        placeBoardroomVote(state, handler, v2!, CorporationId.FrostFederated, 2)
        declineBoardroomVote(state, handler, v3!)
        declineBoardroomVote(state, handler, v4!)

        expect(state.boardroomBattleTiedCorporationIds).toEqual(
            expect.arrayContaining([CorporationId.PinkInc, CorporationId.FrostFederated])
        )
        expect(state.activePlayerIds).toEqual([state.directorPlayerId])

        const nonDirector = state.players.map((p) => p.playerId).find((id) => id !== state.directorPlayerId)!
        expect(
            HydratedChooseBoardroomBattleCorporation.canChooseBoardroomBattleCorporation(
                state,
                nonDirector,
                CorporationId.PinkInc
            )
        ).toBe(false)
        expect(
            HydratedChooseBoardroomBattleCorporation.canChooseBoardroomBattleCorporation(
                state,
                state.directorPlayerId,
                CorporationId.ScarletSyndicate
            )
        ).toBe(false)
        expect(
            HydratedChooseBoardroomBattleCorporation.canChooseBoardroomBattleCorporation(
                state,
                state.directorPlayerId,
                CorporationId.PinkInc
            )
        ).toBe(true)

        chooseBoardroomBattleCorporation(state, handler, state.directorPlayerId, CorporationId.PinkInc)

        expect(state.boardroomBattleTiedCorporationIds).toBeUndefined()
        expect(state.boardroomBattleCorporationId).toBe(CorporationId.PinkInc)
        expect(state.activeShareAuction).toBeDefined()
        // The Director's choice both starts the auction AND resolves the Votes: FrostFederated's
        // Votes (the loser, even though it was tied) are returned.
        expect(state.getPlayerState(v2!).boardroomVotes).toBe(6)
        expect(state.getPlayerState(v1!).boardroomVotes).toBe(6 - 2)
    })

    it('runs the forced auction to completion and moves on to Investor Shenanigans', () => {
        const state = createTestState()
        const handler = new BoardroomBattleStateHandler()
        handler.enter(createMachineContext(state))

        const voteOrder = state.boardroomBattleVoteOrder!
        const [v1, v2, v3, v4] = voteOrder
        placeBoardroomVote(state, handler, v1!, CorporationId.PinkInc, 1)
        declineBoardroomVote(state, handler, v2!)
        declineBoardroomVote(state, handler, v3!)
        declineBoardroomVote(state, handler, v4!)

        const corporation = state.getCorporation(CorporationId.PinkInc)
        const sharesBefore = corporation.issuedShareCount
        const treasuryBefore = corporation.treasury

        const bidOrder = state.shareAuctionBidOrder!
        const [b1, b2, b3, b4] = bidOrder
        expect(b1).toBe(state.directorPlayerId)

        const b3FundsBefore = state.getPlayerState(b3!).liquidFunds

        placeShareBid(state, handler, b1!, 0)
        passShareBid(state, handler, b2!)
        placeShareBid(state, handler, b3!, 8)
        passShareBid(state, handler, b4!)
        passShareBid(state, handler, b1!)

        expect(state.machineState).toBe(MachineState.InvestorAction)
        expect(state.activeShareAuction).toBeUndefined()
        expect(state.boardroomBattleCorporationId).toBeUndefined()
        expect(corporation.issuedShareCount).toBe(sharesBefore + 1)
        expect(corporation.treasury).toBe(treasuryBefore + 8)
        expect(state.getPlayerState(b3!).liquidFunds).toBe(b3FundsBefore - 8)
    })

    it('rejects a Vote on a Corporation with no Shares left to issue', () => {
        const state = createTestState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        // Issue every remaining Share so PinkInc has none left to force.
        while (corporation.availableShareCount > 0) {
            corporation.issueShareToPlayer('p1', state.actionCount)
        }
        expect(corporation.availableShareCount).toBe(0)

        const handler = new BoardroomBattleStateHandler()
        handler.enter(createMachineContext(state))

        const director = state.boardroomBattleCurrentVoterId!
        expect(
            HydratedPlaceBoardroomVote.canPlaceBoardroomVote(state, director, CorporationId.PinkInc, 1)
        ).toBe(false)
        expect(() => placeBoardroomVote(state, handler, director, CorporationId.PinkInc, 1)).toThrow()
    })

    it('skips Boardroom Battle entirely when no Corporation has any Shares left to issue', () => {
        const state = createTestState()
        // Drain every Corporation's Shares so none is a valid target.
        for (const corporation of state.corporations) {
            while (corporation.availableShareCount > 0) {
                corporation.issueShareToPlayer('p1', state.actionCount)
            }
        }

        const handler = new BoardroomBattleStateHandler()
        handler.enter(createMachineContext(state))

        // With no eligible target at all, PlaceBoardroomVote isn't even offered.
        expect(
            HydratedPlaceBoardroomVote.canOfferPlaceBoardroomVote(
                state,
                state.boardroomBattleCurrentVoterId!
            )
        ).toBe(false)

        const voteOrder = state.boardroomBattleVoteOrder!
        const [v1, v2, v3, v4] = voteOrder
        // With no eligible target, nothing to do but decline all the way through.
        declineBoardroomVote(state, handler, v1!)
        declineBoardroomVote(state, handler, v2!)
        declineBoardroomVote(state, handler, v3!)
        declineBoardroomVote(state, handler, v4!)

        expect(state.machineState).toBe(MachineState.InvestorAction)
        expect(state.boardroomBattleTiedCorporationIds).toBeUndefined()
        expect(state.boardroomBattleCorporationId).toBeUndefined()
        expect(state.activeShareAuction).toBeUndefined()
        expect(state.activePlayerIds).toEqual([])
    })

    describe('Fine Print', () => {
        it("offers Fine Print to its holder's President before voting is set up", () => {
            const state = createTestState()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.FinePrint })
            const president = pinkInc.getPresidentPlayerId()!
            const handler = new BoardroomBattleStateHandler()
            const context = createMachineContext(state)

            handler.enter(context)

            expect(state.activePlayerIds).toEqual([president])
            expect(state.boardroomBattleVoteOrder).toBeUndefined()
            expect(handler.validActionsForPlayer(president, context)).toEqual(
                expect.arrayContaining([ActionType.FinePrint, ActionType.DeclineFinePrint])
            )
        })

        it('excludes the exempted Corporation from Votes, tie-break, and the forced auction once used, then discards the power', () => {
            const state = createTestState()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.FinePrint })
            const president = pinkInc.getPresidentPlayerId()!
            const handler = new BoardroomBattleStateHandler()

            handler.enter(createMachineContext(state))
            finePrint(state, handler, president)

            expect(state.finePrintExemptCorporationId).toBe(CorporationId.PinkInc)
            expect(pinkInc.powers).not.toContainEqual({ id: CorporatePowerId.FinePrint })
            // Voting is now set up, having skipped straight past the Fine Print gate.
            expect(state.boardroomBattleVoteOrder).toBeDefined()
            expect(state.activePlayerIds).toEqual([state.directorPlayerId])

            const director = state.directorPlayerId
            expect(
                HydratedPlaceBoardroomVote.canPlaceBoardroomVote(state, director, CorporationId.PinkInc, 1)
            ).toBe(false)

            const voteOrder = state.boardroomBattleVoteOrder!
            const [v1, v2, v3, v4] = voteOrder
            placeBoardroomVote(state, handler, v1!, CorporationId.FrostFederated, 1)
            declineBoardroomVote(state, handler, v2!)
            declineBoardroomVote(state, handler, v3!)
            declineBoardroomVote(state, handler, v4!)

            // FrostFederated won outright (PinkInc was never a candidate at all) - no tie-break,
            // straight to the forced auction for FrostFederated.
            expect(state.boardroomBattleCorporationId).toBe(CorporationId.FrostFederated)

            const bidOrder = state.shareAuctionBidOrder!
            const [b1, b2, b3, b4] = bidOrder
            placeShareBid(state, handler, b1!, 0)
            passShareBid(state, handler, b2!)
            placeShareBid(state, handler, b3!, 8)
            passShareBid(state, handler, b4!)
            passShareBid(state, handler, b1!)

            expect(state.machineState).toBe(MachineState.InvestorAction)
            // Fine Print's per-Battle bookkeeping is cleared once the Battle fully resolves.
            expect(state.finePrintExemptCorporationId).toBeUndefined()
            expect(state.finePrintOfferResolved).toBeUndefined()
        })

        it('resolves via decline without exempting any Corporation, keeping the power for a later Battle', () => {
            const state = createTestState()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.FinePrint })
            const president = pinkInc.getPresidentPlayerId()!
            const handler = new BoardroomBattleStateHandler()

            handler.enter(createMachineContext(state))
            declineFinePrint(state, handler, president)

            expect(state.finePrintExemptCorporationId).toBeUndefined()
            expect(state.finePrintOfferResolved).toBe(true)
            expect(pinkInc.powers).toContainEqual({ id: CorporatePowerId.FinePrint })
            expect(state.boardroomBattleVoteOrder).toBeDefined()
            expect(
                HydratedPlaceBoardroomVote.canPlaceBoardroomVote(
                    state,
                    state.directorPlayerId,
                    CorporationId.PinkInc,
                    1
                )
            ).toBe(true)
        })

        it('is never offered a 2nd time within the same Battle once resolved', () => {
            const state = createTestState()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.FinePrint })
            const president = pinkInc.getPresidentPlayerId()!
            const handler = new BoardroomBattleStateHandler()

            handler.enter(createMachineContext(state))
            declineFinePrint(state, handler, president)

            expect(HydratedFinePrint.canFinePrint(state, president)).toBe(false)
            expect(HydratedDeclineFinePrint.canDeclineFinePrint(state, president)).toBe(false)
        })

        it('rejects Fine Print from a non-President player', () => {
            const state = createTestState()
            const pinkInc = state.getCorporation(CorporationId.PinkInc)
            pinkInc.powers.push({ id: CorporatePowerId.FinePrint })
            const president = pinkInc.getPresidentPlayerId()!
            const nonPresident = state.players.find((player) => player.playerId !== president)!.playerId

            expect(HydratedFinePrint.canFinePrint(state, nonPresident)).toBe(false)
        })
    })
})
