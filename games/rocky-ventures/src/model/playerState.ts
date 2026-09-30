import { Hydratable, PlayerState, Color } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CompanyId } from '../data/companies.js'
import { AgreementLetter } from '../data/agreements.js'
import { DeliveryCityId } from '../data/board.js'

export const MaxGems = 3

export type OwnedShare = Type.Static<typeof OwnedShare>
export const OwnedShare = Type.Object({
    companyId: Type.Enum(CompanyId),
    shareIndex: Type.Number(),
    cardId: Type.Optional(Type.String())
})

export type OwnedAgreement = Type.Static<typeof OwnedAgreement>
export const OwnedAgreement = Type.Object({
    cityId: Type.Enum(DeliveryCityId),
    letter: Type.Enum(AgreementLetter)
})

export type RockyVenturesPlayerState = Type.Static<typeof RockyVenturesPlayerState>
export const RockyVenturesPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            money: Type.Number(),
            gems: Type.Number(),
            claimTokens: Type.Number(),
            victoryPoints: Type.Number(),
            weaponLevel: Type.Number(),
            toolLevel: Type.Number(),
            redMinesUnlocked: Type.Boolean(),
            blueMinesUnlocked: Type.Boolean(),
            tableau: Type.Array(Type.String()),
            tuckedCardIds: Type.Array(Type.String()),
            pawnIndex: Type.Optional(Type.Number()),
            shares: Type.Array(OwnedShare),
            agreements: Type.Array(OwnedAgreement)
        })
    ])
)

export const RockyVenturesPlayerStateValidator = Compile(RockyVenturesPlayerState)

export class HydratedRockyVenturesPlayerState
    extends Hydratable<typeof RockyVenturesPlayerState>
    implements RockyVenturesPlayerState
{
    declare playerId: string
    declare color: Color
    declare money: number
    declare gems: number
    declare claimTokens: number
    declare victoryPoints: number
    declare weaponLevel: number
    declare toolLevel: number
    declare redMinesUnlocked: boolean
    declare blueMinesUnlocked: boolean
    declare tableau: string[]
    declare tuckedCardIds: string[]
    declare pawnIndex?: number
    declare shares: OwnedShare[]
    declare agreements: OwnedAgreement[]

    constructor(data: RockyVenturesPlayerState) {
        super(data, RockyVenturesPlayerStateValidator)
    }

    spendMoney(amount: number) {
        if (amount > this.money) {
            throw Error(`Player ${this.playerId} does not have enough money`)
        }
        this.money -= amount
    }

    addMoney(amount: number) {
        this.money += amount
    }

    spendGems(amount: number) {
        if (amount > this.gems) {
            throw Error(`Player ${this.playerId} does not have enough gems`)
        }
        this.gems -= amount
    }

    addGems(amount: number): number {
        const gained = Math.max(0, Math.min(amount, MaxGems - this.gems))
        this.gems += gained
        return gained
    }

    addVictoryPoints(amount: number) {
        this.victoryPoints += amount
    }

    get pawnCardId(): string | undefined {
        return this.pawnIndex === undefined ? undefined : this.tableau[this.pawnIndex]
    }
}
