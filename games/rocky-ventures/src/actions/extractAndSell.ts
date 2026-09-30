import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { DeliveryCityId } from '../data/board.js'
import { CompanyId } from '../data/companies.js'
import {
    extractAndSellAt,
    extractableMineIds,
    reasonExtractInvalid
} from '../operations/extract.js'

export type ExtractAndSell = Type.Static<typeof ExtractAndSell>
export const ExtractAndSell = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExtractAndSell),
            playerId: Type.String(),
            nodeId: Type.String(),
            cityId: Type.Optional(Type.Enum(DeliveryCityId)),
            creditCompanyId: Type.Optional(Type.Enum(CompanyId)),
            routeNodeIds: Type.Optional(Type.Array(Type.String()))
        })
    ])
)

export const ExtractAndSellValidator = Compile(ExtractAndSell)

export function isExtractAndSell(action?: GameAction): action is ExtractAndSell {
    return action?.type === ActionType.ExtractAndSell
}

export class HydratedExtractAndSell
    extends HydratableAction<typeof ExtractAndSell>
    implements ExtractAndSell
{
    declare type: ActionType.ExtractAndSell
    declare playerId: string
    declare nodeId: string
    declare cityId?: DeliveryCityId
    declare creditCompanyId?: CompanyId
    declare routeNodeIds?: string[]

    constructor(data: ExtractAndSell) {
        super(data, ExtractAndSellValidator)
    }

    apply(state: HydratedRockyVenturesGameState, _context?: MachineContext) {
        const request = {
            nodeId: this.nodeId,
            cityId: this.cityId,
            creditCompanyId: this.creditCompanyId,
            routeNodeIds: this.routeNodeIds
        }
        const invalidReason = reasonExtractInvalid(state, this.playerId, request)
        if (invalidReason) {
            throw Error(invalidReason)
        }
        extractAndSellAt(state, this.playerId, request)
    }

    static canExtractAndSell(state: HydratedRockyVenturesGameState, playerId: string): boolean {
        return extractableMineIds(state, playerId).length > 0
    }
}
