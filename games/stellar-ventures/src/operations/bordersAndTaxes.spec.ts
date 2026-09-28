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
import { BoardMap } from '../definition/config.js'
import { MachineState } from '../definition/states.js'
import { HexType } from '../model/board.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { buildOutpostForCorporation, canBuildExpansionOutpost } from './network.js'
import { closeBordersReachedByCorporations } from './borders.js'
import { beginTaxAgentsChoiceIfEligible, payTax, taxDueForCorporation } from './taxes.js'
import { AssignTurnOrderStateHandler } from '../stateHandlers/assignTurnOrder.js'
import { PayTaxesStateHandler } from '../stateHandlers/payTaxes.js'
import { HydratedAssignTurnOrder, AssignTurnOrder } from '../actions/assignTurnOrder.js'
import { HydratedPayTax, isPayTax } from '../actions/payTax.js'
import {
    HydratedTaxAgentsTakeFromTaxBox,
    TaxAgentsTakeFromTaxBox
} from '../actions/taxAgentsTakeFromTaxBox.js'
import { HydratedTaxAgentsForceTax, TaxAgentsForceTax } from '../actions/taxAgentsForceTax.js'

function createBordersAndTaxesState(boardMap: BoardMap = BoardMap.BordersAndTaxes) {
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
        config: { boardMap },
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

function createContext(state: HydratedStellarVenturesGameState) {
    return new MachineContext({ gameConfig: {}, gameState: state })
}

function placeOutposts(
    state: HydratedStellarVenturesGameState,
    corporationId: CorporationId,
    hexIds: string[]
) {
    for (const hexId of hexIds) {
        state.board.buildOutpost(hexId, corporationId)
    }
}

describe('Borders & Taxes setup', () => {
    it('lays out the Borders & Taxes board', () => {
        const state = createBordersAndTaxesState()
        const hexes = Object.values(state.board.hexes)
        expect(hexes).toHaveLength(172)
        expect(state.boardMap).toBe(BoardMap.BordersAndTaxes)
        expect(state.taxBox).toBe(0)
        expect(state.board.closedBorderLevels).toEqual([])
        expect(state.board.miniEarth).toEqual({ valueTrack: [3, 6], fillOrder: [] })
        const alienPlanets = hexes.filter((hex) => hex.type === HexType.AlienPlanet)
        expect(alienPlanets).toHaveLength(8)
        expect(alienPlanets.every((hex) => hex.alienAgreementTileHidden)).toBe(true)
        expect(state.unusedAlienAgreementTileChevrons).toHaveLength(2)
        expect(
            hexes.filter((hex) => hex.homeCorporationId === CorporationId.AmethystAgency)
        ).toHaveLength(2)
        expect(state.board.hasOutpost('16,2', CorporationId.GambogeGuild)).toBe(true)
    })

    it('leaves Alpha games without any Borders & Taxes state', () => {
        const state = createBordersAndTaxesState(BoardMap.Alpha)
        expect(state.boardMap).toBeUndefined()
        expect(state.taxBox).toBeUndefined()
        expect(state.board.miniEarth).toBeUndefined()
        expect(state.board.closedBorderLevels).toBeUndefined()
        expect(state.usesTaxes).toBe(false)
    })
})

describe('Borders & Taxes planets', () => {
    it('drops a two-value Neutral Planet to its lower value for everyone once a 2nd Outpost is built', () => {
        const state = createBordersAndTaxesState()
        const hex = state.board.requireHex('15,0')
        expect(state.board.miningValueAfterNextOutpost(hex)).toBe(3)
        placeOutposts(state, CorporationId.PinkInc, ['15,0'])
        expect(state.board.currentValue(hex)).toBe(3)
        expect(state.board.miningValueAfterNextOutpost(hex)).toBe(2)
        placeOutposts(state, CorporationId.CeruleanCouncil, ['15,0'])
        expect(state.board.currentValue(hex)).toBe(2)
        hex.valueDoubled = true
        expect(state.board.currentValue(hex)).toBe(4)
    })

    it('fills Mini-Earth like Mega-Earth, worth 3 then 6, for at most 2 Corporations', () => {
        const state = createBordersAndTaxesState()
        const miniEarth = state.board.requireHex('-2,10')
        placeOutposts(state, CorporationId.PinkInc, ['-2,10'])
        expect(state.board.miningValueForHex(miniEarth)).toBe(3)
        placeOutposts(state, CorporationId.CeruleanCouncil, ['-2,10'])
        expect(state.board.miningValueForHex(miniEarth)).toBe(6)
        expect(state.board.canBuildOutpost('-2,10', CorporationId.GambogeGuild)).toBe(false)
        state.board.removeOutpost('-2,10', CorporationId.PinkInc)
        expect(state.board.miniEarth?.fillOrder).toEqual([CorporationId.CeruleanCouncil])
        expect(state.board.miningValueForHex(miniEarth)).toBe(3)
    })
})

describe('Borders', () => {
    it('closes a Border once a player Corporation reaches its Activation Value', () => {
        const state = createBordersAndTaxesState()
        closeBordersReachedByCorporations(state)
        expect(state.board.closedBorderLevels).toEqual([])
        placeOutposts(state, CorporationId.PinkInc, ['0,6', '6,2', '4,6'])
        closeBordersReachedByCorporations(state)
        expect(state.board.closedBorderLevels).toEqual([1])
    })

    it('ignores the Alien Corporation when closing Borders', () => {
        const state = createBordersAndTaxesState()
        state.alienCorporation.miningCapacity = 35
        closeBordersReachedByCorporations(state)
        expect(state.board.closedBorderLevels).toEqual([])
    })

    it('blocks adjacent builds across a Closed Border but not within it', () => {
        const state = createBordersAndTaxesState()
        placeOutposts(state, CorporationId.PinkInc, ['3,0', '4,1'])
        expect(canBuildExpansionOutpost(state.board, CorporationId.PinkInc, '3,1')).toBe(true)
        state.board.closeBorder(1)
        expect(canBuildExpansionOutpost(state.board, CorporationId.PinkInc, '3,1')).toBe(true)
        state.board.removeOutpost('4,1', CorporationId.PinkInc)
        expect(canBuildExpansionOutpost(state.board, CorporationId.PinkInc, '3,1')).toBe(false)
        expect(canBuildExpansionOutpost(state.board, CorporationId.PinkInc, '4,0')).toBe(true)
    })

    it('closes Borders as a build pushes Mining Capacity over the Activation Value', () => {
        const state = createBordersAndTaxesState()
        placeOutposts(state, CorporationId.PinkInc, ['0,6', '6,2'])
        buildOutpostForCorporation(state, '4,6', CorporationId.PinkInc)
        expect(state.board.isBorderClosed(1)).toBe(true)
    })
})

describe('Taxes', () => {
    it('charges only the most expensive Tax Zone a Corporation is present in', () => {
        const state = createBordersAndTaxesState()
        expect(taxDueForCorporation(state, CorporationId.PinkInc)).toBe(0)
        placeOutposts(state, CorporationId.PinkInc, ['3,1'])
        expect(taxDueForCorporation(state, CorporationId.PinkInc)).toBe(2)
        placeOutposts(state, CorporationId.PinkInc, ['5,4'])
        expect(taxDueForCorporation(state, CorporationId.PinkInc)).toBe(4)
    })

    it('takes Loans from the Outpost supply when the Treasury is short', () => {
        const state = createBordersAndTaxesState()
        placeOutposts(state, CorporationId.PinkInc, ['5,4'])
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.treasury = 1
        const supplyBefore = corporation.unbuiltOutposts
        const payment = payTax(state, CorporationId.PinkInc, [])
        expect(payment).toEqual({ amount: 4, loans: 1 })
        expect(corporation.treasury).toBe(0)
        expect(corporation.unbuiltOutposts).toBe(supplyBefore - 1)
        expect(corporation.loanCount).toBe(1)
        expect(state.taxBox).toBe(4)
    })

    it('adds a Pay Taxes step after Assign Turn Order that pays into the Tax Box', () => {
        const state = createBordersAndTaxesState()
        state.machineState = MachineState.AssignTurnOrder
        placeOutposts(state, CorporationId.PinkInc, ['3,1'])
        state.getCorporation(CorporationId.PinkInc).treasury = 10
        const context = createContext(state)

        const assignTurnOrder = new HydratedAssignTurnOrder(
            context.createSystemAction(AssignTurnOrder)
        )
        assignTurnOrder.apply(state, context)
        const nextState = new AssignTurnOrderStateHandler().onAction(assignTurnOrder, context)
        expect(nextState).toBe(MachineState.PayTaxes)
        expect([...(state.taxPayerCorporationIds ?? [])].sort()).toEqual([
            CorporationId.PinkInc,
            CorporationId.ScarletSyndicate
        ])

        const payTaxesHandler = new PayTaxesStateHandler()
        const nextStates: string[] = []
        while ((state.taxPayerCorporationIds ?? []).length > 0) {
            payTaxesHandler.enter(context)
            const pending = context.getPendingActions().pop()
            if (!isPayTax(pending)) {
                throw Error('Expected a pending PayTax system action')
            }
            const payTaxAction = new HydratedPayTax(pending)
            payTaxAction.apply(state, context)
            nextStates.push(payTaxesHandler.onAction(payTaxAction, context))
        }
        expect(nextStates).toEqual([MachineState.PayTaxes, MachineState.IssueShare])
        expect(state.taxBox).toBe(4)
        expect(state.getCorporation(CorporationId.PinkInc).treasury).toBe(8)
        expect(state.getCorporation(CorporationId.ScarletSyndicate).loanCount).toBe(1)
    })
})

describe('Tax Agents', () => {
    function amethystWithTaxAgents(state: HydratedStellarVenturesGameState) {
        const amethyst = state.getCorporation(CorporationId.AmethystAgency)
        amethyst.active = true
        amethyst.powers.push({ id: CorporatePowerId.TaxAgents })
        amethyst.issueShareToPlayer('p1', 1, 0)
        return amethyst
    }

    it('lets the President take up to ₮3 from the Tax Box after building on an Alien Planet', () => {
        const state = createBordersAndTaxesState()
        const amethyst = amethystWithTaxAgents(state)
        state.taxBox = 2
        placeOutposts(state, CorporationId.AmethystAgency, ['5,4'])
        expect(
            beginTaxAgentsChoiceIfEligible(
                state,
                CorporationId.AmethystAgency,
                '5,4',
                MachineState.PayDividends
            )
        ).toBe(true)
        const context = createContext(state)
        const take = new HydratedTaxAgentsTakeFromTaxBox(
            context.createSystemAction(TaxAgentsTakeFromTaxBox, { playerId: 'p1' })
        )
        const treasuryBefore = amethyst.treasury
        take.apply(state, context)
        expect(state.taxBox).toBe(0)
        expect(amethyst.treasury).toBe(treasuryBefore + 2)
    })

    it('forces the other Corporations on that Alien Planet to pay their normal Tax', () => {
        const state = createBordersAndTaxesState()
        amethystWithTaxAgents(state)
        placeOutposts(state, CorporationId.PinkInc, ['5,4'])
        placeOutposts(state, CorporationId.AmethystAgency, ['5,4'])
        expect(
            beginTaxAgentsChoiceIfEligible(
                state,
                CorporationId.AmethystAgency,
                '5,4',
                MachineState.ExpandNetworkOrWormhole
            )
        ).toBe(true)
        const context = createContext(state)
        const force = new HydratedTaxAgentsForceTax(
            context.createSystemAction(TaxAgentsForceTax, { playerId: 'p1' })
        )
        force.apply(state, context)
        expect(state.taxPayerCorporationIds).toEqual([CorporationId.PinkInc])
        expect(state.taxResumeState).toBe(MachineState.ExpandNetworkOrWormhole)
    })

    it('skips the choice when neither option would do anything', () => {
        const state = createBordersAndTaxesState()
        amethystWithTaxAgents(state)
        placeOutposts(state, CorporationId.AmethystAgency, ['13,0'])
        expect(
            beginTaxAgentsChoiceIfEligible(
                state,
                CorporationId.AmethystAgency,
                '13,0',
                MachineState.PayDividends
            )
        ).toBe(false)
    })
})
