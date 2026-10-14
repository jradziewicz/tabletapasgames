import { Color, Hydratable } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { BonusToken } from '../data/board.js'

export type FinalScore = Type.Static<typeof FinalScore>
export const FinalScore = Type.Object({
    setPoints: Type.Number(),
    supplyPoints: Type.Number()
})

export type ColonyState = Type.Static<typeof ColonyState>
export const ColonyState = Type.Object({
    color: Type.Enum(Color),
    playerId: Type.String(),
    supply: Type.Number(),
    dead: Type.Number(),
    vigor: Type.Number(),
    tokens: Type.Array(Type.Enum(BonusToken)),
    finalScore: Type.Optional(FinalScore)
})

export const ColonyStateValidator = Compile(ColonyState)

export class HydratedColonyState extends Hydratable<typeof ColonyState> implements ColonyState {
    declare color: Color
    declare playerId: string
    declare supply: number
    declare dead: number
    declare vigor: number
    declare tokens: BonusToken[]
    declare finalScore?: FinalScore

    constructor(data: ColonyState) {
        super(data, ColonyStateValidator)
    }

    takeFromSupply(amount: number) {
        if (amount > this.supply) {
            throw Error(`${this.color} has only ${this.supply} discs in supply`)
        }
        this.supply -= amount
    }

    hatch(amount: number): number {
        const hatched = Math.min(amount, this.dead)
        this.dead -= hatched
        this.supply += hatched
        return hatched
    }

    die(amount: number) {
        this.dead += amount
    }
}
