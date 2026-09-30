import { BoardEdges, BoxKind, type BoardEdge } from '../data/board.js'
import { StatKind } from '../model/stats.js'
import { recordActionStat, recordStat } from './stats.js'
import { CardActionKind } from '../data/cards.js'
import { CompanyId, CompanyIds, MaxCubesPerCompany } from '../data/companies.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { remainingActionKinds } from './turn.js'

const EdgeByBoxId: Record<string, BoardEdge> = {}
for (const edge of BoardEdges) {
    for (const box of edge.boxes) {
        EdgeByBoxId[box.id] = edge
    }
}

export interface BuildableBox {
    boxId: string
    cost: number
}

function isCoveredBy(
    state: HydratedRockyVenturesGameState,
    boxId: string,
    companyId: CompanyId
): boolean {
    return state.board.companyAtBox(boxId) === companyId
}

function isEdgeCompleteFor(
    state: HydratedRockyVenturesGameState,
    edge: BoardEdge,
    companyId: CompanyId
): boolean {
    return edge.boxes.every((box) => isCoveredBy(state, box.id, companyId))
}

export function networkNodeIds(
    state: HydratedRockyVenturesGameState,
    companyId: CompanyId
): Set<string> {
    const nodes = new Set<string>()
    const startEdge = BoardEdges.find((edge) =>
        edge.boxes.some((box) => box.kind === BoxKind.Start && box.startingCompanyId === companyId)
    )
    if (!startEdge) {
        return nodes
    }
    nodes.add(startEdge.from)
    nodes.add(startEdge.to)
    let grew = true
    while (grew) {
        grew = false
        for (const edge of BoardEdges) {
            if (nodes.has(edge.from) === nodes.has(edge.to)) {
                continue
            }
            if (isEdgeCompleteFor(state, edge, companyId)) {
                nodes.add(edge.from)
                nodes.add(edge.to)
                grew = true
            }
        }
    }
    return nodes
}

function firstOpenBoxFromSide(
    state: HydratedRockyVenturesGameState,
    edge: BoardEdge,
    companyId: CompanyId,
    fromStart: boolean
) {
    const boxes = fromStart ? edge.boxes : [...edge.boxes].reverse()
    for (const box of boxes) {
        if (isCoveredBy(state, box.id, companyId)) {
            continue
        }
        if (box.kind === BoxKind.Water || state.board.companyAtBox(box.id) !== undefined) {
            return undefined
        }
        return box
    }
    return undefined
}

export function buildableBoxes(
    state: HydratedRockyVenturesGameState,
    companyId: CompanyId,
    free = false
): BuildableBox[] {
    const company = state.getCompany(companyId)
    if (company.cubesOnMap >= MaxCubesPerCompany) {
        return []
    }
    const nodes = networkNodeIds(state, companyId)
    const found = new Map<string, BuildableBox>()
    for (const edge of BoardEdges) {
        const sides: boolean[] = []
        if (nodes.has(edge.from)) sides.push(true)
        if (nodes.has(edge.to)) sides.push(false)
        for (const fromStart of sides) {
            const box = firstOpenBoxFromSide(state, edge, companyId, fromStart)
            if (box && (free || box.cost <= company.treasury)) {
                found.set(box.id, { boxId: box.id, cost: free ? 0 : box.cost })
            }
        }
    }
    return [...found.values()]
}

export interface LayTrackLimits {
    tracksLeft: number
    allowedCompanyIds: CompanyId[]
}

export function layTrackLimits(state: HydratedRockyVenturesGameState): LayTrackLimits {
    const tracksLeft = remainingActionKinds(state).filter(
        (kind) => kind === CardActionKind.LayTrack
    ).length
    if (tracksLeft === 0) {
        return { tracksLeft, allowedCompanyIds: [] }
    }
    const playerId = state.turnManager.currentTurn()?.playerId
    let maxCompanies = 1
    for (const action of playerId ? state.actionCardActions(playerId) : []) {
        if (action.kind === CardActionKind.LayTrack) {
            maxCompanies = action.maxCompanies
        }
    }
    const used = state.turnTrackCompanies
    const allowedCompanyIds =
        used.length >= maxCompanies ? CompanyIds.filter((id) => used.includes(id)) : [...CompanyIds]
    return { tracksLeft, allowedCompanyIds }
}

export function reasonLayTrackInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    companyId: CompanyId,
    boxId: string
): string | undefined {
    if (!state.activePlayerIds.includes(playerId)) {
        return 'It is not your turn'
    }
    const limits = layTrackLimits(state)
    if (limits.tracksLeft === 0) {
        return 'Lay Track is not available'
    }
    if (!limits.allowedCompanyIds.includes(companyId)) {
        return 'This card does not allow another company'
    }
    if (!EdgeByBoxId[boxId]) {
        return 'Unknown track box'
    }
    const buildable = buildableBoxes(state, companyId).find((candidate) => candidate.boxId === boxId)
    if (!buildable) {
        return 'Track cannot be laid there'
    }
    return undefined
}

export function anyBuildableBox(state: HydratedRockyVenturesGameState): boolean {
    const limits = layTrackLimits(state)
    return limits.allowedCompanyIds.some(
        (companyId) => buildableBoxes(state, companyId).length > 0
    )
}

export function layTrackAt(
    state: HydratedRockyVenturesGameState,
    companyId: CompanyId,
    boxId: string
) {
    const buildable = buildableBoxes(state, companyId).find((candidate) => candidate.boxId === boxId)
    if (!buildable) {
        throw Error('Track cannot be laid there')
    }
    placeTrackCube(state, companyId, boxId, buildable.cost)
    recordActionStat(state, state.turnManager.currentTurn()?.playerId ?? '', 'LayTrack')
    recordStat(state, {
        kind: StatKind.Track,
        playerId: state.turnManager.currentTurn()?.playerId ?? '',
        amount: buildable.cost,
        source: companyId,
        detail: boxId
    })
    state.turnActionsTaken.push(CardActionKind.LayTrack)
    if (!state.turnTrackCompanies.includes(companyId)) {
        state.turnTrackCompanies.push(companyId)
    }
}

function placeTrackCube(
    state: HydratedRockyVenturesGameState,
    companyId: CompanyId,
    boxId: string,
    cost: number
) {
    const edge = EdgeByBoxId[boxId]
    const box = edge?.boxes.find((candidate) => candidate.id === boxId)
    const company = state.getCompany(companyId)
    company.treasury -= cost
    company.cubesOnMap += 1
    state.board.placeTrack(boxId, companyId)
    if (box?.dornochDurConnection) {
        company.connectedToDornochDur = true
    }
}

export function layFreeTrackAt(state: HydratedRockyVenturesGameState, playerId: string, boxId: string) {
    const freeTrack = state.freeTrack
    if (!freeTrack) {
        throw Error('There is no free track to lay')
    }
    const companyId = freeTrack.companyId
    if (!buildableBoxes(state, companyId, true).some((candidate) => candidate.boxId === boxId)) {
        throw Error('Track cannot be laid there')
    }
    placeTrackCube(state, companyId, boxId, 0)
    recordStat(state, {
        kind: StatKind.Track,
        playerId,
        amount: 0,
        source: companyId,
        detail: boxId,
        agreement: freeTrack.agreement
    })
    freeTrack.remaining -= 1
    if (buildableBoxes(state, companyId, true).length === 0) {
        freeTrack.remaining = 0
    }
}
