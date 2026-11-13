<script lang="ts">
    import {
        ActionType,
        BoardBoxLocations,
        BoardNodesById,
        CardKind,
        CompanyNames,
        DragonHuntRegion,
        RegionIds,
        RegionNames,
        ScourgeDefinitionsById,
        StatKind,
        buildableBoxes,
        cardActionsFor,
        getCard,
        planExtraction,
        type DeliveryCityId,
        type CompanyId,
        type WeaponTokenKind,
        type RegionId
    } from '@tabletop/rocky-ventures'
    import type { GameAction } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'
    import { GridRegion, gridCellPosition, victoryPointPosition } from '$lib/utils/trackLayout.js'
    import { regionLabelPoint } from '$lib/utils/regionMap.js'
    import { cardActionText } from '$lib/utils/cardActionText.js'
    import { DragonTileImageUrl, weaponTokenImageUrl } from '$lib/utils/dragonImages.js'
    import { scourgeImageUrl } from '$lib/utils/scourgeImages.js'
    import { recentOtherPlayerAction } from '$lib/utils/recentAction.js'
    import { shareImageUrl } from '$lib/utils/shareImages.js'
    import { companyLogoUrl } from '$lib/utils/companyLogos.js'
    import { CompanyColors } from '$lib/utils/companyDisplay.svelte.js'
    import { mineTokenImageUrl } from '$lib/utils/tokenImages.js'
    import { MarketSlotBoxes } from '$lib/utils/marketLayout.js'
    import { tick } from 'svelte'

    // Live play: the watcher box. While someone else plays it keeps their selected card up until the turn
    // is done, zooms into the map for what they're choosing or just did, and lists each step in words.
    // The player themselves only sees their card pulse.
    const gameSession = getGameSession()

    type Zoom = { x: number; y: number; width: number; height: number }
    type Step = { text: string; detail?: string; zoom?: Zoom; imageUrl?: string; tokens?: { kind: string; picked: boolean }[]; live?: boolean; logoUrl?: string; lines?: { label: string; amount: number }[]; move?: { from: { x: number; y: number }; to: { x: number; y: number }; color: string }; track?: { companyId: string; points: { x: number; y: number }[]; cost: number; count: number; free: boolean }; kind?: string; iconUrl?: string; pin?: { x: number; y: number; url: string }; footer?: { text: string; logoUrl?: string }; rings?: { x: number; y: number }[] }

    const ZoomAspect = 4 / 3

    const activeId = $derived(gameSession.gameState.activePlayerIds[0])
    // Whose history to show: the player on turn, or until they start, the player who just finished,
    // so the last turn's summary stays up instead of vanishing the moment the turn passes. That holds
    // for the next player too: their own screen keeps the summary until they pick their card.
    const actorId = $derived.by(() => {
        // The last move someone made (game-run steps have no player).
        const lastPlayerId = gameSession.actions.findLast((action) => action.playerId)?.playerId
        // The next player has started once they commit their first move (picking their card and action).
        if (!lastPlayerId || lastPlayerId === activeId) return activeId
        return lastPlayerId
    })
    // The player now on turn can click the last turn's summary away; it stays gone for that summary.
    // A summary is known by whose turn it was and the move that opened it, so an undo doesn't make it new.
    // Once closed, or once the next player has moved, it stays gone even if they undo back.
    let dismissedKeys: string[] = $state([])
    const summaryKey = $derived(
        `${actorId}:${gameSession.actions.findLast((action) => action.playerId === actorId && action.type === ActionType.MovePawn)?.id ?? ''}`
    )
    const canDismiss = $derived(gameSession.isMyTurn && actorId !== activeId)
    let lastPassedSummary: string | undefined
    $effect(() => {
        if (actorId !== activeId) {
            lastPassedSummary = summaryKey
        } else if (lastPassedSummary && !dismissedKeys.includes(lastPassedSummary)) {
            dismissedKeys = [...dismissedKeys, lastPassedSummary]
        }
    })
    const watching = $derived(
        (actorId === activeId || !dismissedKeys.includes(summaryKey)) &&
        gameSession.livePlay &&
            !gameSession.isViewingHistory &&
            activeId !== undefined &&
            actorId !== undefined &&
            actorId !== gameSession.myPlayer?.id
    )
    const name = $derived(actorId ? gameSession.getPlayerName(actorId) : '')

    function cardUrl(cardId: string | undefined): string | undefined {
        if (!cardId) return undefined
        try {
            return getCard(cardId).kind === CardKind.Player
                ? playerCardImageUrl(cardId, actorId ? gameSession.colors.getPlayerColor(actorId) : undefined)
                : cardImageUrl(cardId)
        } catch {
            return undefined
        }
    }

    // A 4:3 window on the board around some points, never tighter than minWidth.
    function around(points: { x: number; y: number }[], minWidth = 420): Zoom | undefined {
        if (!points.length) return undefined
        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)
        const pad = 90
        let width = Math.max(minWidth, Math.max(...xs) - Math.min(...xs) + pad * 2)
        let height = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, width / ZoomAspect)
        width = Math.max(width, height * ZoomAspect)
        height = width / ZoomAspect
        const cx = (Math.max(...xs) + Math.min(...xs)) / 2
        const cy = (Math.max(...ys) + Math.min(...ys)) / 2
        return { x: cx - width / 2, y: cy - height / 2, width, height }
    }

    function nodePoint(nodeId: string | undefined) {
        const node = nodeId ? BoardNodesById[nodeId] : undefined
        return node ? [{ x: node.x, y: node.y }] : []
    }

    function regionName(region: string): string {
        if (region === DragonHuntRegion) return 'the Dragon'
        const id = RegionIds.find((candidate) => candidate === region)
        return id ? RegionNames[id] : region
    }

    function regionZoom(region: string): Zoom | undefined {
        const id = RegionIds.find((candidate) => candidate === region)
        return id ? around([regionLabelPoint(id as RegionId)], 520) : undefined
    }

    function gridZoom(width: number = GridRegion.width): Zoom | undefined {
        const player = actorId ? gameSession.gameState.findPlayerState(actorId) : undefined
        if (!player) return undefined
        const cell = gridCellPosition(player.weaponLevel, player.toolLevel)
        return { x: cell.x - width / 2, y: cell.y - width / ZoomAspect / 2, width, height: width / ZoomAspect }
    }

    function money(amount: number): string {
        return amount < 0 ? `-$${-amount}` : `+$${amount}`
    }

    // This turn's actions by the active player, oldest first.
    const turn = $derived.by(() => {
        const actions: GameAction[] = []
        if (!watching || !actorId) return actions
        for (const action of [...gameSession.actions].reverse()) {
            if (action.playerId && action.playerId !== actorId) break
            actions.unshift(action)
            if (action.type === ActionType.MovePawn) break
        }
        return actions
    })

    const selectedCardId = $derived.by(() => {
        if (!turn.some((action) => action.type === ActionType.MovePawn)) return undefined
        const player = actorId ? gameSession.gameState.findPlayerState(actorId) : undefined
        return player && player.pawnIndex !== undefined ? player.tableau[player.pawnIndex] : undefined
    })

    // The actions on a card in short words, e.g. "Tax or Invest" for a card that offers one of them.
    function cardActions(cardId: string | undefined): string | undefined {
        if (!cardId) return undefined
        try {
            const card = getCard(cardId)
            if (card.kind !== CardKind.Player && card.kind !== CardKind.Development) return undefined
            const names = cardActionsFor(card, gameSession.gameState.revisedCards).map((action) => cardActionText(action).split(':')[0])
            if (!names.length) return undefined
            const exclusive = card.kind === CardKind.Player && card.exclusiveActions
            return exclusive ? names.join(' or ') : names.join(', then ')
        } catch {
            return undefined
        }
    }

    const selectedActions = $derived(cardActions(selectedCardId))

    // What the latest hunt this turn paid out, e.g. "+2 VP, +$3".
    // Replaying an older move to read what it did gets less reliable as later moves pile up (and
    // the next turn starts), so each result is kept from the moment its move was the latest one.
    const replayCache = new Map<string, unknown>()
    function fresh<T>(type: string, compute: () => T): T {
        const actions = gameSession.actions
        const index = actions.findLastIndex((action) => action.type === type)
        const key = `${type}:${actions[index]?.id ?? index}`
        if (replayCache.has(key)) return replayCache.get(key) as T
        const result = compute()
        if (index >= 0 && index === actions.length - 1 && result !== undefined) replayCache.set(key, result)
        return result
    }

    function compute_huntBonus() {
        if (!turn.some((action) => action.type === ActionType.ResolveHunt) || !actorId) return undefined
        const recent = recentOtherPlayerAction(gameSession, ActionType.ResolveHunt, { includeMine: true })
        if (!recent) return undefined
        const before = recent.before.getPlayerState(actorId)
        const after = recent.after.getPlayerState(actorId)
        const gain = (amount: number, text: (n: number) => string) => (amount > 0 ? text(amount) : undefined)
        const tokenIndexes = (recent.action as GameAction & { tokenIndexes?: number[] }).tokenIndexes ?? []
        const tokens = (recent.before.pendingHunt?.drawn ?? []).map((kind, index) => ({ kind: kind as string, picked: tokenIndexes.includes(index) }))
        const text = [
            gain(after.victoryPoints - before.victoryPoints, (n) => `${n} VP`),
            gain(after.money - before.money, (n) => `$${n}`),
            gain(after.gems - before.gems, (n) => `${n} ${n === 1 ? 'gem' : 'gems'}`),
            gain(after.weaponLevel - before.weaponLevel, (n) => `${n} weapon ${n === 1 ? 'level' : 'levels'}`)
        ]
            .filter((part) => part !== undefined)
            .join(', ')
        const scourgeIds = (state: typeof recent.before) => Object.values(state.board.scourgesByRegion).flatMap((list) => (list ?? []).map((scourge) => scourge.scourgeId))
        const remaining = new Set(scourgeIds(recent.after))
        const killed: Step[] = scourgeIds(recent.before)
            .filter((scourgeId) => !remaining.has(scourgeId))
            .map((scourgeId) => ({ text: `killed the ${ScourgeDefinitionsById[scourgeId]?.name ?? 'scourge'}`, imageUrl: scourgeImageUrl(scourgeId) }))
        if (!recent.before.dragon.killed && recent.after.dragon.killed) killed.push({ text: 'killed the Dragon', imageUrl: DragonTileImageUrl })
        return { text, tokens, region: recent.before.pendingHunt?.region, hitsFrom: before.huntHits ?? 0, hitsTo: after.huntHits ?? 0, killed, actionId: recent.action.id }
    }
    const huntBonus = $derived(fresh(ActionType.ResolveHunt, compute_huntBonus))

    // The money lines of a sale: what the ore sold for and what the route cost.
    function saleLines(plan: ReturnType<typeof planExtraction>): { label: string; amount: number }[] {
        if (typeof plan === 'string') return []
        const ore = plan.ore === 'gold' ? 'Gold' : plan.ore === 'silver' ? 'Silver' : 'Ore'
        const expenses = plan.transport + plan.security + plan.dragon - plan.discount
        return [
            { label: `${ore} price (${plan.oreCount} × $${plan.price}${plan.agreementBonus ? ` + $${plan.agreementBonus} bonus` : ''})`, amount: plan.sale + plan.agreementBonus },
            { label: 'Expenses (transport & security)', amount: -expenses },
            { label: 'Profit', amount: plan.net }
        ]
    }

    // The latest Extract & Sell this turn, replayed on the state before it for its breakdown.
    function compute_lastExtract() {
        if (!turn.some((action) => action.type === ActionType.ExtractAndSell) || !actorId) return undefined
        const recent = recentOtherPlayerAction<{ nodeId: string; creditCompanyId?: CompanyId }>(gameSession, ActionType.ExtractAndSell, { includeMine: true })
        if (!recent) return undefined
        const token = recent.before.board.getMine(recent.action.nodeId).token
        return {
            actionId: recent.action.id,
            lines: saleLines(planExtraction(recent.before, actorId, recent.action as never)),
            tokenUrl: token ? mineTokenImageUrl(token) : undefined,
            tokenId: token?.id,
            companyId: recent.action.creditCompanyId
        }
    }
    const lastExtract = $derived(fresh(ActionType.ExtractAndSell, compute_lastExtract))

    // What the latest Acquire this turn earned beyond the level: an unlock, a gem or points.
    function compute_lastAcquire() {
        if (!turn.some((action) => action.type === ActionType.Acquire) || !actorId) return undefined
        const recent = recentOtherPlayerAction(gameSession, ActionType.Acquire, { includeMine: true })
        if (!recent) return undefined
        const before = recent.before.getPlayerState(actorId)
        const after = recent.after.getPlayerState(actorId)
        const gains = [
            !before.redMinesUnlocked && after.redMinesUnlocked ? 'Unlocked red mines' : undefined,
            !before.blueMinesUnlocked && after.blueMinesUnlocked ? 'Unlocked blue mines' : undefined,
            after.gems > before.gems ? `Gained ${after.gems - before.gems} ${after.gems - before.gems === 1 ? 'gem' : 'gems'}` : undefined,
            after.victoryPoints > before.victoryPoints ? `Scored ${after.victoryPoints - before.victoryPoints} VP` : undefined
        ].filter((text) => text !== undefined)
        return { actionId: recent.action.id, detail: gains.join(', ') }
    }
    const lastAcquire = $derived(fresh(ActionType.Acquire, compute_lastAcquire))

    // What moving the pawn cost: money paid to skip cards and cards discarded instead.
    function compute_moveCost() {
        if (!turn.some((action) => action.type === ActionType.MovePawn) || !actorId) return undefined
        const recent = recentOtherPlayerAction<{ discardIndexes?: number[] }>(gameSession, ActionType.MovePawn, { includeMine: true })
        if (!recent) return undefined
        const paid = recent.before.getPlayerState(actorId).money - recent.after.getPlayerState(actorId).money
        const discarded = recent.action.discardIndexes?.length ?? 0
        const parts = [
            paid > 0 ? `Paid $${paid} to skip ${paid} ${paid === 1 ? 'card' : 'cards'}` : undefined,
            discarded > 0 ? `Discarded ${discarded} skipped ${discarded === 1 ? 'card' : 'cards'}` : undefined
        ].filter((part) => part !== undefined)
        return parts.length ? parts.join(', ') : undefined
    }
    const moveCost = $derived(fresh(ActionType.MovePawn, compute_moveCost))

    // What a hunt's hits killed: a hit scourge that's no longer on the board, or the Dragon once slain.
    function killedBy(targets: string[] | undefined): Step[] {
        const state = gameSession.gameState
        const onBoard = new Set(Object.values(state.board.scourgesByRegion).flatMap((list) => (list ?? []).map((scourge) => scourge.scourgeId)))
        return [...new Set(targets ?? [])].flatMap((target): Step[] => {
            if (target === DragonHuntRegion) return state.dragon.killed ? [{ text: 'killed the Dragon', imageUrl: DragonTileImageUrl }] : []
            return onBoard.has(target) ? [] : [{ text: `killed the ${ScourgeDefinitionsById[target]?.name ?? 'scourge'}`, imageUrl: scourgeImageUrl(target) }]
        })
    }

    function huntStep(region: string): Step {
        return { text: region === DragonHuntRegion ? 'hunt the Dragon' : `hunt in ${regionName(region)}`, zoom: regionZoom(region) }
    }

    // Track laid piece by piece for one railroad reads as one entry whose map grows with each piece.
    function mergeTrack(list: Step[]): Step[] {
        const merged: Step[] = []
        for (const step of list) {
            const previous = merged.at(-1)
            if (step.track && previous?.track && previous.track.companyId === step.track.companyId) {
                const track = {
                    ...previous.track,
                    points: [...previous.track.points, ...step.track.points],
                    cost: previous.track.cost + step.track.cost,
                    count: previous.track.count + 1
                }
                const name = CompanyNames[track.companyId as CompanyId]
                merged[merged.length - 1] = {
                    ...previous,
                    text: `laid ${track.count} ${name} track ${track.cost === 0 ? 'for free' : `for $${track.cost}`}`,
                    zoom: around(track.points),
                    track
                }
            } else {
                merged.push(step)
            }
        }
        return merged
    }

    const rawSteps = $derived.by((): Step[] => {
        const state = gameSession.gameState
        const turnStart = state.actionCount - turn.length
        const ofKind = (kind: StatKind) => state.statEvents.filter((event) => event.kind === kind && event.playerId === actorId && event.action >= turnStart)
        const extracts = ofKind(StatKind.MineExtract)
        const claims = ofKind(StatKind.MineClaim)
        const purchases = ofKind(StatKind.Purchase)
        const tracks = ofKind(StatKind.Track)
        const cash = ofKind(StatKind.Cash)
        let taxIndex = 0
        let trackIndex = 0
        const player = actorId ? state.findPlayerState(actorId) : undefined
        let extractIndex = 0
        let claimIndex = 0
        let purchaseIndex = 0
        let huntRegion = ''
        // Levels gained by Acquire steps still to come this turn, to work out where each one started.
        const pendingGain = { weapon: 0, tool: 0 }
        for (const action of turn) {
            if (action.type === ActionType.Acquire) pendingGain[(action as GameAction & { choice: 'weapon' | 'tool' }).choice] += 1
        }
        const stepsOf = (action: GameAction): Step[] => {
            const data = action as GameAction & Record<string, unknown>
            switch (action.type) {
                case ActionType.MovePawn:
                    return [{ text: selectedActions ? `selected ${selectedActions}` : 'selected a card', detail: moveCost, imageUrl: cardUrl(selectedCardId) }]
                case ActionType.Invest: {
                    const cardId = purchases[purchaseIndex++]?.cardId
                    const cost = cash.find((event) => event.source === 'purchase' && event.cardId === cardId)?.amount
                    return [{ text: `bought a card${cost === undefined ? '' : ` for $${-cost}`}`, imageUrl: cardUrl(cardId) }]
                }
                case ActionType.Tax: {
                    const income = cash.filter((event) => event.source === 'tax')[taxIndex++]?.amount
                    return [{ text: `taxed${income === undefined ? '' : ` for $${income}`}`, detail: 'Tucked this card under the mat', imageUrl: cardUrl(player?.tuckedCardIds.at(-1)) }]
                }
                case ActionType.ClaimMine: {
                    const cost = claims[claimIndex++]?.amount
                    return [{ text: `claimed ${BoardNodesById[data.nodeId as string]?.name ?? 'a mine'}${cost === undefined ? '' : ` for $${cost}`}`, zoom: around(nodePoint(data.nodeId as string)) }]
                }
                case ActionType.LayTrack:
                case ActionType.LayFreeTrack: {
                    const location = BoardBoxLocations.find((candidate) => candidate.box.id === data.boxId)
                    const event = tracks[trackIndex++]
                    const companyId = (data.companyId ?? event?.source) as CompanyId | undefined
                    const company = companyId ? CompanyNames[companyId] : undefined
                    const cost = event?.amount ?? 0
                    return [
                        {
                            text: `laid ${company ? `${company} ` : ''}track ${action.type === ActionType.LayFreeTrack || cost === 0 ? 'for free' : `for $${cost}`}`,
                            logoUrl: companyId ? companyLogoUrl(companyId) : undefined,
                            zoom: location ? around([location]) : undefined,
                            track: companyId ? { companyId, points: location ? [location] : [], cost, count: 1, free: action.type === ActionType.LayFreeTrack } : undefined
                        }
                    ]
                }
                case ActionType.ExtractAndSell: {
                    const event = extracts[extractIndex++]
                    const detail = Object.fromEntries((event?.detail ?? '').split(';').map((pair) => pair.split('=') as [string, string]))
                    const ore = event?.source === 'gold' ? 'Gold' : event?.source === 'silver' ? 'Silver' : 'ore'
                    const mine = BoardNodesById[data.nodeId as string]?.name ?? 'a mine'
                    const city = BoardNodesById[detail['city'] ?? '']?.name
                    const route = (gameSession.turnMarks.routes.find((nodes) => nodes[0] === data.nodeId) ?? [data.nodeId as string]).flatMap(nodePoint)
                    // The railroad credited with the delivery: picked by the player, or the only one that could take it
                    // (found by the gold token now sitting in that railroad's deliveries).
                    const deliveredTokenId = lastExtract?.actionId === action.id ? lastExtract.tokenId : undefined
                    const companyId =
                        (data.creditCompanyId as CompanyId | undefined) ??
                        (deliveredTokenId
                            ? (gameSession.gameState.companies.find((company) => company.deliveredMineTokenIds.includes(deliveredTokenId))?.id as CompanyId | undefined)
                            : undefined)
                    // The mine draws a new token once its ore is taken: show what came up, if it changed.
                    const nowToken = gameSession.gameState.board.getMine(data.nodeId as string).token
                    const drew: Step[] =
                        event && nowToken && (nowToken.ore !== event.source || String(nowToken.level) !== (detail['level'] ?? ''))
                            ? [
                                  {
                                      text: 'drew',
                                      iconUrl: mineTokenImageUrl(nowToken)
                                  }
                              ]
                            : []
                    // Show the mine in the snippet as the token they extracted, not what it flipped to after.
                    const minePoint = BoardNodesById[data.nodeId as string]
                    const extractedUrl =
                        (lastExtract?.actionId === action.id ? lastExtract.tokenUrl : undefined) ??
                        (event ? mineTokenImageUrl({ ore: event.source, level: Number(detail['level'] ?? 0) } as never) : undefined)
                    const pin = minePoint && extractedUrl ? { x: minePoint.x, y: minePoint.y, url: extractedUrl } : undefined
                    const oreCount = Number(detail['ore'] ?? 0)
                    const sale = Number(detail['sale'] ?? 0)
                    const bonus = cash.filter((other) => other.source === 'agreement' && other.action === event?.action).reduce((sum, other) => sum + other.amount, 0)
                    const price = sale + bonus
                    const net = event?.amount ?? 0
                    const lines = event
                        ? [
                              { label: `${ore} price (${oreCount} × $${oreCount ? Math.round(sale / oreCount) : 0}${bonus ? ` + $${bonus} agreement` : ''})`, amount: price },
                              { label: 'Expenses (transport & security)', amount: -(price - net) },
                              { label: 'Profit', amount: net }
                          ]
                        : undefined
                    return [
                        {
                            kind: 'extract',
                            text: `extracted ${detail['ore'] ?? ''} ${ore} from ${mine}${city ? `, sold to ${city}` : ''}${companyId ? ` via ${CompanyNames[companyId]}` : ''}${event ? `: ${money(event.amount)}` : ''}`.replace('  ', ' '),
                            // The credited railroad goes under the map, with its logo.
                            footer: companyId ? { text: `Delivery credited to ${CompanyNames[companyId]}`, logoUrl: companyLogoUrl(companyId) } : undefined,
                            lines,
                            pin,
                            zoom: around(route)
                        },
                        ...drew
                    ]
                }
                case ActionType.Hunt:
                    huntRegion = data.region as string
                    return [huntStep(huntRegion)]
                case ActionType.ResolveHunt: {
                    const hits = (data.hitTargets as string[] | undefined)?.length ?? 0
                    const bonus = huntBonus?.text ? ` and claimed ${huntBonus.text}` : ''
                    // A hunt that came with a claim has no Hunt step of its own, so name the region first.
                    const region = huntRegion || huntBonus?.region || ''
                    const lead: Step[] = huntRegion || !region ? [] : [huntStep(region)]
                    huntRegion = ''
                    // Battle axe rule: the hit marker climbs the score track.
                    const axe: Step[] =
                        gameSession.gameState.huntHitsScoreAtFeasts && huntBonus && huntBonus.hitsTo > huntBonus.hitsFrom
                            ? [{ text: `moved the battle axe up to ${huntBonus.hitsTo} ${huntBonus.hitsTo === 1 ? 'hit' : 'hits'}`, zoom: around([victoryPointPosition(huntBonus.hitsFrom), victoryPointPosition(huntBonus.hitsTo)], 360) }]
                            : []
                    return [
                        ...lead,{ text: hits ? `applied ${hits} ${hits === 1 ? 'hit' : 'hits'}${bonus}` : `missed${bonus}`, tokens: huntBonus?.tokens }, ...killedBy(data.hitTargets as string[] | undefined), ...axe]
                }
                case ActionType.Acquire: {
                    const choice = data.choice as 'weapon' | 'tool'
                    const level = choice === 'weapon' ? player?.weaponLevel : player?.toolLevel
                    // Close in on the grid and slide the disc from where it was to where it landed.
                    const weaponNow = player?.weaponLevel ?? 1
                    const toolNow = player?.toolLevel ?? 1
                    const weaponAfter = weaponNow - (choice === 'weapon' ? pendingGain.weapon - 1 : pendingGain.weapon)
                    const toolAfter = toolNow - (choice === 'tool' ? pendingGain.tool - 1 : pendingGain.tool)
                    pendingGain[choice] -= 1
                    const to = gridCellPosition(weaponAfter, toolAfter)
                    const from = gridCellPosition(choice === 'weapon' ? weaponAfter - 1 : weaponAfter, choice === 'tool' ? toolAfter - 1 : toolAfter)
                    const zoom = around([from, to], 220)
                    return [
                        {
                            text: `raised ${choice} to ${choice === 'weapon' ? weaponAfter : toolAfter}`,
                            detail: lastAcquire?.actionId === action.id && lastAcquire.detail ? lastAcquire.detail : undefined,
                            zoom,
                            move: { from, to, color: actorId ? gameSession.colors.getPlayerUiColor(actorId) : '#ffd166' }
                        }
                    ]
                }
                case ActionType.ChooseShare: {
                    const companyId = data.companyId as CompanyId
                    const company = state.getCompany(companyId)
                    const index = Math.max(0, company.nextShareIndex - 1)
                    return [{ text: `took a ${CompanyNames[companyId] ?? ''} share (${company.multiplierForShare(index)}x)`, imageUrl: shareImageUrl(companyId, index, company.sharesFlipped) }]
                }
                case ActionType.GemAction: {
                    const labels: Record<string, [string, number]> = {
                        repeat: ['to repeat their card', 2],
                        market: ['to take a market card', 2],
                        swap: ['to swap', 1],
                        movePawn: ['to move their pawn', 1]
                    }
                    const [what, cost] = labels[data.kind as string] ?? ['', 1]
                    return [{ text: `spent ${cost} ${cost === 1 ? 'gem' : 'gems'} ${what}`.trim() }]
                }
                case ActionType.PointBuy:
                    return [{ text: `bought points at the Feast (${data.bundles as number} ${(data.bundles as number) === 1 ? 'bundle' : 'bundles'})` }]
                case ActionType.SellVictoryPoints:
                    return [{ text: `sold ${data.amount as number} VP` }]
                case ActionType.SkipBonusInvest:
                    return [{ text: 'skipped the bonus invest' }]
                case ActionType.DiscardAgreement:
                    return [{ text: `discarded a ${BoardNodesById[data.cityId as string]?.name ?? ''} agreement`.replace('  ', ' ') }]
                case ActionType.AgreementPointBuy:
                    return [{ text: data.buy ? 'bought VP from the agreement' : 'skipped the agreement VP' }]
                default:
                    return []
            }
        }
        // A scourge that came out with a move enters right after that move's step.
        const enteredAfter = (action: GameAction): Step[] => {
            const count = gameSession.actions.indexOf(action) + 1
            return gameSession.enteredScourges
                .filter((entered) => entered.actionCount === count)
                .map((entered) => ({
                    text: `${ScourgeDefinitionsById[entered.scourgeId]?.name ?? 'Scourge'} revealed in ${regionName(entered.region)}`,
                    imageUrl: scourgeImageUrl(entered.scourgeId)
                }))
        }
        // Things the game did on its own because of a move (the dragon tracker, the dragon arriving).
        const eventsAfter = (action: GameAction): Step[] => {
            const count = gameSession.actions.indexOf(action) + 1
            return gameSession.viewerEvents
                .filter((event) => event.actionCount === count)
                .map((event) => ({
                    text: event.text,
                    imageUrl: event.imageUrl,
                    iconUrl: event.iconUrl ?? (event.tokenKind ? weaponTokenImageUrl(event.tokenKind as WeaponTokenKind) : undefined),
                    // A newly revealed mine: show where on the map, ringed.
                    zoom: event.nodeId ? around(nodePoint(event.nodeId)) : undefined,
                    rings: event.nodeId ? nodePoint(event.nodeId) : undefined
                }))
        }
        return turn.flatMap((action) => [...stepsOf(action), ...eventsAfter(action), ...enteredAfter(action)])
    })

    const steps = $derived(mergeTrack(rawSteps))

    // The entry at the bottom of the history: what they're doing right now, before it's committed.
    const live = $derived.by((): Step | undefined => {
        if (!watching || actorId !== activeId) return undefined
        const pending = gameSession.gameState.pendingHunt
        const selection = gameSession.watchedSelection
        if (pending) {
            const picked = selection?.huntSelected ?? []
            return {
                text: `${pending.region === DragonHuntRegion ? 'hunts the Dragon' : `hunts in ${regionName(pending.region)}`}`,
                detail: `Drew ${pending.drawn.length} weapon ${pending.drawn.length === 1 ? 'token' : 'tokens'}, applies up to ${pending.apply}`,
                tokens: pending.drawn.map((kind, index) => ({ kind: kind as string, picked: picked.includes(index) })),
                live: true
            }
        }
        const freeTrack = gameSession.gameState.freeTrack
        if (freeTrack && freeTrack.remaining > 0) {
            const options = buildableBoxes(gameSession.gameState, freeTrack.companyId, true)
                .map((buildable) => BoardBoxLocations.find((candidate) => candidate.box.id === buildable.boxId))
                .filter((location) => location !== undefined)
            return {
                text: `is laying free ${CompanyNames[freeTrack.companyId]} track`,
                logoUrl: companyLogoUrl(freeTrack.companyId),
                detail: `${freeTrack.remaining} left to lay`,
                zoom: around(options),
                live: true
            }
        }
        if (!selection) return undefined
        const mineId = selection.extractHoverNodeId ?? selection.extractNodeId
        if (mineId) {
            const state = gameSession.gameState
            const nodes = [mineId, ...gameSession.watchedRoutePreviews.flatMap((preview) => preview.routeNodeIds)]
            const cityId = (selection.extractHoverNodeId ? undefined : (selection.extractHoverCityId ?? selection.extractCityId)) as DeliveryCityId | undefined
            const companyId = selection.extractCreditCompanyId as CompanyId | undefined
            const token = state.board.getMine(mineId).token
            const plan = cityId && activeId ? planExtraction(state, activeId, { nodeId: mineId, cityId, creditCompanyId: companyId }) : undefined
            return {
                kind: 'extract',
                text: `is extracting from ${BoardNodesById[mineId]?.name ?? 'a mine'}${cityId ? ` to ${BoardNodesById[cityId]?.name ?? cityId}` : ''}`,
                detail: cityId ? (companyId ? `Via ${CompanyNames[companyId]}` : 'Choosing a railroad to credit') : 'Choosing a city',
                logoUrl: companyId ? companyLogoUrl(companyId) : undefined,
                lines: plan ? saleLines(plan) : undefined,
                // Close in on the mine until a city is picked, then pull back to show the route.
                zoom: cityId ? around(nodes.flatMap(nodePoint)) : around(nodePoint(mineId), 320),
                live: true
            }
        }
        if (selection.acquireMode || selection.step === 'Acquire') return { text: 'is picking a level', zoom: gridZoom(), live: true }
        if (selection.step === 'Lay Track' || selection.trackCompanyId) {
            const companyId = selection.trackCompanyId as CompanyId | undefined
            if (!companyId) return { text: 'is choosing a railroad to build', live: true }
            // Once they've laid a piece, that entry updates as each new piece lands; no second entry.
            if (steps.at(-1)?.track?.companyId === companyId) return undefined
            // Every spot they could build next, so watchers see the options light up on the map.
            const options = buildableBoxes(gameSession.gameState, companyId)
                .map((buildable) => BoardBoxLocations.find((candidate) => candidate.box.id === buildable.boxId))
                .filter((location) => location !== undefined)
            return {
                text: `is laying ${CompanyNames[companyId]} track`,
                logoUrl: companyLogoUrl(companyId),
                zoom: around(options),
                live: true
            }
        }
        if (selection.step === 'Invest') {
            return { text: 'is choosing a card to buy', zoom: around(MarketSlotBoxes.map((box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }))), live: true }
        }
        if (selection.step) return { text: `is choosing ${selection.step}`, live: true }
        return undefined
    })

    // Once the turn has passed, the history closes with a final line until the next player starts.
    const finished = $derived(watching && actorId !== activeId && steps.length > 0)
    // Tell the table to hold big overlays until this box has played the turn through to its end.
    $effect(() => {
        gameSession.viewerHold = watching && entries.length > 0 && !(finished && caughtUp)
    })
    // Steps come in one a second, so a quick chain (a claim and its hunt) plays out instead of landing at once.
    const StepMs = 2000
    let shown = $state(0)
    let liveAfter = $state(-1)
    let shownFor: string | undefined
    let paceTimer: ReturnType<typeof setTimeout> | undefined
    $effect(() => {
        const total = steps.length
        // A new turn's history starts from its first step. The turn is known by its opening move, so a
        // brief refresh of the game (no steps for a moment) doesn't replay the whole history.
        const turnKey = turn[0] ? `${actorId}:${turn[0].id ?? gameSession.actions.indexOf(turn[0])}` : undefined
        if (turnKey && shownFor !== turnKey) {
            shownFor = turnKey
            shown = Math.min(total, 1)
        }
        if (total === 0) return
        if (shown > total) shown = total
        clearTimeout(paceTimer)
        if (shown < total && heldLive && heldLive.at === shown && heldLive.step.kind && steps[shown]?.kind === heldLive.step.kind) {
            // The choice they were making just landed: fill in the same entry (with its numbers) right away.
            shown += 1
            liveAfter = -1
        } else if (shown < total) {
            paceTimer = setTimeout(() => (shown += 1), StepMs)
        } else if (liveAfter !== shown) {
            // The live entry (what they're doing now) also waits its second after the last step lands.
            const count = shown
            paceTimer = setTimeout(() => (liveAfter = count), StepMs)
        }
    })
    $effect(() => () => clearTimeout(paceTimer))

    const paced = $derived(steps.slice(0, shown))
    const caughtUp = $derived(shown >= steps.length && liveAfter === shown)
    // A railroad's logo shows once, on the first entry that names it.
    function logoOnce(list: Step[]): Step[] {
        const seen = new Set<string>()
        return list.map((entry) => {
            if (!entry.logoUrl) return entry
            if (seen.has(entry.logoUrl)) return { ...entry, logoUrl: undefined }
            seen.add(entry.logoUrl)
            return entry
        })
    }
    // When a choice is committed (a city picked, tokens applied), what they were doing stays on screen
    // until the step that records it lands, instead of the box going blank in between.
    let heldLive: { step: Step; at: number } | undefined = $state()
    $effect(() => {
        if (caughtUp && live) heldLive = { step: live, at: shown }
        else if (caughtUp && !live) heldLive = undefined
    })
    const entries = $derived(
        !caughtUp
            ? heldLive && heldLive.at === shown
                ? [...paced, heldLive.step]
                : paced
            : live
              ? [...paced, live]
              : finished
                ? [...paced, { text: 'finished their turn', live: true }]
                : paced
    )

    // Keep the newest entry in view as the history grows.
    let feedEl: HTMLDivElement | undefined = $state()
    $effect(() => {
        void entries.length
        void live
        tick().then(() => feedEl?.scrollTo({ top: feedEl.scrollHeight, behavior: 'smooth' }))
    })

    function capital(text: string) {
        return text.charAt(0).toUpperCase() + text.slice(1)
    }
</script>

{#if watching && entries.length}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- The box can be scrolled back through; the header closes it for the player whose turn is next -->
    <div class="fixed bottom-4 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-xl border-2 border-[#ffd166] bg-[#1b140c]/95 text-xs text-[#f1e6cf] shadow-2xl">
        <div
            onclick={() => canDismiss && (dismissedKeys = [...dismissedKeys, summaryKey])}
            title={canDismiss ? 'Click to dismiss' : undefined}
            class="border-b border-[#8a6d3b] px-2 py-1 text-sm {canDismiss ? 'cursor-pointer' : ''}"
        ><strong class="capitalize">{name}</strong>'s turn{#if canDismiss}<span class="float-right text-xs text-[#c9a961]">click to dismiss ✕</span>{/if}</div>
        <div bind:this={feedEl} class="viewer-feed flex max-h-[55vh] flex-col gap-3 overflow-y-scroll p-2">
            {#each entries as entry, index (index)}
                {@const newest = index === entries.length - 1}
                <div class="flex flex-col gap-1">
                    <div class="text-sm font-semibold text-[#ffd166]">
                        {#if entry.live}<strong class="capitalize">{name}</strong> {entry.text}{:else}{capital(entry.text)}{/if}{#if entry.iconUrl}<img src={entry.iconUrl} alt="" class="ml-2 inline-block align-middle h-10 w-10" draggable="false" />{/if}
                    </div>
                    {#if entry.logoUrl}
                        <img src={entry.logoUrl} alt="" class="mx-auto h-16 w-auto" draggable="false" />
                    {/if}
                    {#if entry.detail}<div class="text-[#f1e6cf]">{entry.detail}</div>{/if}
                    {#if entry.imageUrl}
                        <img src={entry.imageUrl} alt="" class="mx-auto h-48 w-auto rounded-lg" draggable="false" />
                    {/if}
                    {#if entry.lines?.length}
                        <div class="mx-auto grid grid-cols-[auto_auto] gap-x-4 text-xs">
                            {#each entry.lines as line (line.label)}
                                <span class={line.label === 'Profit' ? 'font-bold text-[#ffd166]' : ''}>{line.label}</span>
                                <span class="text-right font-mono {line.amount < 0 ? 'text-[#ff8a7a]' : line.label === 'Profit' ? 'font-bold text-[#ffd166]' : ''}">{line.amount < 0 ? `-$${-line.amount}` : `$${line.amount}`}</span>
                            {/each}
                        </div>
                    {/if}
                    {#if entry.tokens?.length}
                        <div class="flex flex-wrap justify-center gap-x-9 gap-y-7 px-3 py-4">
                            {#each entry.tokens as token, tokenIndex (tokenIndex)}
                                {@const url = weaponTokenImageUrl(token.kind as WeaponTokenKind)}
                                {#if url}
                                    <!-- The token as printed, with a gold circle over it once picked -->
                                    <div class="relative h-14 w-14">
                                        <img src={url} alt={token.kind} class="h-full w-full object-contain" draggable="false" />
                                        {#if token.picked}
                                            <!-- Wide enough that the whole square token sits inside the circle -->
                                            <div class="pointer-events-none absolute rounded-full border-[3px] border-[#ffd166] shadow-[0_0_12px_rgba(255,209,102,0.8)]" style="inset: -24%;"></div>
                                        {/if}
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                    {#if entry.zoom}
                        <svg viewBox="{entry.zoom.x} {entry.zoom.y} {entry.zoom.width} {entry.zoom.height}" class="block aspect-[4/3] w-full mx-auto rounded-lg border border-[#8a6d3b] bg-black" xmlns="http://www.w3.org/2000/svg">
                            <use href="#rv-board-svg" />
                            {#if entry.rings}
                                {#each entry.rings as point, ringIndex (ringIndex)}
                                    <g class="track-pulse">
                                        <circle cx={point.x} cy={point.y} r="34" fill="none" stroke="#111" stroke-width="12" opacity="0.85" />
                                        <circle cx={point.x} cy={point.y} r="34" fill="none" stroke="#ffd166" stroke-width="6" />
                                    </g>
                                {/each}
                            {/if}
                            {#if entry.pin}
                                <circle cx={entry.pin.x} cy={entry.pin.y} r="27" fill="#1b140c" />
                                <image href={entry.pin.url} x={entry.pin.x - 25} y={entry.pin.y - 25} width="50" height="50" />
                            {/if}
                            {#if entry.track}
                                <!-- Each piece laid this turn, ringed so it stands out in the snippet -->
                                {#each entry.track.points as point, pointIndex (pointIndex)}
                                    <!-- A dark band under the railroad's colour so the ring reads on any terrain -->
                                    <g class="track-pulse">
                                        <circle cx={point.x} cy={point.y} r="26" fill="none" stroke="#111" stroke-width="13" opacity="0.85" />
                                        <circle cx={point.x} cy={point.y} r="26" fill="none" stroke={CompanyColors[entry.track.companyId as CompanyId] ?? '#ffd166'} stroke-width="7" />
                                        <circle cx={point.x} cy={point.y} r="32" fill="none" stroke="#fff" stroke-width="2" />
                                    </g>
                                {/each}
                            {/if}
                            {#if entry.move}
                                {@const move = entry.move}
                                <!-- Where the disc was (ghost), the path, and the disc sliding to where it landed -->
                                <line x1={move.from.x} y1={move.from.y} x2={move.to.x} y2={move.to.y} stroke="#ffd166" stroke-width="4" stroke-dasharray="8 6" />
                                <circle cx={move.from.x} cy={move.from.y} r="13" fill={move.color} opacity="0.35" stroke="#111" stroke-width="2" />
                                <circle r="14" fill={move.color} stroke="#ffd166" stroke-width="3">
                                    <animate attributeName="cx" values="{move.from.x};{move.to.x};{move.to.x}" keyTimes="0;0.5;1" dur="2.4s" repeatCount="indefinite" />
                                    <animate attributeName="cy" values="{move.from.y};{move.to.y};{move.to.y}" keyTimes="0;0.5;1" dur="2.4s" repeatCount="indefinite" />
                                </circle>
                            {/if}
                        </svg>
                    {/if}
                    {#if entry.footer}
                        <div class="flex items-center justify-center gap-2 text-sm">
                            {#if entry.footer.logoUrl}<img src={entry.footer.logoUrl} alt="" class="h-10 w-auto" draggable="false" />{/if}
                            <span>{entry.footer.text}</span>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .viewer-feed {
        scrollbar-width: thin;
        scrollbar-color: #8a6d3b transparent;
    }
    .track-pulse {
        animation: track-pulse 1.2s ease-in-out infinite;
    }
    @keyframes track-pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.35;
        }
    }
</style>
