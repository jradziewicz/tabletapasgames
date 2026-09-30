import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { AgreementLetter } from '../data/agreements.js'
import { DeliveryCityId } from '../data/board.js'
import { CompanyId } from '../data/companies.js'
import { discardAgreement, reasonDiscardAgreementInvalid } from '../operations/agreementDiscard.js'

export type DiscardAgreement = Type.Static<typeof DiscardAgreement>
export const DiscardAgreement = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DiscardAgreement),
            playerId: Type.String(),
            cityId: Type.Enum(DeliveryCityId),
            letter: Type.Enum(AgreementLetter),
            companyId: Type.Enum(CompanyId)
        })
    ])
)

export const DiscardAgreementValidator = Compile(DiscardAgreement)

export function isDiscardAgreement(action?: GameAction): action is DiscardAgreement {
    return action?.type === ActionType.DiscardAgreement
}

export class HydratedDiscardAgreement
    extends HydratableAction<typeof DiscardAgreement>
    implements DiscardAgreement
{
    declare type: ActionType.DiscardAgreement
    declare playerId: string
    declare cityId: DeliveryCityId
    declare letter: AgreementLetter
    declare companyId: CompanyId

    constructor(data: DiscardAgreement) {
        super(data, DiscardAgreementValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = reasonDiscardAgreementInvalid(
            state,
            this.playerId,
            this.cityId,
            this.letter,
            this.companyId
        )
        if (invalidReason) {
            throw Error(invalidReason)
        }
        discardAgreement(state, this.playerId, this.cityId, this.letter, this.companyId)
    }

    static canDiscardAgreement(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        return (
            state.activePlayerIds.includes(playerId) &&
            state.getPlayerState(playerId).agreements.length > 0
        )
    }
}
