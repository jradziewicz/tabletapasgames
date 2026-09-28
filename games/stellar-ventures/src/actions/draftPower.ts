import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporatePowerId } from '../model/corporation.js'
import { MAX_CARGO } from '../operations/shipOrdering.js'
import { closeBordersReachedByCorporations } from '../operations/borders.js'

export type DraftPower = Type.Static<typeof DraftPower>
export const DraftPower = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DraftPower),
            playerId: Type.String(),
            powerId: Type.String()
        })
    ])
)

export const DraftPowerValidator = Compile(DraftPower)

export function isDraftPower(action?: GameAction): action is DraftPower {
    return action?.type === ActionType.DraftPower
}

/**
 * Draft Power: the President of state.draftPowerCorporationId chooses one Corporate Power from
 * the currently visible pool (state.availableCorporatePowerIds) and adds it to their
 * Corporation's Charter, Active immediately. Reached from two places in the rulebook, both
 * routed through stateHandlers/draftPower.ts:
 *   - Initial Auction step 4 (rulebook page 11): "Chooses a second Corporate Power from the row
 *     of available powers" - every winning President chooses one, alongside the "Alien
 *     Explorers" Power their Corporation already started with (see
 *     stateHandlers/initialAuction.ts).
 *   - Sign The Agreement step 5, "Draft Power" (rulebook page 22): after discarding "Alien
 *     Explorers"/"Sign the Agreement" (see actions/signTheAgreement.ts), the President selects a
 *     replacement Power (see stateHandlers/offerSignTheAgreement.ts).
 * Per the Amethyst Agency FAQ (page 23), Amethyst's own Formation Power ("Secret Agents") is
 * granted directly at Formation instead - it never drafts through here (see
 * actions/chooseAmethystHomePlanet.ts). A Corporation never has more than two Active Powers
 * (rulebook page 25) - both draft points above only ever fire when the Corporation currently has
 * fewer than two, so this doesn't need to separately enforce that cap.
 *
 * Windfall (Glossary, page 29): "Immediately, One-Time. Immediately receive ₮5 to the Corporate
 * Treasury, then discard." Since drafting IS the qualifying "Immediately" trigger (there's no
 * other moment a Corporation could hold this Power), its entire effect resolves inline the moment
 * it's drafted: the ₮5 is added to the Treasury and the Power is removed again in the same apply()
 * call, so a drafted Windfall is never actually left sitting on the Charter afterward - it never
 * counts toward the two-Active-Powers cap and never shows up in corporation.powers post-draft.
 *
 * Hyperdrive (Glossary, page 29): "Permanent, Ongoing. Permanently increase CARGO +1." Confirmed
 * by the game's co-designer: this is a direct, immediate +1 to the Corporation's actual CARGO
 * (corporation.cargo), not an increase to its CARGO cap (operations/shipOrdering.ts's MAX_CARGO
 * is a flat, universal 13 for every Corporation). Unlike Windfall, its Glossary text says nothing
 * about discarding and is explicitly labeled "Permanent" rather than "One-Time" - so, once
 * granted, Hyperdrive stays on the Charter and counts toward the two-Active-Powers cap, even
 * though its one-time CARGO effect has already resolved.
 */
export class HydratedDraftPower extends HydratableAction<typeof DraftPower> implements DraftPower {
    declare type: ActionType.DraftPower
    declare playerId: string
    declare powerId: string

    constructor(data: DraftPower) {
        super(data, DraftPowerValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDraftPowerInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.draftPowerCorporationId
        assertExists(corporationId, 'A Corporation should be pending Draft Power')
        const corporation = state.getCorporation(corporationId)

        state.availableCorporatePowerIds = state.availableCorporatePowerIds.filter(
            (id) => id !== this.powerId
        )
        corporation.powers.push({ id: this.powerId })

        if (this.powerId === CorporatePowerId.Windfall) {
            corporation.treasury += 5
            corporation.powers = corporation.powers.filter((power) => power.id !== CorporatePowerId.Windfall)
        }

        if (this.powerId === CorporatePowerId.Hyperdrive) {
            corporation.cargo = Math.min(MAX_CARGO, corporation.cargo + 1)
        }

        closeBordersReachedByCorporations(state)
    }

    isValidDraftPower(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDraftPower.canDraftPower(state, this.playerId, this.powerId)
    }

    reasonDraftPowerInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDraftPower.reasonDraftPowerInvalid(state, this.playerId, this.powerId)
    }

    static canDraftPower(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        powerId: string
    ): boolean {
        return (
            HydratedDraftPower.reasonDraftPowerInvalid(state, playerId, powerId) === undefined
        )
    }

    static reasonDraftPowerInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        powerId: string
    ): string | undefined {
        const corporationId = state.draftPowerCorporationId
        if (!corporationId) {
            return 'No Draft Power selection is currently pending'
        }
        if (!state.availableCorporatePowerIds.includes(powerId)) {
            return 'That Power is not available to draft'
        }
        if (state.getCorporation(corporationId).getPresidentPlayerId() !== playerId) {
            return 'Only the President may Draft a Power'
        }
        return undefined
    }
}
