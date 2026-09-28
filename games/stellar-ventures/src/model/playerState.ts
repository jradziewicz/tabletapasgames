import { Hydratable, PlayerState, Color } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { InvestorActionId, AlienTechActionId } from './investorBoard.js'

export type StellarVenturesPlayerState = Type.Static<typeof StellarVenturesPlayerState>
export const StellarVenturesPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            liquidFunds: Type.Number(),
            frozenFunds: Type.Number(),
            boardroomVotes: Type.Number(),
            alienTechCubes: Type.Number(),
            // The Investor Board's Action Discs (rulebook page 19): the Investor/Alien Tech
            // Action this player took most recently, persisting across Investor Rounds.
            // Undefined means the disc is off the board (never used, or last removed by
            // passing) - every action is available. See model/investorBoard.ts and
            // operations/investorShenanigans.ts.
            lastInvestorActionId: Type.Optional(Type.Enum(InvestorActionId)),
            lastAlienTechActionId: Type.Optional(Type.Enum(AlienTechActionId))
        })
    ])
)

export const StellarVenturesPlayerStateValidator = Compile(StellarVenturesPlayerState)

export class HydratedStellarVenturesPlayerState
    extends Hydratable<typeof StellarVenturesPlayerState>
    implements StellarVenturesPlayerState
{
    declare playerId: string
    declare color: Color
    declare liquidFunds: number
    declare frozenFunds: number
    declare boardroomVotes: number
    declare alienTechCubes: number
    declare lastInvestorActionId?: InvestorActionId
    declare lastAlienTechActionId?: AlienTechActionId

    constructor(data: StellarVenturesPlayerState) {
        super(data, StellarVenturesPlayerStateValidator)
    }

    spendLiquidFunds(amount: number) {
        if (amount > this.liquidFunds) {
            throw Error(`Player ${this.playerId} does not have enough liquid funds`)
        }
        this.liquidFunds -= amount
    }

    addLiquidFunds(amount: number) {
        this.liquidFunds += amount
    }

    addFrozenFunds(amount: number) {
        this.frozenFunds += amount
    }

    releaseDividends() {
        this.liquidFunds += this.frozenFunds
        this.frozenFunds = 0
    }

    spendBoardroomVotes(amount: number) {
        if (amount > this.boardroomVotes) {
            throw Error(`Player ${this.playerId} does not have enough boardroom votes`)
        }
        this.boardroomVotes -= amount
    }

    addBoardroomVotes(amount: number) {
        this.boardroomVotes += amount
    }

    spendAlienTechCubes(amount: number) {
        if (amount > this.alienTechCubes) {
            throw Error(`Player ${this.playerId} does not have enough alien technology cubes`)
        }
        this.alienTechCubes -= amount
    }

    addAlienTechCubes(amount: number) {
        this.alienTechCubes += amount
    }
}
