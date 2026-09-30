import { Prng } from '@tabletop/common'
import {
    BoardBoxesById,
    BoardEdges,
    BoardNodesById,
    DeliveryCityId,
    MineNodeIds
} from '../data/board.js'
import {
    AgreementGoldOreBonus,
    AgreementLetter,
    AgreementPointBuyCost,
    AgreementSilverOreBonus,
    AgreementTransportDiscount
} from '../data/agreements.js'
import { CardActionKind, type ExtractAndSellCardAction } from '../data/cards.js'
import { CompanyId, CompanyIds } from '../data/companies.js'
import { MineTier, OreKind } from '../data/mineTokens.js'
import { DragonSecurityCost } from '../data/scourges.js'
import { NorthernRegionIds, RegionIds } from '../data/regions.js'
import { OreCapacityByToolLevel } from '../data/toolWeaponGrid.js'
import { StatKind } from '../model/stats.js'
import { recordActionStat, recordCash, recordStat } from './stats.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { drawMineToken, mineTierForNode } from './mines.js'
import { addScourgeToRegion } from './scourges.js'
import { remainingActionKinds } from './turn.js'

export interface ExtractionRequest {
    nodeId: string
    cityId?: DeliveryCityId
    creditCompanyId?: CompanyId
    routeNodeIds?: string[]
}

export interface ExtractionPlan {
    nodeId: string
    ore: OreKind
    oreCount: number
    price: number
    sale: number
    agreementBonus: number
    transport: number
    security: number
    dragon: number
    discount: number
    net: number
    routeNodeIds: string[]
    regionIds: string[]
    creditCandidates: CompanyId[]
    creditCompanyId?: CompanyId
    saleCityId: DeliveryCityId
    canBuyVictoryPoints: boolean
}

export function currentExtractAction(
    state: HydratedRockyVenturesGameState,
    playerId: string
): ExtractAndSellCardAction | undefined {
    return state.actionCardActions(playerId).find(
        (action): action is ExtractAndSellCardAction => action.kind === CardActionKind.ExtractAndSell
    )
}

function citySideOfRegion(regionId: string): DeliveryCityId {
    return NorthernRegionIds.some((north) => north === regionId)
        ? DeliveryCityId.Dornoch
        : DeliveryCityId.Manor
}

function holdsAgreement(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    cityId: DeliveryCityId,
    letter: AgreementLetter
): boolean {
    return state
        .getPlayerState(playerId)
        .agreements.some((agreement) => agreement.cityId === cityId && agreement.letter === letter)
}

export function extractableMineIds(
    state: HydratedRockyVenturesGameState,
    playerId: string
): string[] {
    if (!state.activePlayerIds.includes(playerId)) {
        return []
    }
    if (!remainingActionKinds(state).includes(CardActionKind.ExtractAndSell)) {
        return []
    }
    return MineNodeIds.filter((nodeId) => {
        const site = state.board.getMine(nodeId)
        return site.ownerPlayerId === playerId && site.token !== undefined
    })
}

export function oreExtracted(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    nodeId: string
): number {
    const token = state.board.getMine(nodeId).token
    const action = currentExtractAction(state, playerId)
    if (!token || !action) {
        return 0
    }
    const player = state.getPlayerState(playerId)
    const capacity = OreCapacityByToolLevel[player.toolLevel]
    const base = token.ore === OreKind.Gold ? capacity?.gold ?? 0 : capacity?.silver ?? 0
    return Math.min(token.level, base + action.temporaryToolLevels) + action.bonusOre
}

export interface RouteResult {
    nodeIds: string[]
    transport: number
    security: number
    dragon: number
    discount: number
    regionMask: number
    cubes: Partial<Record<CompanyId, number>>
}

interface Step {
    node: string
    mask: number
    cost: number
    previous?: Step
    boxIds: string[]
}

function regionBit(regionId: string): number {
    return 1 << RegionIds.findIndex((candidate) => candidate === regionId)
}

function edgeTransport(state: HydratedRockyVenturesGameState, boxIds: string[]): number {
    return boxIds.reduce((total, boxId) => {
        const box = BoardBoxesById[boxId]
        return total + (state.board.companyAtBox(boxId) ? 1 : (box?.cost ?? 0))
    }, 0)
}

function securityForMask(
    state: HydratedRockyVenturesGameState,
    mask: number,
    disregard: number
): number {
    let total = 0
    let highest = 0
    for (const regionId of RegionIds) {
        if ((mask & regionBit(regionId)) === 0) {
            continue
        }
        total += state.board.securityCostFor(regionId)
        for (const scourge of state.board.scourgesIn(regionId)) {
            highest = Math.max(highest, scourge.level)
        }
    }
    return Math.max(0, total - (disregard > 0 ? highest : 0))
}

export function bestRoute(
    state: HydratedRockyVenturesGameState,
    fromNodeId: string,
    cityId: DeliveryCityId,
    disregard: number,
    hasDiscount: boolean
): RouteResult | undefined {
    const startNode = BoardNodesById[fromNodeId]
    if (!startNode) {
        return undefined
    }
    const best = new Map<string, Step>()
    const key = (node: string, mask: number) => `${node}|${mask}`
    const first: Step = { node: fromNodeId, mask: regionBit(startNode.region), cost: 0, boxIds: [] }
    best.set(key(first.node, first.mask), first)
    const frontier: Step[] = [first]
    while (frontier.length > 0) {
        frontier.sort((a, b) => a.cost - b.cost)
        const step = frontier.shift()!
        if (best.get(key(step.node, step.mask)) !== step) {
            continue
        }
        for (const edge of BoardEdges) {
            const other =
                edge.from === step.node ? edge.to : edge.to === step.node ? edge.from : undefined
            if (other === undefined) {
                continue
            }
            const otherNode = BoardNodesById[other]
            if (!otherNode) {
                continue
            }
            const mask = step.mask | regionBit(otherNode.region)
            const boxIds = edge.boxes.map((box) => box.id)
            const cost = step.cost + edgeTransport(state, boxIds)
            const existing = best.get(key(other, mask))
            if (existing && existing.cost <= cost) {
                continue
            }
            const next: Step = { node: other, mask, cost, previous: step, boxIds }
            best.set(key(other, mask), next)
            frontier.push(next)
        }
    }
    const dragon =
        state.dragon.summoned && !state.dragon.killed ? DragonSecurityCost : 0
    let chosen: RouteResult | undefined
    let chosenTotal = Infinity
    for (const step of best.values()) {
        if (step.node !== cityId) {
            continue
        }
        const security = securityForMask(state, step.mask, disregard)
        const gross = step.cost + security + dragon
        const discount = hasDiscount ? Math.min(AgreementTransportDiscount, gross) : 0
        const total = gross - discount
        if (total >= chosenTotal) {
            continue
        }
        const nodeIds: string[] = []
        const cubes: Partial<Record<CompanyId, number>> = {}
        for (let walk: Step | undefined = step; walk; walk = walk.previous) {
            nodeIds.unshift(walk.node)
            for (const boxId of walk.boxIds) {
                const companyId = state.board.companyAtBox(boxId)
                if (companyId) {
                    cubes[companyId] = (cubes[companyId] ?? 0) + 1
                }
            }
        }
        chosenTotal = total
        chosen = {
            nodeIds,
            transport: step.cost,
            security,
            dragon,
            discount,
            regionMask: step.mask,
            cubes
        }
    }
    return chosen
}

export function routeNeighbors(nodeId: string): string[] {
    const neighbors: string[] = []
    for (const edge of BoardEdges) {
        const other = edge.from === nodeId ? edge.to : edge.to === nodeId ? edge.from : undefined
        if (other !== undefined && !neighbors.includes(other)) {
            neighbors.push(other)
        }
    }
    return neighbors
}

export function evaluateRoute(
    state: HydratedRockyVenturesGameState,
    nodeIds: string[],
    cityId: DeliveryCityId,
    disregard: number,
    hasDiscount: boolean
): RouteResult | string {
    if (nodeIds.length < 2 || nodeIds.at(-1) !== cityId) {
        return 'The route must end at the city you sell to'
    }
    if (new Set(nodeIds).size !== nodeIds.length) {
        return 'A route cannot visit the same place twice'
    }
    let transport = 0
    let mask = 0
    const cubes: Partial<Record<CompanyId, number>> = {}
    for (const [index, nodeId] of nodeIds.entries()) {
        const node = BoardNodesById[nodeId]
        if (!node) {
            return 'That route leaves the map'
        }
        mask |= regionBit(node.region)
        const next = nodeIds[index + 1]
        if (next === undefined) {
            continue
        }
        const edges = BoardEdges.filter(
            (edge) => (edge.from === nodeId && edge.to === next) || (edge.to === nodeId && edge.from === next)
        )
        if (edges.length === 0) {
            return 'Each step of the route must follow a rail line'
        }
        const cheapest = edges
            .map((edge) => edge.boxes.map((box) => box.id))
            .sort((left, right) => edgeTransport(state, left) - edgeTransport(state, right))[0]!
        transport += edgeTransport(state, cheapest)
        for (const boxId of cheapest) {
            const companyId = state.board.companyAtBox(boxId)
            if (companyId) {
                cubes[companyId] = (cubes[companyId] ?? 0) + 1
            }
        }
    }
    const security = securityForMask(state, mask, disregard)
    const dragon = state.dragon.summoned && !state.dragon.killed ? DragonSecurityCost : 0
    const gross = transport + security + dragon
    const discount = hasDiscount ? Math.min(AgreementTransportDiscount, gross) : 0
    return { nodeIds, transport, security, dragon, discount, regionMask: mask, cubes }
}

export function planExtraction(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    request: ExtractionRequest
): ExtractionPlan | string {
    if (!state.activePlayerIds.includes(playerId)) {
        return 'It is not your turn'
    }
    const action = currentExtractAction(state, playerId)
    if (!action || !remainingActionKinds(state).includes(CardActionKind.ExtractAndSell)) {
        return 'Extract & Sell is not available on this card'
    }
    if (!MineNodeIds.includes(request.nodeId)) {
        return 'That is not a mine'
    }
    const site = state.board.getMine(request.nodeId)
    const token = site.token
    if (site.ownerPlayerId !== playerId || !token) {
        return 'You can only extract from a mine you have claimed'
    }
    const node = BoardNodesById[request.nodeId]!
    const oreCount = oreExtracted(state, playerId, request.nodeId)
    let plan: ExtractionPlan
    if (token.ore === OreKind.Gold) {
        const cityId = request.cityId
        if (cityId === undefined) {
            return 'Choose Dornoch or Manor to sell the gold to'
        }
        const price = state.goldPriceFor(cityId)
        const agreementBonus = holdsAgreement(state, playerId, cityId, AgreementLetter.A)
            ? AgreementGoldOreBonus * oreCount
            : 0
        const hasDiscount = holdsAgreement(state, playerId, cityId, AgreementLetter.C)
        const route = request.routeNodeIds
            ? request.routeNodeIds[0] === request.nodeId
                ? evaluateRoute(state, request.routeNodeIds, cityId, action.disregardScourges, hasDiscount)
                : 'The route must start at the mine'
            : bestRoute(state, request.nodeId, cityId, action.disregardScourges, hasDiscount)
        if (!route) {
            return 'No route to that city'
        }
        if (typeof route === 'string') {
            return route
        }
        const candidates = creditCandidatesFor(route.cubes)
        const sale = price * oreCount
        plan = {
            nodeId: request.nodeId,
            ore: OreKind.Gold,
            oreCount,
            price,
            sale,
            agreementBonus,
            transport: route.transport,
            security: route.security,
            dragon: route.dragon,
            discount: route.discount,
            net: Math.max(
                0,
                sale + agreementBonus - route.transport - route.security - route.dragon + route.discount
            ),
            routeNodeIds: route.nodeIds,
            regionIds: RegionIds.filter((regionId) => (route.regionMask & regionBit(regionId)) !== 0),
            creditCandidates: candidates,
            creditCompanyId: undefined,
            saleCityId: cityId,
            canBuyVictoryPoints: false
        }
        if (candidates.length === 1) {
            plan.creditCompanyId = candidates[0]
        } else if (candidates.length > 1) {
            if (request.creditCompanyId === undefined) {
                plan.creditCompanyId = undefined
            } else if (candidates.includes(request.creditCompanyId)) {
                plan.creditCompanyId = request.creditCompanyId
            } else {
                return 'That company did not lay the most track on the route'
            }
        }
    } else {
        const cityId = citySideOfRegion(node.region)
        const price = state.silverPrice
        const agreementBonus = holdsAgreement(state, playerId, cityId, AgreementLetter.B)
            ? AgreementSilverOreBonus * oreCount
            : 0
        const dragon = state.dragon.summoned && !state.dragon.killed ? DragonSecurityCost : 0
        const sale = price * oreCount
        plan = {
            nodeId: request.nodeId,
            ore: OreKind.Silver,
            oreCount,
            price,
            sale,
            agreementBonus,
            transport: 0,
            security: 0,
            dragon,
            discount: 0,
            net: Math.max(0, sale + agreementBonus - dragon),
            routeNodeIds: [],
            regionIds: [],
            creditCandidates: [],
            saleCityId: cityId,
            canBuyVictoryPoints: false
        }
    }
    plan.canBuyVictoryPoints =
        holdsAgreement(state, playerId, plan.saleCityId, AgreementLetter.D) &&
        plan.net >= AgreementPointBuyCost
    return plan
}

function creditCandidatesFor(cubes: Partial<Record<CompanyId, number>>): CompanyId[] {
    return CompanyIds.filter((companyId) => (cubes[companyId] ?? 0) > 0).sort(
        (left, right) => (cubes[right] ?? 0) - (cubes[left] ?? 0)
    )
}

export function reasonExtractInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    request: ExtractionRequest
): string | undefined {
    const plan = planExtraction(state, playerId, request)
    if (typeof plan === 'string') {
        return plan
    }
    if (plan.creditCandidates.length > 1 && plan.creditCompanyId === undefined) {
        return 'Choose which railroad gets the delivery'
    }
    return undefined
}

export function extractAndSellAt(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    request: ExtractionRequest
) {
    const plan = planExtraction(state, playerId, request)
    if (typeof plan === 'string') {
        throw Error(plan)
    }
    const player = state.getPlayerState(playerId)
    const action = currentExtractAction(state, playerId)
    const site = state.board.getMine(request.nodeId)
    const node = BoardNodesById[request.nodeId]!
    const random = new Prng(state.prng).random
    player.money += plan.net
    recordActionStat(state, playerId, 'ExtractAndSell')
    recordStat(state, {
        kind: StatKind.MineExtract,
        playerId,
        amount: plan.net,
        source: plan.ore,
        nodeId: request.nodeId,
        detail: `level=${site.token?.level ?? 0};ore=${plan.oreCount};sale=${plan.sale};city=${plan.saleCityId}`
    })
    recordCash(state, playerId, plan.net, 'extract', { nodeId: request.nodeId })
    const bonusLetter = plan.ore === OreKind.Gold ? AgreementLetter.A : AgreementLetter.B
    recordCash(state, playerId, plan.agreementBonus, 'agreement', {
        agreement: `${plan.saleCityId}-${bonusLetter}`,
        nodeId: request.nodeId
    })
    recordCash(state, playerId, plan.discount, 'agreement', {
        agreement: `${plan.saleCityId}-${AgreementLetter.C}`,
        nodeId: request.nodeId
    })
    if (plan.canBuyVictoryPoints) {
        state.pendingAgreementBuy = { cityId: plan.saleCityId, income: plan.net }
    }
    const goldToken = site.token!
    if (plan.ore === OreKind.Gold) {
        if (plan.creditCompanyId) {
            state.getCompany(plan.creditCompanyId).deliveredMineTokenIds.push(goldToken.id)
        }
        const tier: MineTier = mineTierForNode(request.nodeId)
        const silver = drawMineToken(state, OreKind.Silver, tier)
        if (silver) {
            site.token = silver
            if (silver.scourge) {
                addScourgeToRegion(state, node.region, random)
            }
        } else {
            emptyMine(state, playerId, request.nodeId)
        }
    } else {
        emptyMine(state, playerId, request.nodeId)
    }
    if (action?.addsScourge) {
        addScourgeToRegion(state, node.region, random)
    }
    state.turnActionsTaken.push(CardActionKind.ExtractAndSell)
}

function emptyMine(state: HydratedRockyVenturesGameState, playerId: string, nodeId: string) {
    const site = state.board.getMine(nodeId)
    delete site.token
    delete site.ownerPlayerId
    site.empty = true
    state.getPlayerState(playerId).claimTokens += 1
}
