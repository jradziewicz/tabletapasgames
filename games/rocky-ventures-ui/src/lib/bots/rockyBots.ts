import {
    ActionType,
    BoardBoxLocations,
    CardBonusKind,
    CardKind,
    MachineState,
    WeaponTokenKind,
    acquireChoices,
    bestRoute,
    buildableBoxes,
    claimCost,
    claimableMineIds,
    extractableMineIds,
    getCard,
    huntTargets,
    huntableRegions,
    investCost,
    isDiscardable,
    isDrawPileAtGameOver,
    layTrackLimits,
    planAcquire,
    planExtraction,
    reasonExtractInvalid,
    reasonGemActionInvalid,
    reasonHuntInvalid,
    reasonPawnMoveInvalid,
    skippedIndexes,
    DeliveryCityId,
    PawnSkipCost,
    type AcquireChoice,
    type CardAction,
    type CompanyId,
    type HydratedRockyVenturesGameState,
    type HydratedRockyVenturesPlayerState
} from '@tabletop/rocky-ventures'

export enum BotProfile {
    Hunter = 'hunter',
    Tax = 'tax'
}

export const BotProfileNames: Record<BotProfile, string> = {
    [BotProfile.Hunter]: 'Hunter bot',
    [BotProfile.Tax]: 'Tax bot'
}

export type BotMove =
    | { type: ActionType.MovePawn; targetIndex: number; discardIndexes: number[] }
    | { type: ActionType.Tax }
    | { type: ActionType.Invest; slotIndex: number }
    | { type: ActionType.SkipBonusInvest }
    | { type: ActionType.ClaimMine; nodeId: string }
    | { type: ActionType.LayTrack; companyId: CompanyId; boxId: string }
    | { type: ActionType.ExtractAndSell; nodeId: string; cityId?: DeliveryCityId; creditCompanyId?: CompanyId }
    | { type: ActionType.Hunt; region: string }
    | { type: ActionType.ResolveHunt; tokenIndexes: number[]; hitTargets: string[] }
    | { type: ActionType.Acquire; choice: AcquireChoice }
    | { type: ActionType.ChooseShare; companyId: CompanyId }
    | { type: ActionType.PointBuy; bundles: number; convertShare?: { companyId: CompanyId; shareIndex: number } }
    | { type: ActionType.AgreementPointBuy; buy: boolean }
    | { type: ActionType.LayFreeTrack; boxId?: string }
    | { type: ActionType.GemAction; kind: 'repeat' | 'market' | 'swap' | 'movePawn'; target: number }
    | { type: ActionType.EndTurn }

type Weights = Record<string, number>

const ProfileWeights: Record<BotProfile, Weights> = {
    [BotProfile.Hunter]: { hunt: 10, acquire: 8, claimMine: 4, extractAndSell: 3, layTrack: 1, invest: 6, tax: 1 },
    [BotProfile.Tax]: { tax: 10, acquire: 9 }
}

function cardActions(cardId: string): CardAction[] {
    const card = getCard(cardId)
    return card.kind === CardKind.Player || card.kind === CardKind.Development ? card.actions : []
}

function actionStrength(action: CardAction): number {
    switch (action.kind) {
        case 'claimMine':
            return action.mines * 10 + action.regionalHunts * 3 + (action.levelTwoMinesFree ? 1 : 0)
        case 'layTrack':
            return action.maxTracks * 10 + action.maxCompanies
        case 'hunt':
            return action.hunts * 10
        case 'acquire':
            return action.levels * 10 + (action.mode === 'oneToolAndOneWeapon' ? 5 : 0)
        case 'extractAndSell':
            return 10 + action.bonusOre * 3 + action.temporaryToolLevels * 2 + action.disregardScourges * 2
        default:
            return 1
    }
}

function isDominated(player: HydratedRockyVenturesPlayerState, index: number): boolean {
    const cardId = player.tableau[index]
    if (cardId === undefined || !isDiscardable(player, index)) {
        return false
    }
    const own = cardActions(cardId)
    if (own.length === 0) {
        return false
    }
    return own.every((action) =>
        player.tableau.some(
            (other, otherIndex) =>
                otherIndex !== index &&
                isDiscardable(player, otherIndex) &&
                cardActions(other).some(
                    (candidate) => candidate.kind === action.kind && actionStrength(candidate) > actionStrength(action)
                )
        )
    )
}

function ownedMines(state: HydratedRockyVenturesGameState, playerId: string) {
    return Object.values(state.board.mines).filter((site) => site.ownerPlayerId === playerId && site.token)
}

function feasibility(state: HydratedRockyVenturesGameState, player: HydratedRockyVenturesPlayerState): Weights {
    const openMines = Object.values(state.board.mines).filter((site) => !site.ownerPlayerId && site.token && !site.empty)
    const owned = ownedMines(state, player.playerId).length
    const affordable = state.market.slots.some((_, slot) => {
        const cost = investCost(state, slot)
        return cost !== undefined && cost <= player.money
    })
    return {
        extractAndSell: owned > 0 ? 1 + owned * 0.3 : 0,
        claimMine: player.claimTokens > 0 && openMines.length > 0 && player.money >= 2 ? 1 : 0,
        hunt: huntableRegions(state).length > 0 ? 1 + player.weaponLevel * 0.2 : 0,
        invest: affordable ? 1 : 0,
        tax: state.market.slots.length > 0 ? 1 : 0,
        layTrack: owned > 0 ? 1 : 0.3
    }
}

function cardValue(state: HydratedRockyVenturesGameState, player: HydratedRockyVenturesPlayerState, cardId: string, weights: Weights): number {
    const feasible = feasibility(state, player)
    let value = 0
    for (const action of cardActions(cardId)) {
        const weight = (weights[action.kind] ?? 0) * (feasible[action.kind] ?? 1)
        value += (weight * actionStrength(action)) / 10
    }
    return value
}

function shareCount(player: HydratedRockyVenturesPlayerState, companyId: CompanyId): number {
    return player.shares.filter((share) => share.companyId === companyId).length
}

function shareValue(state: HydratedRockyVenturesGameState, companyId: CompanyId, shareIndex: number): number {
    const company = state.getCompany(companyId)
    return company.multiplierForShare(shareIndex) * company.value
}

function reserveFor(state: HydratedRockyVenturesGameState): number {
    const eraInMarket = state.market.slots.find((cardId) => getCard(cardId).kind === CardKind.EndOfEra)
    const deckIndex = state.market.drawPile.findIndex((cardId) => getCard(cardId).kind === CardKind.EndOfEra)
    const eraId = eraInMarket ?? (deckIndex >= 0 ? state.market.drawPile[deckIndex] : undefined)
    if (eraId === undefined) {
        return 0
    }
    const era = getCard(eraId)
    if (era.kind !== CardKind.EndOfEra) {
        return 0
    }
    if (eraInMarket) {
        return era.pointBuyCost * 2
    }
    return deckIndex < 6 ? era.pointBuyCost : 0
}

function routeBoxIds(state: HydratedRockyVenturesGameState, playerId: string): Set<string> {
    const boxes = new Set<string>()
    for (const site of ownedMines(state, playerId)) {
        if (site.token?.ore !== 'gold') {
            continue
        }
        for (const cityId of [DeliveryCityId.Dornoch, DeliveryCityId.Manor]) {
            const route = bestRoute(state, site.nodeId, cityId, 0, false)
            if (!route) {
                continue
            }
            for (let step = 0; step + 1 < route.nodeIds.length; step += 1) {
                const from = route.nodeIds[step]
                const to = route.nodeIds[step + 1]
                for (const location of BoardBoxLocations) {
                    const edge = location.edge
                    if ((edge.from === from && edge.to === to) || (edge.from === to && edge.to === from)) {
                        boxes.add(location.box.id)
                    }
                }
            }
        }
    }
    return boxes
}

type Scored = { score: number; move: BotMove }

function pointBuyMoves(state: HydratedRockyVenturesGameState, player: HydratedRockyVenturesPlayerState): BotMove[] {
    const cardId = state.pointBuy?.cardId
    const card = cardId ? getCard(cardId) : undefined
    if (!card || card.kind !== CardKind.EndOfEra) {
        return [{ type: ActionType.PointBuy, bundles: 0 }]
    }
    const keep = 5
    const best = [...player.shares]
        .map((share) => ({ share, value: shareValue(state, share.companyId, share.shareIndex) }))
        .sort((left, right) => right.value - left.value)[0]
    const plain = Math.max(0, Math.floor((player.money - keep) / card.pointBuyCost))
    if (best) {
        const withShare = Math.max(0, Math.floor((player.money + best.value - keep) / card.pointBuyCost))
        if (withShare > plain) {
            return [
                {
                    type: ActionType.PointBuy,
                    bundles: withShare,
                    convertShare: { companyId: best.share.companyId, shareIndex: best.share.shareIndex }
                },
                { type: ActionType.PointBuy, bundles: plain }
            ]
        }
    }
    return [{ type: ActionType.PointBuy, bundles: plain }, { type: ActionType.PointBuy, bundles: 0 }]
}

function resolveHuntMove(state: HydratedRockyVenturesGameState): BotMove | undefined {
    const pending = state.pendingHunt
    if (!pending) {
        return undefined
    }
    if (pending.drawn.length === 0) {
        return { type: ActionType.ResolveHunt, tokenIndexes: [], hitTargets: [] }
    }
    const applyCount = Math.max(1, Math.min(pending.apply, pending.drawn.length))
    const targets = huntTargets(state, pending.region).map((target) => ({ id: target.id, left: Math.max(0, target.level - target.hits) }))
    const needed = targets.reduce((total, target) => total + target.left, 0)
    const indexed = pending.drawn.map((kind, index) => ({ kind, index }))
    const hits = indexed.filter((entry) => entry.kind === WeaponTokenKind.Hit)
    const bonusOrder: WeaponTokenKind[] = [
        WeaponTokenKind.BonusWeaponLevel,
        WeaponTokenKind.BonusGem,
        WeaponTokenKind.BonusGold,
        WeaponTokenKind.BonusInvest
    ]
    const bonuses = indexed
        .filter((entry) => bonusOrder.includes(entry.kind))
        .sort((left, right) => bonusOrder.indexOf(left.kind) - bonusOrder.indexOf(right.kind))
    const chosen: number[] = hits.slice(0, Math.min(needed, applyCount)).map((entry) => entry.index)
    for (const entry of [...bonuses, ...hits, ...indexed]) {
        if (chosen.length < applyCount && !chosen.includes(entry.index)) {
            chosen.push(entry.index)
        }
    }
    const hitTargets: string[] = []
    for (const index of chosen) {
        if (pending.drawn[index] !== WeaponTokenKind.Hit) {
            continue
        }
        const target = targets.filter((candidate) => candidate.left > 0).sort((left, right) => left.left - right.left)[0] ?? targets[0]
        if (target) {
            target.left -= 1
            hitTargets.push(target.id)
        }
    }
    return { type: ActionType.ResolveHunt, tokenIndexes: chosen, hitTargets }
}

function taxBotMoves(state: HydratedRockyVenturesGameState, playerId: string, validTypes: string[]): BotMove[] {
    const player = state.getPlayerState(playerId)
    switch (state.machineState) {
        case MachineState.MovePawn: {
            const taxIndex = player.tableau.findIndex((cardId) => cardActions(cardId).some((action) => action.kind === 'tax'))
            const acquireIndex = player.tableau.findIndex(
                (cardId) => getCard(cardId).kind === CardKind.Player && cardActions(cardId).some((action) => action.kind === 'acquire')
            )
            const target = player.pawnIndex === taxIndex && acquireIndex >= 0 ? acquireIndex : taxIndex
            const skipped = skippedIndexes(player, target) ?? []
            const discards = skipped.filter((index) => isDiscardable(player, index))
            return [{ type: ActionType.MovePawn, targetIndex: target, discardIndexes: discards }]
        }
        case MachineState.PointBuy: {
            const cardId = state.pointBuy?.cardId
            const card = cardId ? getCard(cardId) : undefined
            const bundles = card && card.kind === CardKind.EndOfEra ? Math.floor(player.money / card.pointBuyCost) : 0
            return [{ type: ActionType.PointBuy, bundles }, { type: ActionType.PointBuy, bundles: 0 }]
        }
        case MachineState.Hunt: {
            const move = resolveHuntMove(state)
            return move ? [move] : []
        }
        case MachineState.ChooseShare:
            return (state.pendingShare?.companyIds ?? []).map((companyId) => ({ type: ActionType.ChooseShare, companyId }))
        case MachineState.AgreementPointBuy:
            return [{ type: ActionType.AgreementPointBuy, buy: true }]
        case MachineState.FreeTrack:
            return [{ type: ActionType.LayFreeTrack }]
        default:
            break
    }
    const moves: BotMove[] = []
    if (validTypes.includes(ActionType.Tax)) {
        moves.push({ type: ActionType.Tax })
    }
    if (validTypes.includes(ActionType.Acquire)) {
        const preferWeapon = (player.weaponLevel + player.toolLevel) % 2 === 0
        const choices = acquireChoices(state, playerId).filter((choice) => {
            const plan = planAcquire(state, playerId, choice)
            return (
                plan !== undefined &&
                (plan.victoryPoints > 0 ||
                    plan.destination.weapon !== player.weaponLevel ||
                    plan.destination.tool !== player.toolLevel)
            )
        })
        const ordered = [...choices].sort((left, right) =>
            preferWeapon ? Number(right === 'weapon') - Number(left === 'weapon') : Number(right === 'tool') - Number(left === 'tool')
        )
        for (const choice of ordered) {
            moves.push({ type: ActionType.Acquire, choice })
        }
    }
    if (validTypes.includes(ActionType.SkipBonusInvest)) {
        moves.push({ type: ActionType.SkipBonusInvest })
    }
    if (validTypes.includes(ActionType.EndTurn)) {
        moves.push({ type: ActionType.EndTurn })
    }
    return moves
}

export function chooseBotMoves(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    profile: BotProfile,
    validTypes: string[]
): BotMove[] {
    if (profile === BotProfile.Tax) {
        return taxBotMoves(state, playerId, validTypes)
    }
    const player = state.getPlayerState(playerId)
    const weights = ProfileWeights[profile]
    const scored: Scored[] = []
    const add = (score: number, move: BotMove) => scored.push({ score, move })

    switch (state.machineState) {
        case MachineState.PointBuy:
            return pointBuyMoves(state, player)
        case MachineState.Hunt: {
            const move = resolveHuntMove(state)
            return move ? [move] : []
        }
        case MachineState.ChooseShare:
            return [...(state.pendingShare?.companyIds ?? [])]
                .sort(
                    (left, right) =>
                        state.getCompany(right).value + shareCount(player, right) * 3 -
                        (state.getCompany(left).value + shareCount(player, left) * 3)
                )
                .map((companyId) => ({ type: ActionType.ChooseShare, companyId }))
        case MachineState.AgreementPointBuy:
            return [{ type: ActionType.AgreementPointBuy, buy: true }, { type: ActionType.AgreementPointBuy, buy: false }]
        case MachineState.FreeTrack: {
            const freeTrack = state.freeTrack
            if (!freeTrack) {
                return []
            }
            const useful = routeBoxIds(state, playerId)
            const boxes = buildableBoxes(state, freeTrack.companyId, true).sort(
                (left, right) => Number(useful.has(right.boxId)) - Number(useful.has(left.boxId))
            )
            return [...boxes.map((box): BotMove => ({ type: ActionType.LayFreeTrack, boxId: box.boxId })), { type: ActionType.LayFreeTrack }]
        }
        default:
            break
    }

    if (state.machineState === MachineState.MovePawn) {
        const affordable = state.market.slots.some((cardId, slot) => {
            const cost = investCost(state, slot)
            return cost !== undefined && cost <= player.money && getCard(cardId).kind === CardKind.Development
        })
        for (let target = 0; target < player.tableau.length; target += 1) {
            const skipped = skippedIndexes(player, target)
            if (skipped === undefined || isDominated(player, target)) {
                continue
            }
            let money = player.money
            let penalty = 0
            const discards: number[] = []
            for (const index of skipped) {
                const cardId = player.tableau[index]
                const value = cardId ? cardValue(state, player, cardId, weights) : 0
                if (isDiscardable(player, index) && (isDominated(player, index) || value < 2 || money < PawnSkipCost)) {
                    discards.push(index)
                    penalty += value / 4
                } else if (money >= PawnSkipCost) {
                    money -= PawnSkipCost
                    penalty += 1.5
                } else {
                    penalty = 999
                }
            }
            if (reasonPawnMoveInvalid(player, target, discards)) {
                continue
            }
            const cardId = player.tableau[target]
            if (cardId === undefined) {
                continue
            }
            const value = getCard(cardId).kind === CardKind.Player && cardActions(cardId).some((action) => action.kind === 'invest')
                ? affordable
                    ? 14
                    : 2
                : cardValue(state, player, cardId, weights)
            add(value - penalty, { type: ActionType.MovePawn, targetIndex: target, discardIndexes: discards })
        }
        if (validTypes.includes(ActionType.GemAction) && player.gems >= 2) {
            state.market.slots.forEach((cardId, slot) => {
                if (getCard(cardId).kind !== CardKind.Development || reasonGemActionInvalid(state, playerId, 'market', slot)) {
                    return
                }
                add(cardValue(state, player, cardId, weights) * 1.3 + 1, { type: ActionType.GemAction, kind: 'market', target: slot })
            })
        }
        if (validTypes.includes(ActionType.GemAction) && player.gems > 0 && isDrawPileAtGameOver(state)) {
            if (!reasonGemActionInvalid(state, playerId, 'swap', 0)) {
                add(40, { type: ActionType.GemAction, kind: 'swap', target: 0 })
            }
        }
        return scored.sort((left, right) => right.score - left.score).map((entry) => entry.move)
    }

    const reserve = reserveFor(state)
    if (validTypes.includes(ActionType.Invest)) {
        state.market.slots.forEach((cardId, slot) => {
            const cost = investCost(state, slot)
            if (cost === undefined || cost > player.money) {
                return
            }
            const card = getCard(cardId)
            let value = card.kind === CardKind.EndOfEra ? 1 : cardValue(state, player, cardId, weights)
            if (card.kind === CardKind.Development) {
                if (card.bonus.kind === CardBonusKind.Share) {
                    value += 4
                }
                if (card.bonus.kind === CardBonusKind.Agreement) {
                    value += 1
                }
                if (card.bonus.kind === CardBonusKind.ImmediateAction) {
                    value += (weights[card.bonus.action.kind] ?? 0) / 2
                }
            }
            const dip = player.money - cost < reserve ? 6 : 0
            add(20 + value - cost / 5 - dip, { type: ActionType.Invest, slotIndex: slot })
        })
    }
    if (validTypes.includes(ActionType.SkipBonusInvest)) {
        add(0.5, { type: ActionType.SkipBonusInvest })
    }
    if (validTypes.includes(ActionType.Tax)) {
        add(1 + (player.money < reserve ? 2 : 0), { type: ActionType.Tax })
    }
    if (validTypes.includes(ActionType.ClaimMine)) {
        for (const nodeId of claimableMineIds(state, playerId)) {
            const token = state.board.mines[nodeId]?.token
            const cost = claimCost(state, playerId, nodeId) ?? 0
            const level = token?.level ?? 2
            const gold = token?.ore === 'gold' ? 1.5 : 0
            add((weights.claimMine ?? 0) + level * 0.8 + gold - cost / 2, {
                type: ActionType.ClaimMine,
                nodeId
            })
        }
    }
    if (validTypes.includes(ActionType.ExtractAndSell)) {
        for (const nodeId of extractableMineIds(state, playerId)) {
            const site = state.board.mines[nodeId]
            const cities = site?.token?.ore === 'gold' ? [DeliveryCityId.Dornoch, DeliveryCityId.Manor] : [undefined]
            for (const cityId of cities) {
                const plan = planExtraction(state, playerId, { nodeId, cityId })
                if (typeof plan === 'string') {
                    continue
                }
                const creditCompanyId =
                    plan.creditCandidates.length > 1
                        ? [...plan.creditCandidates].sort((left, right) => shareCount(player, right) - shareCount(player, left))[0]
                        : undefined
                if (reasonExtractInvalid(state, playerId, { nodeId, cityId, creditCompanyId })) {
                    continue
                }
                const underTooled = site?.token?.ore === 'gold' && plan.oreCount < Math.min(site.token.level, 3)
                add((weights.extractAndSell ?? 0) + plan.net / 3 - (underTooled ? 4 : 0), {
                    type: ActionType.ExtractAndSell,
                    nodeId,
                    cityId,
                    creditCompanyId
                })
            }
        }
    }
    if (validTypes.includes(ActionType.Hunt)) {
        for (const region of huntableRegions(state)) {
            if (reasonHuntInvalid(state, playerId, region)) {
                continue
            }
            const remaining = huntTargets(state, region).reduce((total, target) => total + Math.max(0, target.level - target.hits), 0)
            add((weights.hunt ?? 0) + player.weaponLevel + Math.min(remaining, 4) / 2, { type: ActionType.Hunt, region })
        }
    }
    if (validTypes.includes(ActionType.Acquire)) {
        for (const choice of acquireChoices(state, playerId)) {
            const plan = planAcquire(state, playerId, choice)
            if (!plan) {
                continue
            }
            const moved = plan.destination.weapon !== player.weaponLevel || plan.destination.tool !== player.toolLevel
            if (!moved && plan.victoryPoints === 0) {
                continue
            }
            const weaponGain = plan.destination.weapon - player.weaponLevel
            const toolGain = plan.destination.tool - player.toolLevel
            const preference = weaponGain * 3 + toolGain * (player.weaponLevel >= 5 ? 1 : 0.3)
            const deadEnd = plan.destination.weapon === 5 && plan.destination.tool === 2 ? 2 : 0
            add((weights.acquire ?? 0) + preference - deadEnd + plan.victoryPoints, { type: ActionType.Acquire, choice })
        }
    }
    if (validTypes.includes(ActionType.LayTrack)) {
        const limits = layTrackLimits(state)
        const useful = routeBoxIds(state, playerId)
        for (const companyId of limits.allowedCompanyIds) {
            for (const box of buildableBoxes(state, companyId)) {
                add(
                    (weights.layTrack ?? 0) + (useful.has(box.boxId) ? 6 : 0) + shareCount(player, companyId) * 2 - box.cost / 4,
                    { type: ActionType.LayTrack, companyId, boxId: box.boxId }
                )
            }
        }
    }
    if (validTypes.includes(ActionType.EndTurn)) {
        add(0, { type: ActionType.EndTurn })
    }
    return scored.sort((left, right) => right.score - left.score).map((entry) => entry.move)
}
