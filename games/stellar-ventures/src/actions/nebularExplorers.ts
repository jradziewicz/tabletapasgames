import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedStellarVenturesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CorporatePowerId } from '../model/corporation.js'
import { HexType } from '../model/board.js'
import { buildOutpostForCorporation, createWormholeCostForCorporation } from '../operations/network.js'

export type NebularExplorers = Type.Static<typeof NebularExplorers>
export const NebularExplorers = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.NebularExplorers),
            playerId: Type.String(),
            hexId: Type.String()
        })
    ])
)

export const NebularExplorersValidator = Compile(NebularExplorers)

export function isNebularExplorers(action?: GameAction): action is NebularExplorers {
    return action?.type === ActionType.NebularExplorers
}

/**
 * Nebular Explorers (Corporate Power Glossary, page 29): "Any Build, One-Time. May build an
 * Outpost on a Nebular Anomaly hex, placing a random unused Alien Planet tile beneath it and
 * treating it as an Alien Planet from then on (for every Corporation, not just this one) -
 * including being eligible to Sign The Agreement."
 *
 * HexType.Anomaly hexes are exactly the "Nebular Anomaly" hexes this targets - confirmed against
 * data/alphaBoard.ts, where HexType.Anomaly never sets hasSun (HexType.Sun is the other, distinct
 * form of red-bordered Anomaly, unaffected by this Power). "Any Build" is modeled as its own
 * dedicated build action (like Create Wormhole) rather than being threaded as a blanket permission
 * flag into the 4 existing build actions: unlike Icarus Experiment/Cloaking Devices (which lift a
 * restriction but change nothing else about the hex), this one-time conversion is a deliberate,
 * explicit choice the President makes, discarding the Power immediately after (One-Time) -
 * automatically converting the hex from a passive side effect of an ordinary build could trigger
 * even when a Corporation has, say, only Icarus Experiment (which permits building on the same
 * hex without any conversion at all).
 *
 * Cost mirrors Create Wormhole's (₮1 per hex skipped from the nearest existing Outpost, +₮4 flat,
 * +₮1 per other Corporation already present, minus Quantum Propulsion's discount if active - see
 * operations/network.ts's createWormholeCostForCorporation) since a Nebular Anomaly, like any
 * Wormhole target, isn't guaranteed to be adjacent to the Corporation's existing network. Unlike
 * Create Wormhole, this doesn't require active Wormhole Technology - it's a wholly separate
 * build mechanism granted by its own Power.
 *
 * The awarded tile comes from state.unusedAlienAgreementTileChevrons - the 3 of the 10 Alien
 * Agreement Tiles left over after Setup deals 1 to each of the 7 Alien Planet hexes (see
 * definition/initializer.ts), already shuffled into a fixed random order at that same Setup
 * shuffle; this simply takes the front one, exactly like state.corporatePowerDrawPileIds is drawn
 * from without any further runtime randomness. Deliberately does NOT call
 * operations/network.ts's awardAlienExplorersCubes: that Alien Tech Cube reward is specific to the
 * Alien Explorers Power's own text ("The player that builds the Outpost gains an Alien
 * Technology"), not a universal rule for building on any Alien Planet hex, and
 * awardAlienExplorersCubes' hex-type-only check would otherwise award a cube even to a Corporation
 * without Alien Explorers active.
 *
 * Offered alongside Alien Alchemist / Dismantling Outposts / Leaked Research during this
 * Corporation's Expand Network / Wormhole step - see stateHandlers/expandNetworkOrWormhole.ts,
 * which also detours to OfferSignTheAgreement afterward exactly like Expand Network/Create
 * Wormhole do (via its shared resolveAfterBuild), since the newly-converted hex may now make the
 * Corporation eligible to sign.
 */
export class HydratedNebularExplorers
    extends HydratableAction<typeof NebularExplorers>
    implements NebularExplorers
{
    declare type: ActionType.NebularExplorers
    declare playerId: string
    declare hexId: string

    constructor(data: NebularExplorers) {
        super(data, NebularExplorersValidator)
    }

    apply(state: HydratedStellarVenturesGameState, _context?: MachineContext) {
        const invalidReason = this.reasonNebularExplorersInvalid(state)
        if (invalidReason) {
            throw Error(invalidReason)
        }

        const corporationId = state.activeCorporationId
        assertExists(corporationId, 'Active corporation id should be present while using Nebular Explorers')
        const corporation = state.getCorporation(corporationId)

        const cost = createWormholeCostForCorporation(state, corporationId, this.hexId)
        assertExists(cost, 'Nebular Explorers cost should be computable while applying it')
        corporation.treasury -= cost

        const hex = state.board.requireHex(this.hexId)
        hex.type = HexType.AlienPlanet
        hex.alienAgreementTileHidden = true
        hex.alienAgreementTileChevrons = state.unusedAlienAgreementTileChevrons.shift()
        hex.alienAgreementTileRemoved = false

        buildOutpostForCorporation(state, this.hexId, corporationId)
        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.NebularExplorers
        )
    }

    isValidNebularExplorers(state: HydratedStellarVenturesGameState): boolean {
        return HydratedNebularExplorers.canNebularExplorers(state, this.playerId, this.hexId)
    }

    reasonNebularExplorersInvalid(state: HydratedStellarVenturesGameState): string | undefined {
        return HydratedNebularExplorers.reasonNebularExplorersInvalid(
            state,
            this.playerId,
            this.hexId
        )
    }

    static canNebularExplorers(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string
    ): boolean {
        return (
            HydratedNebularExplorers.reasonNebularExplorersInvalid(
                state,
                playerId,
                hexId
            ) === undefined
        )
    }

    static reasonNebularExplorersInvalid(
        state: HydratedStellarVenturesGameState,
        playerId: string,
        hexId: string
    ): string | undefined {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return 'No Corporation is currently active'
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return 'Only the President may use Nebular Explorers'
        }
        if (!corporation.hasActivePower(CorporatePowerId.NebularExplorers)) {
            return 'This Corporation does not have the Nebular Explorers Power'
        }
        if (state.unusedAlienAgreementTileChevrons.length === 0) {
            return 'No Alien Agreement Tiles remain to award'
        }
        const hex = state.board.getHex(hexId)
        if (!hex || hex.type !== HexType.Anomaly) {
            return 'That is not a Nebular Anomaly hex'
        }
        const cost = createWormholeCostForCorporation(state, corporationId, hexId)
        if (cost === undefined) {
            return 'Nebular Explorers cost could not be determined for that hex'
        }
        if (cost > corporation.treasury) {
            return 'Insufficient Funds'
        }
        return undefined
    }

    // Whether to even offer NebularExplorers as an option - used by the state handler's
    // validActionsForPlayer. Unlike Alien Alchemist (which needs no target), this needs at least
    // one currently-affordable Nebular Anomaly hex.
    static canOfferNebularExplorers(state: HydratedStellarVenturesGameState, playerId: string): boolean {
        const corporationId = state.activeCorporationId
        if (!corporationId) {
            return false
        }
        const corporation = state.getCorporation(corporationId)
        if (corporation.getPresidentPlayerId() !== playerId) {
            return false
        }
        if (!corporation.hasActivePower(CorporatePowerId.NebularExplorers)) {
            return false
        }
        if (state.unusedAlienAgreementTileChevrons.length === 0) {
            return false
        }
        return Object.values(state.board.hexes).some((hex) => {
            if (hex.type !== HexType.Anomaly) {
                return false
            }
            const cost = createWormholeCostForCorporation(state, corporationId, hex.id)
            return cost !== undefined && cost <= corporation.treasury
        })
    }
}
