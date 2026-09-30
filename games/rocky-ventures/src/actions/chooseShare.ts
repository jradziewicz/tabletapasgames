import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CompanyId } from '../data/companies.js'

export type ChooseShare = Type.Static<typeof ChooseShare>
export const ChooseShare = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseShare),
            playerId: Type.String(),
            companyId: Type.Enum(CompanyId)
        })
    ])
)

export const ChooseShareValidator = Compile(ChooseShare)

export function isChooseShare(action?: GameAction): action is ChooseShare {
    return action?.type === ActionType.ChooseShare
}

export class HydratedChooseShare
    extends HydratableAction<typeof ChooseShare>
    implements ChooseShare
{
    declare type: ActionType.ChooseShare
    declare playerId: string
    declare companyId: CompanyId

    constructor(data: ChooseShare) {
        super(data, ChooseShareValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const invalidReason = HydratedChooseShare.reasonChooseShareInvalid(
            state,
            this.playerId,
            this.companyId
        )
        if (invalidReason) {
            throw Error(invalidReason)
        }
        const pending = state.pendingShare
        if (!pending) {
            throw Error('There is no share to choose')
        }
        const company = state.getCompany(this.companyId)
        const shareIndex = company.takeNextShare()
        company.treasury += pending.amount
        state.getPlayerState(this.playerId).shares.push({
            companyId: this.companyId,
            shareIndex,
            cardId: pending.cardId
        })
        delete state.pendingShare
    }

    static reasonChooseShareInvalid(
        state: HydratedRockyVenturesGameState,
        playerId: string,
        companyId: CompanyId
    ): string | undefined {
        if (!state.activePlayerIds.includes(playerId)) {
            return 'It is not your turn'
        }
        if (!state.pendingShare) {
            return 'There is no share to choose'
        }
        if (!state.pendingShare.companyIds.includes(companyId)) {
            return 'That company is not offered'
        }
        return undefined
    }
}
