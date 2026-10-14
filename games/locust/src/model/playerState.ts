import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

export type LocustPlayerState = Type.Static<typeof LocustPlayerState>
export const LocustPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            vigorColor: Type.Optional(Type.Enum(Color)),
            score: Type.Optional(Type.Number())
        })
    ])
)

export const LocustPlayerStateValidator = Compile(LocustPlayerState)

export class HydratedLocustPlayerState
    extends Hydratable<typeof LocustPlayerState>
    implements LocustPlayerState
{
    declare playerId: string
    declare color: Color
    declare vigorColor?: Color
    declare score?: number

    constructor(data: LocustPlayerState) {
        super(data, LocustPlayerStateValidator)
    }
}
