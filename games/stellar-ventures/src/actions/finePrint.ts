import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporatePowerId, HydratedCorporationState } from '../model/corporation.js'
import { MachineState } from '../definition/states.js'

// Since Fine Print is a single unique physical tile, at most 1 Corporation can ever hold it - no
// corporationId parameter is needed on the action itself; this simply finds whichever one (if
// any) currently has it active. Shared with actions/declineFinePrint.ts and
// stateHandlers/boardroomBattle.ts.
export function finePrintCorporation(
    state: HydratedStellarVenturesGameState
): HydratedCorporationState | undefined {
    return state.corporations.find((corporation) => corporation.hasActivePower(CorporatePowerId.FinePrint))
}

export type FinePrint = Type.Static<typeof FinePrint>
export const FinePrint = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FinePrint),
            playerId: Type.String()
        })
    ])
)

export const FinePrintValidator = Compile(FinePrint)

export function isFinePrint(action?: GameAction): action is FinePrint {
    return action?.type === ActionType.FinePrint
}

/**
 * Fine Print (Corporate Power Glossary, page 29): "Investor Round, One-Time. Before Boardroom
 * Battle begins, discard to prevent any Votes being placed on this Corporation (and it can't be
 * forced to Issue a Share) during that specific Boardroom Battle." Offered once, right at the
 * start of every fresh Boardroom Battle, to the President of whichever Corporation holds it (see
 * finePrintCorporation above) - before voting order is even set up - see
 * stateHandlers/boardroomBattle.ts. state.finePrintOfferResolved gates this so it's only ever
 * offered once per Battle, whether used (here, which also sets
 * state.finePrintExemptCorporationId - see operations/boardroomBattle.ts's
 * eligibleBoardroomBattleCorporationIds) or declined (actions/declineFinePrint.ts). Both
 * finePrintExemptCorporationId and finePrintOfferResolved are cleared once this Boardroom Battle
 * fully resolves (resetFinePrintForNextBoardroomBattle), so a later Battle can offer it again if
 * it was declined (not discarded) here.
 */
export class HydratedFinePrint extends HydratableAction<typeof FinePrint> implements FinePrint {
    declare type: ActionType.FinePrint
    declare playerId: string

    constructor(data: FinePrint) {
        super(data, FinePrintValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonFinePrintInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporation = finePrintCorporation(state)
        assertExists(corporation, 'Fine Print holder should be present while applying it')

        state.finePrintExemptCorporationId = corporation.id
        state.finePrintOfferResolved = true
        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.FinePrint
        )
    }

    isValidFinePrint(state: HydratedStellarVenturesGameState): boolean {
        return HydratedFinePrint.canFinePrint(state, this.playerId)
    }

    reasonFinePrintInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedFinePrint.reasonFinePrintInvalid(state, this.playerId)
    }

    static canFinePrint(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        return HydratedFinePrint.reasonFinePrintInvalid(state, playerId) === undefined
    }

    static reasonFinePrintInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        if (state.machineState !== MachineState.BoardroomBattle) {
            return 'Fine Print can only be used during a Boardroom Battle'
        }
        if (state.finePrintOfferResolved) {
            return 'Fine Print has already been resolved this Boardroom Battle'
        }
        const corporation = finePrintCorporation(state)
        if (corporation?.getPresidentPlayerId() !== playerId) {
            return 'Only the President of the Corporation holding Fine Print may use it'
        }
        return undefined
    }
}
