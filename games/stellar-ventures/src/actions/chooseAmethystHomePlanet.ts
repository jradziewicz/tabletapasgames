import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { buildOutpostForCorporation } from '../operations/network.js'

export type ChooseAmethystHomePlanet = Type.Static<typeof ChooseAmethystHomePlanet>
export const ChooseAmethystHomePlanet = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseAmethystHomePlanet),
            playerId: Type.String(),
            hexId: Type.String()
        })
    ])
)

export const ChooseAmethystHomePlanetValidator = Compile(ChooseAmethystHomePlanet)

export function isChooseAmethystHomePlanet(
    action?: GameAction
): action is ChooseAmethystHomePlanet {
    return action?.type === ActionType.ChooseAmethystHomePlanet
}

/**
 * The final step of forming the Amethyst Agency (rulebook page 9; Amethyst Agency FAQ, page 23):
 * once its Formation Auction (see stateHandlers/formAmethystAgency.ts) has determined its first
 * President, that President "chooses a Home Planet from available options, placing an Outpost
 * (no cost)." Amethyst Agency has 3 candidate Home Planets on the Alpha map
 * (data/alphaBoard.ts's AmethystCandidateHomeHexIds) - the FAQ confirms all 3 remain Home Planets
 * for the entire game regardless of which one is chosen, so no other Corporation may ever build
 * on any of them (already enforced by HydratedBoardState.canBuildOutpost's homeCorporationId
 * check, since all 3 hexes are pre-tagged homeCorporationId: AmethystAgency).
 *
 * "Adjust Mining Capacity to value of Home Planet" needs no separate step here - Mining Capacity
 * is always computed live from a Corporation's Outposts (see
 * HydratedBoardState.miningCapacityForCorporation), so placing this Outpost does that
 * automatically.
 *
 * This is also where Amethyst Agency gains its Formation Power, "Secret Agents" (Amethyst Agency
 * FAQ, page 23: "Amethyst Agency begins with the 'Secret Agents' Power when playing on the Alpha
 * map... It does not select a second power when the Corporation launches") - unlike every other
 * Corporation's President from the Initial Auction, Amethyst's President never drafts a second
 * Power here (see actions/draftPower.ts).
 */
export class HydratedChooseAmethystHomePlanet
    extends HydratableAction<typeof ChooseAmethystHomePlanet>
    implements ChooseAmethystHomePlanet
{
    declare type: ActionType.ChooseAmethystHomePlanet
    declare playerId: string
    declare hexId: string

    constructor(data: ChooseAmethystHomePlanet) {
        super(data, ChooseAmethystHomePlanetValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonChooseAmethystHomePlanetInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporation = state.getCorporation(CorporationId.AmethystAgency)
        buildOutpostForCorporation(state, this.hexId, CorporationId.AmethystAgency)
        corporation.homePlanetId = this.hexId
        corporation.active = true
        corporation.powers.push({
            id: state.usesTaxes ? CorporatePowerId.TaxAgents : CorporatePowerId.SecretAgents
        })
        // Rulebook page 9: "Amethyst Agency starts at position 6 in Corporation Turn Order" -
        // i.e. appended after the other 5 Corporations already there.
        corporation.turnOrderPosition = state.corporationTurnOrder.length
        state.corporationTurnOrder = [...state.corporationTurnOrder, CorporationId.AmethystAgency]
    }

    isValidChooseAmethystHomePlanet(state: HydratedStellarVenturesGameState): boolean {
        return this.reasonChooseAmethystHomePlanetInvalid(state) === undefined
    }

    reasonChooseAmethystHomePlanetInvalid(
        state: HydratedStellarVenturesGameState
    ): string | undefined {
        return HydratedChooseAmethystHomePlanet.reasonChooseAmethystHomePlanetInvalid(
            state,
            this.playerId,
            this.hexId
        )
    }

    static canChooseAmethystHomePlanet(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): boolean {
        return (
            HydratedChooseAmethystHomePlanet.reasonChooseAmethystHomePlanetPlayerInvalid(
                state,
                playerId
            ) === undefined
        )
    }

    static reasonChooseAmethystHomePlanetPlayerInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string
    ): string | undefined {
        const corporation = state.getCorporation(CorporationId.AmethystAgency)
        if (corporation.homePlanetId !== undefined) {
            return 'Amethyst Agency has already chosen its Home Planet'
        }
        if (state.activeShareAuction) {
            return 'A Share Auction is in progress'
        }
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President of Amethyst Agency may choose its Home Planet'
        }
        return undefined
    }

    static reasonChooseAmethystHomePlanetInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string
    ): string | undefined {
        const playerReason = HydratedChooseAmethystHomePlanet.reasonChooseAmethystHomePlanetPlayerInvalid(
            state,
            playerId
        )
        if (playerReason) {
            return playerReason
        }
        if (!HydratedChooseAmethystHomePlanet.availableHomePlanetHexIds(state).includes(hexId)) {
            return 'That is not an available Home Planet'
        }
        return undefined
    }

    static availableHomePlanetHexIds(state: HydratedStellarVenturesGameState): string[] {
        return Object.values(state.board.hexes)
            .filter(
                (hex) =>
                    hex.homeCorporationId === CorporationId.AmethystAgency &&
                    hex.outposts.length === 0
            )
            .map((hex) => hex.id)
    }
}
