import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HexType } from '../model/board.js'
import { AlienTechActionId } from '../model/investorBoard.js'
import { canSelectAlienTechActionId } from '../operations/investorShenanigans.js'
import { closeBordersReachedByCorporations } from '../operations/borders.js'

export type DevelopPlanets = Type.Static<typeof DevelopPlanets>
export const DevelopPlanets = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DevelopPlanets),
            playerId: Type.String(),
            hexIds: Type.Array(Type.String())
        })
    ])
)

export const DevelopPlanetsValidator = Compile(DevelopPlanets)

export function isDevelopPlanets(action?: GameAction): action is DevelopPlanets {
    return action?.type === ActionType.DevelopPlanets
}

/**
 * Investor Shenanigans' Develop Planet(s) Alien Tech Action (rulebook page 19): "Place cubes on
 * any number of Neutral Planets without a cube. This permanently doubles the planet's Value.
 * Adjust Mining Capacity for all Corporations." Available to any player regardless of
 * Shareholder status, unlike Cargo Boost and Research Wormhole - it acts on the shared board,
 * not a specific Corporation's Shares. Costs exactly 1 cube per targeted Neutral Planet; each
 * must not already have a cube (hex.valueDoubled). Mining Capacity needs no explicit adjustment
 * here - HydratedBoardState.miningCapacityForCorporation already reads valueDoubled live, so
 * every Corporation's Mining Capacity reflects the change immediately.
 */
export class HydratedDevelopPlanets
    extends HydratableAction<typeof DevelopPlanets>
    implements DevelopPlanets
{
    declare type: ActionType.DevelopPlanets
    declare playerId: string
    declare hexIds: string[]

    constructor(data: DevelopPlanets) {
        super(data, DevelopPlanetsValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonDevelopPlanetsInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        for (const hexId of this.hexIds) {
            const hex = state.board.requireHex(hexId)
            hex.valueDoubled = true
        }
        closeBordersReachedByCorporations(state)

        const player = state.getPlayerState(this.playerId)
        player.spendAlienTechCubes(this.hexIds.length)
        player.lastAlienTechActionId = AlienTechActionId.DevelopPlanets
    }

    isValidDevelopPlanets(state: HydratedStellarVenturesGameState): boolean {
        return HydratedDevelopPlanets.canDevelopPlanets(state, this.playerId, this.hexIds)
    }

    reasonDevelopPlanetsInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedDevelopPlanets.reasonDevelopPlanetsInvalid(state, this.playerId, this.hexIds)
    }

    static canDevelopPlanets(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexIds: string[]
    ): boolean {
        return (
            HydratedDevelopPlanets.reasonDevelopPlanetsInvalid(state, playerId, hexIds) === undefined
        )
    }

    static reasonDevelopPlanetsInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexIds: string[]
    ): string | undefined {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return 'It is not your Investor Shenanigans turn'
        }
        if (!canSelectAlienTechActionId(state, playerId, AlienTechActionId.DevelopPlanets)) {
            return 'Develop Planets is not available right now'
        }
        if (hexIds.length < 1) {
            return 'At least one Neutral Planet must be selected'
        }
        if (new Set(hexIds).size !== hexIds.length) {
            return 'The same hex was selected more than once'
        }
        for (const hexId of hexIds) {
            const hex = state.board.getHex(hexId)
            if (!hex || hex.type !== HexType.NeutralPlanet || hex.valueDoubled) {
                return 'One or more selected hexes are not eligible Neutral Planets'
            }
        }
        if (state.getPlayerState(playerId).alienTechCubes < hexIds.length) {
            return 'Insufficient Alien Technology cubes'
        }
        return undefined
    }

    // Whether to even offer DevelopPlanets as an option (targeting at least 1 Neutral Planet) -
    // used by the state handler's validActionsForPlayer.
    static canOfferDevelopPlanets(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        if (state.investorShenanigansCurrentPlayerId !== playerId) {
            return false
        }
        if (!canSelectAlienTechActionId(state, playerId, AlienTechActionId.DevelopPlanets)) {
            return false
        }
        if (state.getPlayerState(playerId).alienTechCubes < 1) {
            return false
        }
        return state.board
            .hexesOfType(HexType.NeutralPlanet)
            .some((hex) => !hex.valueDoubled)
    }
}
