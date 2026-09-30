import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from '@tabletop/common'
import { CompanyId } from '../data/companies.js'
import { RegionId } from '../data/regions.js'
import { MineToken } from '../data/mineTokens.js'
import { BoardBoxesById, BoardNodesById, BoxKind, NodeKind } from '../data/board.js'

export type MineSite = Type.Static<typeof MineSite>
export const MineSite = Type.Object({
    nodeId: Type.String(),
    token: Type.Optional(MineToken),
    ownerPlayerId: Type.Optional(Type.String()),
    empty: Type.Optional(Type.Boolean())
})

export type PlacedScourge = Type.Static<typeof PlacedScourge>
export const PlacedScourge = Type.Object({
    scourgeId: Type.String(),
    level: Type.Number(),
    hits: Type.Number()
})

export type BoardState = Type.Static<typeof BoardState>
export const BoardState = Type.Object({
    mines: Type.Record(Type.String(), MineSite),
    trackByBoxId: Type.Record(Type.String(), Type.Enum(CompanyId)),
    scourgesByRegion: Type.Record(Type.String(), Type.Array(PlacedScourge))
})

export const BoardStateValidator = Compile(BoardState)

export class HydratedBoardState extends Hydratable<typeof BoardState> implements BoardState {
    declare mines: Record<string, MineSite>
    declare trackByBoxId: Record<string, CompanyId>
    declare scourgesByRegion: Record<string, PlacedScourge[]>

    constructor(data: BoardState) {
        super(data, BoardStateValidator)
    }

    getMine(nodeId: string): MineSite {
        const mine = this.mines[nodeId]
        if (!mine) {
            throw Error(`No mine site at ${nodeId}`)
        }
        return mine
    }

    isMineFaceUp(nodeId: string): boolean {
        return this.getMine(nodeId).token !== undefined
    }

    scourgesIn(region: RegionId): PlacedScourge[] {
        return this.scourgesByRegion[region] ?? []
    }

    securityCostFor(region: RegionId): number {
        return this.scourgesIn(region).reduce((total, scourge) => total + scourge.level, 0)
    }

    companyAtBox(boxId: string): CompanyId | undefined {
        return this.trackByBoxId[boxId]
    }

    placeTrack(boxId: string, companyId: CompanyId) {
        const box = BoardBoxesById[boxId]
        if (!box) {
            throw Error(`Unknown box ${boxId}`)
        }
        if (box.kind === BoxKind.Water) {
            throw Error(`Box ${boxId} can never hold track`)
        }
        if (this.trackByBoxId[boxId]) {
            throw Error(`Box ${boxId} already has track`)
        }
        this.trackByBoxId[boxId] = companyId
    }

    mineTierAt(nodeId: string): NodeKind.MineA | NodeKind.MineB {
        const node = BoardNodesById[nodeId]
        if (!node || (node.kind !== NodeKind.MineA && node.kind !== NodeKind.MineB)) {
            throw Error(`${nodeId} is not a mine city`)
        }
        return node.kind
    }
}
