import {
    GameCategory,
    GameResult,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import {
    CorporationId,
    CorporatePowerId,
    CorporationState,
    HydratedCorporationState
} from '../model/corporation.js'
import {
    AccountingGimmickTakeoverBonus,
    AlienShareValue,
    LoanPenaltyPerShare,
    corporateShareValuePerShare,
    determineWinners,
    hostileTakeoverApplies,
    liquidateShares,
    shareValuePerShare,
    totalCredits
} from './liquidation.js'

function createTestCorporation(overrides: Partial<CorporationState> = {}): HydratedCorporationState {
    return new HydratedCorporationState({
        id: CorporationId.FrostFederated,
        active: true,
        treasury: 0,
        shares: [],
        cargo: 0,
        orderedShipLevels: [],
        deliveredShipLevels: [],
        wormholeActive: false,
        powers: [],
        loanCount: 0,
        turnOrderPosition: 0,
        unbuiltOutposts: 0,
        ...overrides
    })
}

// The rulebook's own Share Liquidation worked example (page 21): Frost Federated, signed at 3
// Planets, Cargo 13, Mining Capacity 40, 4 Shares Issued (3 to players, 1 to the Aliens), 1 Loan.
function createFrostFederatedExample(): HydratedCorporationState {
    return createTestCorporation({
        cargo: 13,
        loanCount: 1,
        agreement: { planetCountAtSigning: 3 },
        shares: [
            { owner: { type: 'player', playerId: 'p1' }, issuedSequence: 0 },
            { owner: { type: 'player', playerId: 'p2' }, issuedSequence: 1 },
            { owner: { type: 'player', playerId: 'p3' }, issuedSequence: 2 },
            { owner: { type: 'alien' }, issuedSequence: 3 }
        ]
    })
}

function createTestGameState(playerCount = 4) {
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

    return new StellarVenturesGameInitializer().initializeGameState(game, state)
}

describe('hostileTakeoverApplies', () => {
    it('is always false for a Corporation that never signed The Agreement', () => {
        const corporation = createTestCorporation()
        expect(hostileTakeoverApplies(0, corporation, 0)).toBe(false)
        expect(hostileTakeoverApplies(100, corporation, 1000)).toBe(false)
    })

    it('is false once Mining Capacity exceeds the Alien Corporation\'s', () => {
        const corporation = createTestCorporation({ agreement: { planetCountAtSigning: 3 } })
        expect(hostileTakeoverApplies(40, corporation, 39)).toBe(false)
    })

    it('is true when Mining Capacity is less than or equal to the Alien Corporation\'s', () => {
        const corporation = createTestCorporation({ agreement: { planetCountAtSigning: 3 } })
        expect(hostileTakeoverApplies(39, corporation, 39)).toBe(true)
        expect(hostileTakeoverApplies(20, corporation, 39)).toBe(true)
    })
})

describe('corporateShareValuePerShare', () => {
    it('matches the rulebook\'s Frost Federated worked example exactly: ₮17/share', () => {
        const corporation = createFrostFederatedExample()
        // Base: ceil((40 + 13) / 4) = 14, + Agreement Bonus (3 Planets = 6), - Loan (1 = -3).
        expect(corporateShareValuePerShare(40, corporation)).toBe(17)
    })

    it('adds no Agreement Bonus for a Corporation that never signed', () => {
        const corporation = createTestCorporation({
            cargo: 2,
            shares: [{ owner: { type: 'player', playerId: 'p1' }, issuedSequence: 0 }]
        })
        expect(corporateShareValuePerShare(10, corporation)).toBe(12) // ceil(12/1), + 0, - 0
    })

    it('floors at ₮0 rather than going negative under heavy Loans', () => {
        const corporation = createTestCorporation({
            cargo: 0,
            loanCount: 10, // -30/share
            shares: [{ owner: { type: 'player', playerId: 'p1' }, issuedSequence: 0 }]
        })
        expect(corporateShareValuePerShare(1, corporation)).toBe(0)
    })

    it('returns ₮0 if somehow no Shares have been issued at all (avoids dividing by zero)', () => {
        const corporation = createTestCorporation({ shares: [] })
        expect(corporateShareValuePerShare(40, corporation)).toBe(0)
    })
})

describe('shareValuePerShare', () => {
    it('flattens to the Alien Share rate (₮1) once Hostile Takeover applies', () => {
        const corporation = createFrostFederatedExample()
        // Even though the formula alone would be worth ₮17/share, an Alien Mining Capacity of 40+
        // triggers Hostile Takeover and flattens every Share of this Corporation to ₮1.
        expect(shareValuePerShare(40, corporation, 40)).toBe(AlienShareValue)
    })

    it('uses the normal Corporate Share Value formula once Hostile Takeover is avoided', () => {
        const corporation = createFrostFederatedExample()
        expect(shareValuePerShare(40, corporation, 39)).toBe(17)
    })

    describe('Accounting Gimmick', () => {
        it('adds +5 Mining Capacity only for the Hostile Takeover check, avoiding it where the unmodified value would not', () => {
            const corporation = createFrostFederatedExample()
            corporation.powers.push({ id: CorporatePowerId.AccountingGimmick })
            // Unmodified Mining Capacity (36) would trigger Hostile Takeover against an Alien
            // Mining Capacity of 40, but 36 + 5 = 41 > 40 avoids it.
            expect(hostileTakeoverApplies(36, corporation, 40)).toBe(true)
            expect(shareValuePerShare(36, corporation, 40)).not.toBe(AlienShareValue)
        })

        it('never changes the Corporate Share Value formula itself, even when its +5 was what avoided the Takeover', () => {
            const corporation = createFrostFederatedExample()
            corporation.powers.push({ id: CorporatePowerId.AccountingGimmick })
            // hostileTakeoverApplies triggers on <=, so avoiding it against an Alien Mining
            // Capacity of 40 via the +5 bonus needs miningCapacity + 5 > 40, i.e. miningCapacity
            // > 35 - the smallest such value is 36 (36 + 5 = 41).
            const miningCapacity = 40 - AccountingGimmickTakeoverBonus + 1 // 36: avoided only by the +5
            expect(shareValuePerShare(miningCapacity, corporation, 40)).toBe(
                corporateShareValuePerShare(miningCapacity, corporation)
            )
            // Explicitly NOT computed with the +5 bonus baked in.
            expect(shareValuePerShare(miningCapacity, corporation, 40)).not.toBe(
                corporateShareValuePerShare(miningCapacity + AccountingGimmickTakeoverBonus, corporation)
            )
        })

        it('still applies Hostile Takeover once even +5 is not enough', () => {
            const corporation = createFrostFederatedExample()
            corporation.powers.push({ id: CorporatePowerId.AccountingGimmick })
            expect(shareValuePerShare(30, corporation, 40)).toBe(AlienShareValue)
        })

        it('has no effect for a Corporation without the power active', () => {
            const corporation = createFrostFederatedExample()
            expect(hostileTakeoverApplies(36, corporation, 40)).toBe(true)
            expect(shareValuePerShare(36, corporation, 40)).toBe(AlienShareValue)
        })
    })
})

describe('liquidateShares', () => {
    it("pays each player's Shares into their Liquid Funds, skipping Alien-held Shares", () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.cargo = 13
        corporation.issueShareToPlayer('p1', 0)
        corporation.issueShareToPlayer('p1', 1)
        corporation.issueShareToPlayer('p2', 2)
        corporation.issueShareToAlien(3)
        const miningCapacity = state.board.miningCapacityForCorporation(CorporationId.PinkInc)
        const expectedPerShare = corporateShareValuePerShare(miningCapacity, corporation)
        const p1Before = state.getPlayerState('p1').liquidFunds
        const p2Before = state.getPlayerState('p2').liquidFunds

        liquidateShares(state)

        expect(state.getPlayerState('p1').liquidFunds).toBe(p1Before + expectedPerShare * 2)
        expect(state.getPlayerState('p2').liquidFunds).toBe(p2Before + expectedPerShare)
    })

    it('pays only ₮1/share once a signed Corporation is Hostile-Taken-Over', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.issueShareToPlayer('p1', 0)
        corporation.agreement = { planetCountAtSigning: 2 }
        // Force Hostile Takeover regardless of this test board's actual Mining Capacity.
        state.alienCorporation.miningCapacity = 100_000
        const p1Before = state.getPlayerState('p1').liquidFunds

        liquidateShares(state)

        expect(state.getPlayerState('p1').liquidFunds).toBe(p1Before + AlienShareValue)
    })

    it("factors in Ore Refinement's +3 Mining Capacity bonus when paying out", () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.cargo = 13
        corporation.issueShareToPlayer('p1', 0)
        corporation.powers.push({ id: CorporatePowerId.OreRefinement })
        const boostedMiningCapacity = state.board.miningCapacityForCorporation(CorporationId.PinkInc) + 3
        const expectedPerShare = corporateShareValuePerShare(boostedMiningCapacity, corporation)
        const p1Before = state.getPlayerState('p1').liquidFunds

        liquidateShares(state)

        expect(state.getPlayerState('p1').liquidFunds).toBe(p1Before + expectedPerShare)
    })

    it('skips inactive Corporations entirely (e.g. an unformed Amethyst Agency)', () => {
        const state = createTestGameState()
        const amethystAgency = state.getCorporation(CorporationId.AmethystAgency)
        expect(amethystAgency.active).toBe(false)
        amethystAgency.issueShareToPlayer('p1', 0)
        const p1Before = state.getPlayerState('p1').liquidFunds

        liquidateShares(state)

        expect(state.getPlayerState('p1').liquidFunds).toBe(p1Before)
    })
})

describe('totalCredits', () => {
    it('sums Liquid and Frozen Funds', () => {
        const state = createTestGameState()
        const player = state.getPlayerState('p1')
        const before = player.liquidFunds + player.frozenFunds
        player.addLiquidFunds(10)
        player.addFrozenFunds(5)
        expect(totalCredits(state, 'p1')).toBe(before + 15)
    })
})

describe('determineWinners', () => {
    it('declares a single Win for whoever has the most Credits', () => {
        const state = createTestGameState()
        state.getPlayerState('p1').addLiquidFunds(50)
        state.getPlayerState('p2').addLiquidFunds(30)

        const { result, winningPlayerIds } = determineWinners(state)

        expect(result).toBe(GameResult.Win)
        expect(winningPlayerIds).toEqual(['p1'])
    })

    it('breaks a Credits tie by the President of the highest-Mining-Capacity Corporation', () => {
        const state = createTestGameState()
        state.getPlayerState('p1').addLiquidFunds(50)
        state.getPlayerState('p2').addLiquidFunds(50) // tied with p1

        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        const frostFederated = state.getCorporation(CorporationId.FrostFederated)
        pinkInc.issueShareToPlayer('p1', 0) // p1 presides over PinkInc
        frostFederated.issueShareToPlayer('p2', 0) // p2 presides over FrostFederated
        // Give PinkInc a higher Mining Capacity than FrostFederated (a Neutral Planet, baseValue 3).
        state.board.buildOutpost('5,0', CorporationId.PinkInc)

        const { result, winningPlayerIds } = determineWinners(state)

        expect(result).toBe(GameResult.Win)
        expect(winningPlayerIds).toEqual(['p1'])
    })

    it('declares a Draw between tied players when none of them presides over any Corporation', () => {
        const state = createTestGameState()
        state.getPlayerState('p1').addLiquidFunds(50)
        state.getPlayerState('p2').addLiquidFunds(50)

        const { result, winningPlayerIds } = determineWinners(state)

        expect(result).toBe(GameResult.Draw)
        expect(winningPlayerIds.sort()).toEqual(['p1', 'p2'])
    })

    it('declares a Draw when the Mining-Capacity tiebreak is itself tied', () => {
        const state = createTestGameState()
        state.getPlayerState('p1').addLiquidFunds(50)
        state.getPlayerState('p2').addLiquidFunds(50)

        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        const frostFederated = state.getCorporation(CorporationId.FrostFederated)
        pinkInc.issueShareToPlayer('p1', 0)
        frostFederated.issueShareToPlayer('p2', 0)
        // Both Corporations still have only their Setup Outpost - equal Mining Capacity.
        expect(state.board.miningCapacityForCorporation(CorporationId.PinkInc)).toBe(
            state.board.miningCapacityForCorporation(CorporationId.FrostFederated)
        )

        const { result, winningPlayerIds } = determineWinners(state)

        expect(result).toBe(GameResult.Draw)
        expect(winningPlayerIds.sort()).toEqual(['p1', 'p2'])
    })

    it("breaks an otherwise-tied Mining-Capacity tiebreak via Ore Refinement's +3 bonus", () => {
        const state = createTestGameState()
        state.getPlayerState('p1').addLiquidFunds(50)
        state.getPlayerState('p2').addLiquidFunds(50)

        const pinkInc = state.getCorporation(CorporationId.PinkInc)
        const frostFederated = state.getCorporation(CorporationId.FrostFederated)
        pinkInc.issueShareToPlayer('p1', 0)
        frostFederated.issueShareToPlayer('p2', 0)
        // Both start with equal raw Mining Capacity (see the Draw test above) - Ore Refinement
        // tips PinkInc ahead without touching the board itself.
        pinkInc.powers.push({ id: CorporatePowerId.OreRefinement })

        const { result, winningPlayerIds } = determineWinners(state)

        expect(result).toBe(GameResult.Win)
        expect(winningPlayerIds).toEqual(['p1'])
    })
})
