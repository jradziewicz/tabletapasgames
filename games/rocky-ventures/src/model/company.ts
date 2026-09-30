import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from '@tabletop/common'
import {
    CompanyId,
    DornochDurConnectionBonus,
    FlippedShareMultipliers,
    ShareFlipTriggerIndex,
    ShareMultipliers,
    SharesPerCompany,
    TrackValueByCubeCount
} from '../data/companies.js'

export type CompanyState = Type.Static<typeof CompanyState>
export const CompanyState = Type.Object({
    id: Type.Enum(CompanyId),
    treasury: Type.Number(),
    cubesOnMap: Type.Number(),
    deliveredMineTokenIds: Type.Array(Type.String()),
    nextShareIndex: Type.Number(),
    sharesFlipped: Type.Boolean(),
    connectedToDornochDur: Type.Boolean()
})

export const CompanyStateValidator = Compile(CompanyState)

export class HydratedCompanyState extends Hydratable<typeof CompanyState> implements CompanyState {
    declare id: CompanyId
    declare treasury: number
    declare cubesOnMap: number
    declare deliveredMineTokenIds: string[]
    declare nextShareIndex: number
    declare sharesFlipped: boolean
    declare connectedToDornochDur: boolean

    constructor(data: CompanyState) {
        super(data, CompanyStateValidator)
    }

    get trackValue(): number {
        return TrackValueByCubeCount[Math.min(this.cubesOnMap, TrackValueByCubeCount.length) - 1] ?? 0
    }

    get deliveryValue(): number {
        return this.deliveredMineTokenIds.length
    }

    get value(): number {
        return (
            this.trackValue +
            this.deliveryValue +
            (this.connectedToDornochDur ? DornochDurConnectionBonus : 0)
        )
    }

    get sharesRemaining(): number {
        return SharesPerCompany - this.nextShareIndex
    }

    multiplierForShare(shareIndex: number): number {
        const multipliers = this.sharesFlipped ? FlippedShareMultipliers : ShareMultipliers
        return multipliers[shareIndex] ?? 0
    }

    takeNextShare(): number {
        if (this.sharesRemaining <= 0) {
            throw Error(`Company ${this.id} has no shares left`)
        }
        const shareIndex = this.nextShareIndex
        this.nextShareIndex += 1
        if (shareIndex === ShareFlipTriggerIndex) {
            this.sharesFlipped = true
        }
        return shareIndex
    }
}
