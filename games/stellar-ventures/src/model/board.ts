import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from '@tabletop/common'
import { CorporationId } from './corporation.js'

export enum HexType {
    HomePlanet = 'homePlanet',
    NeutralPlanet = 'neutralPlanet',
    AlienPlanet = 'alienPlanet',
    MegaEarth = 'megaEarth',
    MiniEarth = 'miniEarth',
    DeepSpace = 'deepSpace',
    Sun = 'sun',
    Anomaly = 'anomaly'
}

export type HexCoordinate = Type.Static<typeof HexCoordinate>
export const HexCoordinate = Type.Object({
    q: Type.Number(),
    r: Type.Number()
})

// Axial hex coordinates. See https://www.redblobgames.com/grids/hexagons/ for the underlying math.
const HEX_NEIGHBOR_DIRECTIONS: HexCoordinate[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 }
]

export function hexIdForCoordinate(coordinate: HexCoordinate): string {
    return `${coordinate.q},${coordinate.r}`
}

export function neighborCoordinates(coordinate: HexCoordinate): HexCoordinate[] {
    return HEX_NEIGHBOR_DIRECTIONS.map((direction) => ({
        q: coordinate.q + direction.q,
        r: coordinate.r + direction.r
    }))
}

// Standard axial hex distance. See https://www.redblobgames.com/grids/hexagons/#distances-axial
export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
}

export type Hex = Type.Static<typeof Hex>
export const Hex = Type.Object({
    id: Type.String(),
    coordinate: HexCoordinate,
    type: Type.Enum(HexType),
    hasSun: Type.Optional(Type.Boolean()),
    baseValue: Type.Optional(Type.Number()),
    lowerValue: Type.Optional(Type.Number()),
    borderLevel: Type.Optional(Type.Number()),
    valueDoubled: Type.Optional(Type.Boolean()),
    homeCorporationId: Type.Optional(Type.Enum(CorporationId)),
    outposts: Type.Array(Type.Enum(CorporationId)),
    // Set up on every Alien Planet hex (7 on Alpha) - see StellarVenturesGameInitializer and
    // operations/agreement.ts. alienAgreementTileChevrons holds the tile's chevron count from
    // the moment of Setup (known internally the whole game, exactly like
    // ShipyardSectionState.alienTileChevrons), while alienAgreementTileHidden tracks whether it
    // has been revealed yet via Signing The Agreement (rulebook page 22).
    alienAgreementTileHidden: Type.Optional(Type.Boolean()),
    alienAgreementTileChevrons: Type.Optional(Type.Number()),
    // Once revealed via Signing The Agreement, the physical tile is taken off the hex entirely
    // and returned to the box - it doesn't just sit there face up (see
    // actions/signTheAgreement.ts, the only place this is ever set true). alienAgreementTileHidden
    // and alienAgreementTileChevrons are left as they were (still `false`/the real chevron count)
    // rather than cleared, since AgreementPanel's per-Corporation box still needs to know what was
    // revealed even after the physical tile itself is gone from the board - this flag is purely
    // about whether a tile is still physically present at this hex for board-rendering purposes.
    alienAgreementTileRemoved: Type.Optional(Type.Boolean()),
    alienShipyardTileHidden: Type.Optional(Type.Boolean())
})

export type MegaEarthState = Type.Static<typeof MegaEarthState>
export const MegaEarthState = Type.Object({
    // See MegaEarthValueTrack in data/alphaBoard.ts for the value ordering and worked example.
    // Its length also doubles as Mega-Earth's Corporation capacity (4).
    valueTrack: Type.Array(Type.Number()),
    // One entry per Corporation that has built an Outpost on Mega-Earth, in build order. Shared
    // across all 3 of Mega-Earth's physical hexes, which are treated as a single hex for every
    // game purpose (max 1 entry per Corporation; length capped at valueTrack.length).
    fillOrder: Type.Array(Type.Enum(CorporationId))
})

export type BoardState = Type.Static<typeof BoardState>
export const BoardState = Type.Object({
    hexes: Type.Record(Type.String(), Hex),
    megaEarth: MegaEarthState,
    miniEarth: Type.Optional(MegaEarthState),
    closedBorderLevels: Type.Optional(Type.Array(Type.Number()))
})

export const BoardStateValidator = Compile(BoardState)

export class HydratedBoardState extends Hydratable<typeof BoardState> implements BoardState {
    declare hexes: Record<string, Hex>
    declare megaEarth: MegaEarthState
    declare miniEarth?: MegaEarthState
    declare closedBorderLevels?: number[]

    constructor(data: BoardState) {
        super(data, BoardStateValidator)
    }

    getHex(id: string): Hex | undefined {
        return this.hexes[id]
    }

    requireHex(id: string): Hex {
        const hex = this.hexes[id]
        if (!hex) {
            throw Error(`No hex found with id ${id}`)
        }
        return hex
    }

    isAdjacent(hexIdA: string, hexIdB: string): boolean {
        const hexA = this.hexes[hexIdA]
        if (!hexA) {
            return false
        }
        return neighborCoordinates(hexA.coordinate).some(
            (coordinate) => hexIdForCoordinate(coordinate) === hexIdB
        )
    }

    currentValue(hex: Hex): number {
        return this.developedValue(hex, this.printedValueForOutpostCount(hex, hex.outposts.length))
    }

    // Borders & Taxes: a two-value Neutral Planet is worth its lower value to every Corporation
    // present once a 2nd Outpost is built there.
    private printedValueForOutpostCount(hex: Hex, outpostCount: number): number {
        if (hex.lowerValue !== undefined && outpostCount >= 2) {
            return hex.lowerValue
        }
        return hex.baseValue ?? 0
    }

    private developedValue(hex: Hex, value: number): number {
        return hex.valueDoubled ? value * 2 : value
    }

    sharedValueTrackForHex(hex: Hex): MegaEarthState | undefined {
        if (hex.type === HexType.MegaEarth) {
            return this.megaEarth
        }
        if (hex.type === HexType.MiniEarth) {
            return this.miniEarth
        }
        return undefined
    }

    private sharedValueTrackValue(track: MegaEarthState, filledSlots: number): number {
        return track.valueTrack[filledSlots - 1] ?? 0
    }

    miningValueForHex(hex: Hex): number {
        const track = this.sharedValueTrackForHex(hex)
        if (track) {
            return this.sharedValueTrackValue(track, track.fillOrder.length)
        }
        return this.currentValue(hex)
    }

    miningValueAfterNextOutpost(hex: Hex): number {
        const track = this.sharedValueTrackForHex(hex)
        if (track) {
            return this.sharedValueTrackValue(track, track.fillOrder.length + 1)
        }
        return this.developedValue(
            hex,
            this.printedValueForOutpostCount(hex, hex.outposts.length + 1)
        )
    }

    // The shared Mining Capacity value contributed by Mega-Earth to every Corporation with an
    // Outpost there right now - see MegaEarthValueTrack in data/alphaBoard.ts. Indexed by
    // (total Outposts present) - 1, since the value only exists once at least one has been built.
    currentMegaEarthValue(): number {
        return this.sharedValueTrackValue(this.megaEarth, this.megaEarth.fillOrder.length)
    }

    outpostCountInHex(hexId: string): number {
        return this.hexes[hexId]?.outposts.length ?? 0
    }

    hasOutpost(hexId: string, corporationId: CorporationId): boolean {
        return this.hexes[hexId]?.outposts.includes(corporationId) ?? false
    }

    hasOutpostOnMegaEarth(corporationId: CorporationId): boolean {
        return this.megaEarth.fillOrder.includes(corporationId)
    }

    buildOutpost(hexId: string, corporationId: CorporationId) {
        const hex = this.requireHex(hexId)
        if (hex.outposts.includes(corporationId)) {
            throw Error(`Corporation ${corporationId} already has an outpost on hex ${hexId}`)
        }
        hex.outposts.push(corporationId)
        this.sharedValueTrackForHex(hex)?.fillOrder.push(corporationId)
    }

    removeOutpost(hexId: string, corporationId: CorporationId) {
        const hex = this.requireHex(hexId)
        if (!hex.outposts.includes(corporationId)) {
            throw Error(`Corporation ${corporationId} has no outpost on hex ${hexId} to remove`)
        }
        hex.outposts = hex.outposts.filter((id) => id !== corporationId)
        const track = this.sharedValueTrackForHex(hex)
        if (track) {
            track.fillOrder = track.fillOrder.filter((id) => id !== corporationId)
        }
    }

    miningCapacityForCorporation(corporationId: CorporationId): number {
        let total = 0
        for (const hex of Object.values(this.hexes)) {
            if (!hex.outposts.includes(corporationId)) {
                continue
            }
            total += this.miningValueForHex(hex)
        }
        return total
    }

    hexesOfType(type: HexType): Hex[] {
        return Object.values(this.hexes).filter((hex) => hex.type === type)
    }

    // The Outpost Restrictions that apply to every build, whether from Expand Network or Create
    // Wormhole (rulebook page 15, "Outpost Restrictions (Applies to All Builds)"):
    //   1. Max 1 Outpost per Corporation per hex of any type.
    //   2. Max 2 Outposts per Deep Space / Neutral Planet hex.
    //   3. No Outposts from other Corporations on Home Planets.
    //   4. No Outposts on red-bordered Anomalies.
    //   5. No Outposts if space is unavailable on Mega-Earth (max 4 Corporations).
    //   6. Alien Planets require a Corporate Power - the caller passes canBuildOnAlienPlanets
    //      (true once the Corporation has an active Power that grants this, e.g. Alien Explorers
    //      - see model/corporation.ts's CorporatePowerId and operations/network.ts).
    // Suns are themselves a form of red-bordered Anomaly (hence the "with a Sun" vs. Nebular
    // Anomaly art variants), confirmed by the rulebook co-designer, even though HexType.Sun is
    // its own distinct value in this data model. Icarus Experiment ("Ignore the restriction
    // against building on Suns and Anomalies", Glossary page 29) lifts this specific
    // restriction for its Corporation - the caller passes canBuildOnSunAnomalies (true once the
    // Corporation has that Power active - see operations/network.ts). Cloaking Devices ("May
    // build Outposts on Deep Space hexes ignoring Outpost Restrictions and Placement Penalties",
    // Glossary page 29) similarly lifts Deep Space's own max-2-Outposts-per-hex cap for its
    // Corporation - the caller passes ignoresDeepSpaceOutpostCap (see operations/network.ts).
    // Cloaking Devices doesn't touch restriction #1 (max 1 of THIS Corporation's own Outposts per
    // hex, checked below regardless) - only the max-2-total cap that otherwise applies to Deep
    // Space (and, unaffected by this Power, Neutral Planet) hexes. Nebular Explorers ("Any Build,
    // One-Time. May build an Outpost on a Nebular Anomaly hex...", Glossary page 29) similarly
    // lifts this restriction for a plain Anomaly ONLY (never a true Sun) - the caller passes
    // canBuildOnNebulaAnomaly (true once the Corporation has that Power active AND at least 1
    // unused Alien Planet tile remains to award - see operations/network.ts's
    // canBuildOnNebulaAnomalyForCorporation). Unlike Icarus Experiment, which is Ongoing and
    // changes nothing else about the hex, this build also converts the hex to an Alien Planet
    // and discards the Power - see operations/network.ts's resolveNebularAnomalyReveal, called
    // by each of the 4 build actions right after this check passes.
    canBuildOutpost(
        hexId: string,
        corporationId: CorporationId,
        canBuildOnAlienPlanets = false,
        canBuildOnSunAnomalies = false,
        ignoresDeepSpaceOutpostCap = false,
        canBuildOnNebulaAnomaly = false
    ): boolean {
        const hex = this.hexes[hexId]
        if (!hex) {
            return false
        }

        const track = this.sharedValueTrackForHex(hex)
        if (track) {
            if (track.fillOrder.includes(corporationId)) {
                return false
            }
            return track.fillOrder.length < track.valueTrack.length
        }

        if (hex.outposts.includes(corporationId)) {
            return false
        }

        switch (hex.type) {
            case HexType.Sun:
                return canBuildOnSunAnomalies
            case HexType.Anomaly:
                // A plain (non-Sun) Anomaly is also a Nebular Anomaly - buildable either via
                // Icarus Experiment (canBuildOnSunAnomalies, which lifts the restriction for
                // BOTH Sun and Anomaly alike) or via Nebular Explorers specifically
                // (canBuildOnNebulaAnomaly - see operations/network.ts's
                // canBuildOnNebulaAnomalyForCorporation), which only ever applies to this case,
                // never to a true Sun.
                return canBuildOnSunAnomalies || canBuildOnNebulaAnomaly
            case HexType.AlienPlanet:
                return canBuildOnAlienPlanets
            case HexType.HomePlanet:
                return hex.homeCorporationId === corporationId
            case HexType.DeepSpace:
                return ignoresDeepSpaceOutpostCap || hex.outposts.length < 2
            case HexType.NeutralPlanet:
                return hex.outposts.length < 2
            default:
                return false
        }
    }

    // Other Corporations' Outposts already present at a build target, for the ₮1-per-Corporation
    // placement penalty charged by both Expand Network and Create Wormhole. Mega-Earth shares one
    // pool of Outposts across its 3 physical hexes (see buildOutpost), so it uses fillOrder rather
    // than the specific physical hex's own outposts array.
    otherCorporationOutpostCount(hexId: string): number {
        const hex = this.requireHex(hexId)
        return this.sharedValueTrackForHex(hex)?.fillOrder.length ?? hex.outposts.length
    }

    // The fewest hexes between the given hex and the nearest Outpost this Corporation already
    // has anywhere on the board - used for Create Wormhole's cost. Undefined only if the
    // Corporation has no Outposts at all (shouldn't happen once Setup has placed its Home
    // Planet Outpost).
    distanceToNearestOutpost(hexId: string, corporationId: CorporationId): number | undefined {
        const target = this.requireHex(hexId)
        let nearest: number | undefined
        for (const hex of Object.values(this.hexes)) {
            if (!hex.outposts.includes(corporationId)) {
                continue
            }
            const distance = hexDistance(target.coordinate, hex.coordinate)
            if (nearest === undefined || distance < nearest) {
                nearest = distance
            }
        }
        return nearest
    }

    // True if any neighboring hex already has an Outpost belonging to this Corporation - used by
    // Expand Network to validate that each newly-built Outpost chains off the existing network
    // (or off another Outpost being built in the same action - see operations/network.ts).
    isAdjacentToOutpost(hexId: string, corporationId: CorporationId): boolean {
        const hex = this.requireHex(hexId)
        return neighborCoordinates(hex.coordinate).some((coordinate) => {
            const neighborHex = this.hexes[hexIdForCoordinate(coordinate)]
            return (
                !!neighborHex &&
                neighborHex.outposts.includes(corporationId) &&
                !this.crossesClosedBorder(hex, neighborHex)
            )
        })
    }

    isBuildAdjacent(hexIdA: string, hexIdB: string): boolean {
        const hexB = this.hexes[hexIdB]
        return (
            !!hexB &&
            this.isAdjacent(hexIdA, hexIdB) &&
            !this.crossesClosedBorder(this.requireHex(hexIdA), hexB)
        )
    }

    isInsideBorder(hex: Hex, borderLevel: number): boolean {
        return (hex.borderLevel ?? 0) >= borderLevel
    }

    isBorderClosed(borderLevel: number): boolean {
        return this.closedBorderLevels?.includes(borderLevel) ?? false
    }

    closeBorder(borderLevel: number) {
        if (this.isBorderClosed(borderLevel)) {
            return
        }
        this.closedBorderLevels = [...(this.closedBorderLevels ?? []), borderLevel].sort(
            (a, b) => a - b
        )
    }

    crossesClosedBorder(hexA: Hex, hexB: Hex): boolean {
        return (this.closedBorderLevels ?? []).some(
            (borderLevel) =>
                this.isInsideBorder(hexA, borderLevel) !== this.isInsideBorder(hexB, borderLevel)
        )
    }

    highestBorderLevelWithOutpost(corporationId: CorporationId): number {
        let highest = 0
        for (const hex of Object.values(this.hexes)) {
            if (hex.outposts.includes(corporationId)) {
                highest = Math.max(highest, hex.borderLevel ?? 0)
            }
        }
        return highest
    }
}
