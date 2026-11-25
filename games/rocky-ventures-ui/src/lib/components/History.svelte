<script lang="ts">
    import { routePolylinePoints } from '$lib/utils/routePath.js'
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { GameEngine, type GameAction } from '@tabletop/common'
    import {
        ActionType,
        BoardNodesById,
        CardActionKind,
        CardKind,
        cardActionsFor,
        CompanyId,
        Definition,
        DragonHuntRegion,
        GemActionCosts,
        FeastBuyerBonuses,
        feastCategoryFor,
        type GemActionKind,
        RegionNames,
        StatKind,
        WeaponTokenKind,
        getCard,
        type HydratedRockyVenturesGameState,
        type RegionId,
        type RockyVenturesGameState,
        type StatEvent
    } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BoardBoxLocations } from '@tabletop/rocky-ventures'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'
    import { weaponTokenImageUrl } from '$lib/utils/dragonImages.js'
    import { savedState } from '$lib/utils/savedState.js'
    import { scourgeImageUrl } from '$lib/utils/scourgeImages.js'
    import { companyLogoUrl } from '$lib/utils/companyLogos.js'
    import { GridRegion, gridCellPosition } from '$lib/utils/trackLayout.js'
    import { boardPicture, type BoardPicture } from '$lib/utils/boardPicture.js'
    import BoardPictureLayer from './BoardPictureLayer.svelte'
    import { BoardArtSize } from '@tabletop/rocky-ventures'

    // Same shape as the other Board Together games' History (e.g. Kaivai): newest first on a
    // timeline, each entry a short "<player> did something" sentence with how long ago it was,
    // and "The game was started" at the very bottom. Internal ids never appear. Each entry also
    // sums up what the step did (hunt results, track cost and value, ore sold, levels gained),
    // read from the state just before and just after the action.
    const timeAgo = createTimeAgo()
    const gameSession = getGameSession()
    const engine = new GameEngine(Definition.runtime)

    const CompanyNames: Record<CompanyId, string> = {
        [CompanyId.WizardCannonball]: 'Wizard Cannonball',
        [CompanyId.DwarvenPacific]: 'Dwarven Pacific',
        [CompanyId.GoblinCentral]: 'Goblin Central',
        [CompanyId.WingedWyrm]: 'Winged Wyrm'
    }

    const CardActionNames: Record<CardActionKind, string> = {
        [CardActionKind.Invest]: 'Invest',
        [CardActionKind.Tax]: 'Tax',
        [CardActionKind.ClaimMine]: 'Claim Mine',
        [CardActionKind.LayTrack]: 'Lay Track',
        [CardActionKind.ExtractAndSell]: 'Extract & Sell',
        [CardActionKind.Acquire]: 'Acquire',
        [CardActionKind.Hunt]: 'Hunt'
    }

    const BonusNames: Partial<Record<WeaponTokenKind, string>> = {
        [WeaponTokenKind.BonusGold]: 'Gold / Claim',
        [WeaponTokenKind.BonusWeaponLevel]: 'Weapon Level',
        [WeaponTokenKind.BonusGem]: 'Gem',
        [WeaponTokenKind.BonusInvest]: 'Invest'
    }

    const CardNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

    type PlayerFigures = { money: number; vp: number; gems: number; weaponLevel: number; toolLevel: number }

    // The handful of facts an entry is summarised from.
    type Snapshot = {
        players: Record<string, PlayerFigures>
        companyValues: Partial<Record<CompanyId, number>>
        tableaus: Record<string, string[]>
        tucked: Record<string, string[]>
        huntDrawn?: WeaponTokenKind[]
        statCount: number
        // The map at this moment, so pictures stay as they were instead of following the live board.
        picture: BoardPicture
    }

    function snapshot(state: HydratedRockyVenturesGameState): Snapshot {
        const players: Snapshot['players'] = {}
        const tableaus: Snapshot['tableaus'] = {}
        const tucked: Snapshot['tucked'] = {}
        for (const player of state.players) {
            players[player.playerId] = {
                money: player.money,
                vp: player.victoryPoints,
                gems: player.gems,
                weaponLevel: player.weaponLevel,
                toolLevel: player.toolLevel
            }
            tableaus[player.playerId] = [...player.tableau]
            tucked[player.playerId] = [...player.tuckedCardIds]
        }
        const companyValues: Snapshot['companyValues'] = {}
        for (const company of state.companies) {
            companyValues[company.id] = company.value
        }
        return {
            players,
            companyValues,
            tableaus,
            tucked,
            huntDrawn: state.pendingHunt ? [...state.pendingHunt.drawn] : undefined,
            statCount: state.statEvents.length,
            picture: boardPicture(state, (playerId) => gameSession.colors.getPlayerUiColor(playerId))
        }
    }

    // Walk back from the current state through each action's undo patch, caching the
    // "before" snapshot per action id so a new action only costs one step.
    const beforeByActionId = new Map<string, Snapshot>()

    const snapshots = $derived.by(() => {
        const actions: GameAction[] = gameSession.actions
        let current: Snapshot | undefined
        try {
            current = snapshot(gameSession.gameState)
            let state = savedState(gameSession)
            for (let i = actions.length - 1; i >= 0; i--) {
                const action = actions[i]!
                if (beforeByActionId.has(action.id)) break
                if (!action.undoPatch) break
                const after = state
                state = engine.undoProcessedAction({ action, state })
                const hydrated = Definition.runtime.hydrator.hydrateState(
                    structuredClone(state)
                ) as HydratedRockyVenturesGameState
                const before = snapshot(hydrated)
                // Moves made before card V was put in its place refer to the order saved back then.
                if (!after.huntStarterCardPlaced) {
                    for (const player of state.players) before.tableaus[player.playerId] = [...player.tableau]
                }
                beforeByActionId.set(action.id, before)
            }
        } catch (error) {
            console.warn('Could not summarise History', error)
        }
        return { before: new Map(beforeByActionId), current }
    })

    type Entry = { id: string; actions: GameAction[]; before?: Snapshot; after?: Snapshot }

    // Consecutive Lay Track steps by the same player for the same railroad read as one entry.
    const entries = $derived.by(() => {
        const actions = gameSession.actions
        const { before, current } = snapshots
        const result: Entry[] = []
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i]!
            const actionBefore = before.get(action.id)
            const actionAfter = i + 1 < actions.length ? before.get(actions[i + 1]!.id) : current
            const previous = result.at(-1)
            const previousAction = previous?.actions.at(-1) as Record<string, unknown> | undefined
            const record = action as unknown as Record<string, unknown>
            if (
                previous &&
                previousAction &&
                action.type === ActionType.LayTrack &&
                previousAction['type'] === ActionType.LayTrack &&
                previousAction['playerId'] === record['playerId'] &&
                previousAction['companyId'] === record['companyId']
            ) {
                previous.actions.push(action)
                previous.after = actionAfter
                continue
            }
            result.push({ id: action.id, actions: [action], before: actionBefore, after: actionAfter })
        }
        return result.toReversed()
    })

    // The stat events recorded while this entry's actions ran.
    function eventsFor(entry: Entry): StatEvent[] {
        if (!entry.before || !entry.after) return []
        return gameSession.gameState.statEvents.slice(entry.before.statCount, entry.after.statCount)
    }

    function delta(entry: Entry, playerId: string, key: keyof PlayerFigures): number | undefined {
        const before = entry.before?.players[playerId]?.[key]
        const after = entry.after?.players[playerId]?.[key]
        return before === undefined || after === undefined ? undefined : after - before
    }

    // "ExtractAndSell" -> "Extract And Sell".
    function formatType(type: string) {
        return type.replace(/([a-z])([A-Z])/g, '$1 $2')
    }

    function companyName(id: unknown): string | undefined {
        return typeof id === 'string' ? CompanyNames[id as CompanyId] : undefined
    }

    function placeName(id: unknown): string | undefined {
        return typeof id === 'string' ? BoardNodesById[id]?.name : undefined
    }

    function regionName(id: unknown): string | undefined {
        if (id === DragonHuntRegion) return 'the Dragon'
        return typeof id === 'string' ? RegionNames[id as RegionId] : undefined
    }

    function plural(count: number, word: string) {
        return `${count} ${word}${count === 1 ? '' : 's'}`
    }

    function money(amount: number) {
        return amount < 0 ? `-$${-amount}` : `$${amount}`
    }

    function signed(amount: number, word: string) {
        return `${amount < 0 ? '-' : '+'}${Math.abs(amount)} ${word}`
    }

    // "2 Hits, 1 Miss, 1 Bonus (Gold)" from a set of weapon tokens.
    function tokenSummary(tokens: WeaponTokenKind[]): string[] {
        const hits = tokens.filter((token) => token === WeaponTokenKind.Hit).length
        const misses = tokens.filter((token) => token === WeaponTokenKind.Miss).length
        const bonuses = tokens.filter((token) => BonusNames[token] !== undefined)
        const parts: string[] = []
        if (bonuses.length) {
            parts.push(`${plural(bonuses.length, 'Bonus').replace('Bonuss', 'Bonuses')} (${bonuses.map((token) => BonusNames[token]).join(', ')})`)
        }
        if (hits) parts.push(plural(hits, 'Hit'))
        if (misses) parts.push(misses === 1 ? '1 Miss' : `${misses} Misses`)
        return parts
    }

    function describeMovePawn(entry: Entry, action: Record<string, unknown>, their: string): string {
        const playerId = String(action['playerId'])
        const index = typeof action['targetIndex'] === 'number' ? action['targetIndex'] : undefined
        const cardId = index !== undefined ? entry.before?.tableaus[playerId]?.[index] : undefined
        if (index === undefined || !cardId) return `moved ${their} pawn`
        const card = getCard(cardId)
        const names =
            card.kind === CardKind.Player || card.kind === CardKind.Development
                ? cardActionsFor(card, gameSession.gameState.cardRevision).map((cardAction) => CardActionNames[cardAction.kind])
                : []
        const discards = Array.isArray(action['discardIndexes']) ? action['discardIndexes'].length : 0
        const paid = -(delta(entry, playerId, 'money') ?? 0)
        const extras = [
            paid > 0 ? `paid ${money(paid)} to skip` : undefined,
            discards > 0 ? `discarded ${plural(discards, 'card')}` : undefined
        ].filter(Boolean)
        return (
            `performed the ${names.length ? names.join(' / ') : ''} action (card ${CardNumerals[index] ?? index + 1})`.replace('the  action', 'an action') +
            (extras.length ? `, ${extras.join(', ')}` : '')
        )
    }

    function describeResolveHunt(entry: Entry, action: Record<string, unknown>): string {
        const playerId = String(action['playerId'])
        const drawn = entry.before?.huntDrawn
        const indexes = Array.isArray(action['tokenIndexes']) ? (action['tokenIndexes'] as number[]) : []
        const chosen = drawn ? indexes.map((index) => drawn[index]).filter((token) => token !== undefined) : []
        const parts = tokenSummary(chosen)
        const cash = delta(entry, playerId, 'money') ?? 0
        const gems = delta(entry, playerId, 'gems') ?? 0
        const weapon = delta(entry, playerId, 'weaponLevel') ?? 0
        const vp = delta(entry, playerId, 'vp') ?? 0
        const gains = [
            cash > 0 ? `+${money(cash)}` : undefined,
            gems > 0 ? `+${plural(gems, 'gem')}` : undefined,
            weapon > 0 ? `+${weapon} weapon level` : undefined
        ].filter(Boolean)
        if (gains.length) parts.push(`gains ${gains.join(', ')}`)
        if (vp) parts.push(signed(vp, 'Points'))
        return parts.length ? `resolved the hunt: ${parts.join(', ')}` : 'resolved the hunt'
    }

    function describeLayTrack(entry: Entry, action: Record<string, unknown>, free: boolean): string {
        const company = companyName(action['companyId'])
        const events = eventsFor(entry).filter((event) => event.kind === StatKind.Track)
        const count = events.length || entry.actions.length
        const cost = events.reduce((sum, event) => sum + event.amount, 0)
        const companyId = action['companyId'] as CompanyId
        const before = entry.before?.companyValues[companyId]
        const after = entry.after?.companyValues[companyId]
        const value = before !== undefined && after !== undefined ? after - before : undefined
        return [
            `laid ${plural(count, free ? 'free track' : 'track')}`,
            company ? `for ${company}` : undefined,
            !free && events.length ? `for ${money(cost)}` : undefined,
            value ? `, ${signed(value, 'value')}` : undefined
        ]
            .filter(Boolean)
            .join(' ')
            .replace(' ,', ',')
    }

    function describeExtract(entry: Entry, action: Record<string, unknown>): string {
        const playerId = String(action['playerId'])
        const mine = placeName(action['nodeId'])
        const extract = eventsFor(entry).find((event) => event.kind === StatKind.MineExtract)
        const detail = Object.fromEntries(
            (extract?.detail ?? '').split(';').map((pair) => pair.split('=') as [string, string])
        )
        const oreCount = Number(detail['ore'])
        const ore = extract?.source === 'silver' ? 'Mana' : extract?.source === 'gold' ? 'Gold' : undefined
        const city = placeName(detail['city'] ?? action['cityId'])
        const credit = companyName(action['creditCompanyId'])
        const earned = delta(entry, playerId, 'money')
        const agreementVp = eventsFor(entry)
            .filter((event) => event.kind === StatKind.VictoryPoints && event.source === 'agreement')
            .reduce((sum, event) => sum + event.amount, 0)
        if (!extract || !ore || !oreCount) {
            return [mine ? `extracted from ${mine}` : 'extracted and sold', city ? `to ${city}` : undefined]
                .filter(Boolean)
                .join(' ')
        }
        return [
            `extracted ${oreCount} ${ore} Ore`,
            mine ? `at ${mine}` : undefined,
            earned !== undefined ? `for ${money(earned)}` : undefined,
            city ? `to ${city}` : undefined,
            credit ? `via ${credit}` : undefined,
            agreementVp ? `and scored ${plural(agreementVp, 'VP')} from the agreement` : undefined
        ]
            .filter(Boolean)
            .join(' ')
            .replace('VPs', 'VP')
    }

    function describeAcquire(entry: Entry, action: Record<string, unknown>): string {
        const playerId = String(action['playerId'])
        const weapon = delta(entry, playerId, 'weaponLevel') ?? 0
        const tool = delta(entry, playerId, 'toolLevel') ?? 0
        const gems = delta(entry, playerId, 'gems') ?? 0
        const parts: string[] = []
        if (weapon > 0) parts.push(plural(weapon, 'Weapon'))
        if (tool > 0) parts.push(plural(tool, 'Tool'))
        // Only what they took with the card; a gem from the grid isn't part of the choice.
        const gemText = ''
        void gems
        if (!parts.length) return (action['choice'] === 'tool' ? 'acquired a tool' : 'acquired a weapon') + gemText
        const level = weapon > 0
            ? entry.after?.players[playerId]?.weaponLevel
            : tool > 0
              ? entry.after?.players[playerId]?.toolLevel
              : undefined
        return `acquired ${parts.join(' and ')}${level !== undefined ? ` (now level ${level})` : ''}${gemText}`
    }

    // The pictures that go with a step, like the Live play watcher box: the card, the tokens, the
    // railroad, and a close-up of the spot on the map (the map as it is now).
    type Zoom = { x: number; y: number; width: number; height: number }
    type Visual = {
        cards: string[]
        tokens: { kind: WeaponTokenKind; picked: boolean }[]
        logo?: string
        // A mine token that turned up during the step (e.g. the silver mine after a gold extract).
        drewUrl?: string
        // The sale breakdown for a delivery, like the Live play viewer: price, expenses, profit.
        lines?: { label: string; amount: number }[]
        credit?: string
        creditLogo?: string
        // Feast scoring and point buys, line by line (Justin, 2026-11-23).
        scoring?: { label: string; value: string; tone?: 'good' | 'bad' | 'total' }[]
        // Scourges that came onto the board during the step.
        entered: { url?: string; region: string }[]
        zoom?: Zoom
        rings: { x: number; y: number }[]
        routeIds?: string[]
        ringRadius?: number
    }

    function around(points: { x: number; y: number }[], minWidth = 380): Zoom | undefined {
        if (!points.length) return undefined
        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)
        const pad = 80
        let width = Math.max(minWidth, Math.max(...xs) - Math.min(...xs) + pad * 2)
        let height = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, (width * 3) / 4)
        width = Math.max(width, (height * 4) / 3)
        height = (width * 3) / 4
        const cx = (Math.max(...xs) + Math.min(...xs)) / 2
        const cy = (Math.max(...ys) + Math.min(...ys)) / 2
        return { x: cx - width / 2, y: cy - height / 2, width, height }
    }

    function cardPicture(cardId: string | undefined, playerId: string): string | undefined {
        if (!cardId) return undefined
        try {
            return getCard(cardId).kind === CardKind.Player
                ? playerCardImageUrl(cardId, gameSession.colors.getPlayerColor(playerId))
                : cardImageUrl(cardId)
        } catch {
            return undefined
        }
    }

    function nodePoints(nodeId: unknown): { x: number; y: number }[] {
        const node = typeof nodeId === 'string' ? BoardNodesById[nodeId] : undefined
        return node ? [{ x: node.x, y: node.y }] : []
    }

    // What buying a Feast scored: the buyer's purchase bonus, then every player's battle axe hits.
    function feastScoring(events: StatEvent[], cardId: string, buyerId: string): NonNullable<Visual['scoring']> {
        const rows: NonNullable<Visual['scoring']> = []
        const vpOf = (source: string, id?: string) =>
            events
                .filter((event) => event.kind === StatKind.VictoryPoints && event.source === source && (id === undefined || event.playerId === id) && (source !== 'hunt' || event.cardId === cardId))
        const bonus = vpOf('feastBonus', buyerId).reduce((sum, event) => sum + event.amount, 0)
        const points = FeastBuyerBonuses[cardId]?.points ?? []
        const measure =
            feastCategoryFor(gameSession.gameState, cardId)?.measureLabel ??
            ({ era1: 'tool level', era2: 'share multipliers', era3: 'gold mines held' } as Record<string, string>)[cardId] ??
            ''
        const rank = points.indexOf(bonus) + 1
        rows.push({
            label: `${gameSession.getPlayerName(buyerId)}: purchase bonus${bonus ? ` (${['1st', '2nd', '3rd'][rank - 1] ?? ''} in ${measure})` : ` (not top 3 in ${measure})`}`.replace(' ()', ''),
            value: `+${bonus} VP`,
            tone: bonus ? 'good' : undefined
        })
        let total = bonus
        for (const event of vpOf('hunt')) {
            if (!event.playerId) continue
            rows.push({ label: `${gameSession.getPlayerName(event.playerId)}: battle axe (${plural(event.amount, 'hit')})`, value: `+${event.amount} VP`, tone: 'good' })
            total += event.amount
        }
        rows.push({ label: 'Total scored', value: `+${total} VP`, tone: 'total' })
        return rows
    }

    function visual(entry: Entry): Visual {
        const action = entry.actions[0] as unknown as Record<string, unknown>
        const playerId = String(action['playerId'])
        const result: Visual = { cards: [], tokens: [], rings: [], entered: [] }
        // Scourges that came onto the board during this step, from any action.
        if (entry.before && entry.after) {
            for (const [scourgeId, region] of Object.entries(entry.after.picture.scourges)) {
                if (!(scourgeId in entry.before.picture.scourges)) {
                    result.entered.push({ url: scourgeImageUrl(scourgeId), region: RegionNames[region as RegionId] ?? region })
                }
            }
        }
        const events = eventsFor(entry)
        switch (action['type']) {
            case ActionType.MovePawn: {
                const index = typeof action['targetIndex'] === 'number' ? action['targetIndex'] : undefined
                const url = cardPicture(index !== undefined ? entry.before?.tableaus[playerId]?.[index] : undefined, playerId)
                if (url) result.cards.push(url)
                break
            }
            case ActionType.Invest: {
                const boughtId = events.find((event) => event.kind === StatKind.Purchase)?.cardId
                const url = cardPicture(boughtId, playerId)
                if (url) result.cards.push(url)
                if (boughtId && FeastBuyerBonuses[boughtId]) result.scoring = feastScoring(events, boughtId, playerId)
                break
            }
            case ActionType.PointBuy: {
                const vpEvents = events.filter((event) => event.kind === StatKind.VictoryPoints && event.source === 'pointBuy' && event.playerId === playerId)
                const shareCash = events.filter((event) => event.kind === StatKind.Cash && event.source === 'shareSale' && event.playerId === playerId).reduce((sum, event) => sum + event.amount, 0)
                const spent = -events.filter((event) => event.kind === StatKind.Cash && event.source === 'pointBuy' && event.playerId === playerId).reduce((sum, event) => sum + event.amount, 0)
                const vp = vpEvents.reduce((sum, event) => sum + event.amount, 0)
                const rows: NonNullable<Visual['scoring']> = []
                if (shareCash) rows.push({ label: 'Cashed in a share', value: `+${money(shareCash)}`, tone: 'good' })
                if (spent) rows.push({ label: 'Spent on points', value: `-${money(spent)}`, tone: 'bad' })
                rows.push({ label: 'VP bought', value: `+${vp} VP`, tone: 'total' })
                result.scoring = rows
                break
            }
            case ActionType.Tax: {
                const url = cardPicture(entry.after?.tucked[playerId]?.at(-1), playerId)
                if (url) result.cards.push(url)
                break
            }
            case ActionType.ChooseShare:
                result.logo = typeof action['companyId'] === 'string' ? companyLogoUrl(action['companyId'] as CompanyId) : undefined
                break
            case ActionType.ClaimMine:
                result.zoom = around(nodePoints(action['nodeId']))
                result.rings = nodePoints(action['nodeId'])
                break
            case ActionType.LayTrack:
            case ActionType.LayFreeTrack: {
                const points = entry.actions
                    .map((step) => BoardBoxLocations.find((location) => location.box.id === (step as unknown as Record<string, unknown>)['boxId']))
                    .filter((location) => location !== undefined)
                result.zoom = around(points)
                result.rings = points.map((point) => ({ x: point.x, y: point.y }))
                result.logo = typeof action['companyId'] === 'string' ? companyLogoUrl(action['companyId'] as CompanyId) : undefined
                break
            }
            case ActionType.ExtractAndSell: {
                const extract = events.find((event) => event.kind === StatKind.MineExtract)
                const detail = Object.fromEntries((extract?.detail ?? '').split(';').map((pair) => pair.split('=') as [string, string]))
                result.zoom = around([...nodePoints(action['nodeId']), ...nodePoints(detail['city'])])
                result.rings = nodePoints(action['nodeId'])
                if (extract) {
                    const oreCount = Number(detail['ore'] ?? 0)
                    const sale = Number(detail['sale'] ?? 0)
                    const bonus = events
                        .filter((event) => event.kind === StatKind.Cash && event.source === 'agreement' && event.playerId === playerId)
                        .reduce((sum, event) => sum + event.amount, 0)
                    const price = sale + bonus
                    const ore = extract.source === 'silver' ? 'Mana' : 'Gold'
                    result.lines = [
                        { label: `${ore} price (${oreCount} × $${oreCount ? Math.round(sale / oreCount) : 0}${bonus ? ` + $${bonus} agreement` : ''})`, amount: price },
                        { label: ore === 'Gold' ? 'Expenses (transport & security)' : 'Expenses (dragon)', amount: -(price - extract.amount) },
                        { label: 'Profit', amount: extract.amount }
                    ]
                }
                if (typeof action['creditCompanyId'] === 'string') {
                    result.credit = `Delivery credited to ${CompanyNames[action['creditCompanyId'] as CompanyId] ?? ''}`
                }
                // The delivery route, recorded with the delivery or chosen by the player.
                const routeIds = detail['route'] ? detail['route'].split(',') : (action['routeNodeIds'] as string[] | undefined)
                if (routeIds && routeIds.length > 1) {
                    result.routeIds = routeIds
                    result.zoom = around(routeIds.flatMap((nodeId) => nodePoints(nodeId)))
                }
                result.creditLogo = typeof action['creditCompanyId'] === 'string' ? companyLogoUrl(action['creditCompanyId'] as CompanyId) : undefined
                // The token that turned up on the mine once its ore was taken.
                const mineBefore = entry.before?.picture.mines.find((mine) => mine.nodeId === action['nodeId'])
                const mineAfter = entry.after?.picture.mines.find((mine) => mine.nodeId === action['nodeId'])
                if (mineAfter?.imageUrl && mineAfter.imageUrl !== mineBefore?.imageUrl) result.drewUrl = mineAfter.imageUrl
                break
            }
            case ActionType.Hunt:
                result.tokens = (entry.after?.huntDrawn ?? []).map((kind) => ({ kind, picked: false }))
                break
            case ActionType.ResolveHunt: {
                const indexes = Array.isArray(action['tokenIndexes']) ? (action['tokenIndexes'] as number[]) : []
                result.tokens = (entry.before?.huntDrawn ?? []).map((kind, index) => ({ kind, picked: indexes.includes(index) }))
                // Scourges hit and since gone from the board were killed.
                const onBoard = new Set(
                    Object.values(gameSession.gameState.board.scourgesByRegion).flatMap((list) => (list ?? []).map((scourge) => scourge.scourgeId))
                )
                for (const target of new Set(Array.isArray(action['hitTargets']) ? (action['hitTargets'] as string[]) : [])) {
                    if (target !== DragonHuntRegion && !onBoard.has(target)) {
                        const url = scourgeImageUrl(target)
                        if (url) result.cards.push(url)
                    }
                }
                break
            }
            case ActionType.Acquire: {
                const after = entry.after?.players[playerId]
                if (after) {
                    const cell = gridCellPosition(after.weaponLevel, after.toolLevel)
                    result.zoom = around([cell], 220)
                    result.rings = [cell]
                    result.ringRadius = 14
                } else {
                    result.zoom = { x: GridRegion.x, y: GridRegion.y, width: GridRegion.width, height: GridRegion.height }
                }
                break
            }
        }
        return result
    }

    // Each turn is one block: who played, then their steps oldest first. Turns read newest first.
    type Turn = { id: string; playerId?: string; entries: Entry[] }
    const turns = $derived.by((): Turn[] => {
        const chronological = entries.toReversed()
        const result: Turn[] = []
        for (const entry of chronological) {
            const action = entry.actions[0]!
            const current = result.at(-1)
            const startsTurn = action.type === ActionType.MovePawn
            if (!current || startsTurn || (action.playerId && current.playerId !== action.playerId)) {
                result.push({ id: entry.id, playerId: action.playerId, entries: [entry] })
            } else {
                current.entries.push(entry)
            }
        }
        return result.toReversed()
    })

    // The sentence after the player's name.
    function describe(entry: Entry): string {
        const action = entry.actions[0] as unknown as Record<string, unknown>
        const their = action['playerId'] === gameSession.myPlayer?.id ? 'your' : 'their'
        const company = companyName(action['companyId'])
        const forCompany = company ? ` for ${company}` : ''
        const playerId = String(action['playerId'])

        switch (action['type']) {
            case ActionType.MovePawn:
                return describeMovePawn(entry, action, their)
            case ActionType.Tax: {
                const income = delta(entry, playerId, 'money')
                return income ? `collected ${money(income)} in taxes` : 'collected taxes'
            }
            case ActionType.Invest: {
                const spent = -(delta(entry, playerId, 'money') ?? 0)
                return spent > 0 ? `invested ${money(spent)}` : 'invested'
            }
            case ActionType.ChooseShare:
                return `took a ${company ?? ''} share`.replace('  ', ' ')
            case ActionType.PointBuy:
                return typeof action['bundles'] === 'number'
                    ? `bought ${plural(action['bundles'], 'point bundle')}`
                    : 'bought points'
            case ActionType.AgreementPointBuy:
                return action['buy'] === false ? 'skipped the agreement point buy' : 'bought agreement points'
            case ActionType.ClaimMine: {
                const mine = placeName(action['nodeId'])
                const cost = -(delta(entry, playerId, 'money') ?? 0)
                return `${mine ? `claimed the ${mine} mine` : 'claimed a mine'}${cost > 0 ? ` for ${money(cost)}` : ''}`
            }
            case ActionType.LayTrack:
                return describeLayTrack(entry, action, false)
            case ActionType.LayFreeTrack:
                return describeLayTrack(entry, action, true)
            case ActionType.ExtractAndSell:
                return describeExtract(entry, action)
            case ActionType.Hunt: {
                const region = regionName(action['region'])
                const drawn = entry.after?.huntDrawn
                const parts = drawn ? tokenSummary(drawn) : []
                return `${region ? `hunted ${region}` : 'went hunting'}${parts.length ? `: drew ${parts.join(', ')}` : ''}`
            }
            case ActionType.ResolveHunt:
                return describeResolveHunt(entry, action)
            case ActionType.Acquire:
                return describeAcquire(entry, action)
            case ActionType.GemAction: {
                const gems = plural(GemActionCosts[action['kind'] as GemActionKind] ?? 1, 'gem')
                switch (action['kind']) {
                    case 'repeat':
                        return `spent ${gems} to repeat an action`
                    case 'market':
                        return `spent ${gems} to use a market card`
                    case 'swap':
                        return `spent ${gems} to swap market cards`
                    case 'movePawn':
                        return `spent ${gems} to move ${their} pawn`
                    default:
                        return `spent ${gems}`
                }
            }
            case ActionType.DiscardAgreement:
                return `discarded an agreement${forCompany}`
            case ActionType.SellVictoryPoints:
                return typeof action['amount'] === 'number'
                    ? `sold ${plural(action['amount'], 'victory point')}`
                    : 'sold victory points'
            case ActionType.SkipBonusInvest:
                return 'skipped the bonus invest'
            case ActionType.EndTurn:
                return `ended ${their} turn`
            default:
                return `used ${formatType(String(action['type']))}${forCompany}`
        }
    }
</script>

<div
    class="rounded-lg border border-[#c9a961] text-left p-2 h-full flex flex-col overflow-hidden min-h-[300px] bg-[#1a120b] text-[#f1e6cf]"
>
    <div class="overflow-auto h-full w-full px-1 py-1">
        <ol class="relative ms-1.5 border-s border-[#3d2c1a]">
            {#each turns as turn (turn.id)}
                {@const first = turn.entries[0]!.actions[0]!}
                <li class="mb-4 ms-4">
                    <div class="absolute -start-1.5 mt-1 h-3 w-3 rounded-full border border-[#1a120b] bg-[#c9a961]"></div>
                    <div class="text-[11px] text-[#a88d5a]">{first.createdAt ? timeAgo.format(first.createdAt) : ''}</div>
                    <div class="mb-1 text-sm font-semibold">
                        {#if turn.playerId}<PlayerName playerId={turn.playerId} />'s turn{:else}The game{/if}
                    </div>
                    <div class="flex flex-col gap-2">
                        {#each turn.entries as entry (entry.id)}
                            {@const action = entry.actions[0]!}
                            {@const pictures = visual(entry)}
                            <div class="flex flex-col gap-1">
                                <div class="text-sm leading-snug text-[#e8d9b8]">
                                    {#if action.playerId}{describe(entry)}{:else}{formatType(action.type)}{/if}
                                </div>
                                {#if pictures.cards.length || pictures.tokens.length || pictures.logo}
                                    <div class="flex flex-wrap items-center gap-2">
                                        {#each pictures.cards as url, cardIndex (cardIndex)}
                                            <img src={url} alt="" class="h-56 w-auto max-w-full rounded object-contain" draggable="false" />
                                        {/each}
                                        {#each pictures.tokens as token, tokenIndex (tokenIndex)}
                                            {@const url = weaponTokenImageUrl(token.kind, gameSession.gameState.bonusTokenCash)}
                                            {#if url}
                                                <div class="relative mx-2 h-10 w-10">
                                                    <img src={url} alt={token.kind} class="h-full w-full object-contain" draggable="false" />
                                                    {#if token.picked}
                                                        <div class="pointer-events-none absolute rounded-full border-2 border-[#ffd166]" style="inset: -24%;"></div>
                                                    {/if}
                                                </div>
                                            {/if}
                                        {/each}
                                        {#if pictures.logo}<img src={pictures.logo} alt="" class="h-10 w-auto" draggable="false" />{/if}
                                    </div>
                                {/if}
                                {#if pictures.zoom}
                                    {@const glowColor = action.playerId ? gameSession.colors.getPlayerUiColor(action.playerId) : '#ffd166'}
                                    {@const moment = action.type === ActionType.ExtractAndSell ? (entry.before ?? entry.after) : (entry.after ?? entry.before)}
                                    <svg viewBox="{pictures.zoom.x} {pictures.zoom.y} {pictures.zoom.width} {pictures.zoom.height}" class="block aspect-[4/3] w-full max-w-xs rounded border border-[#8a6d3b] bg-black" xmlns="http://www.w3.org/2000/svg">
                                        <!-- The board as it was: right after the step, or for a delivery just before it (the mine still showing the gold taken) -->
                                        {#if moment}
                                            <BoardPictureLayer picture={moment.picture} />
                                        {/if}
                            <defs><filter id={`rv-history-glow-${entry.id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter></defs>
                                        {#if pictures.routeIds}
                                            {@const points = routePolylinePoints(pictures.routeIds)}
                                            <polyline {points} fill="none" stroke={glowColor} stroke-width="12" opacity="0.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#{`rv-history-glow-${entry.id}`})" />
                                            <polyline {points} fill="none" stroke="#111" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />
                                            <polyline {points} fill="none" stroke={glowColor} stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
                                        {/if}
                                        {#each pictures.rings as point, ringIndex (ringIndex)}
                                            <circle cx={point.x} cy={point.y} r={pictures.ringRadius ?? 27} fill="none" stroke={glowColor} stroke-width={pictures.ringRadius ? 5 : 7} opacity="0.75" filter="url(#{`rv-history-glow-${entry.id}`})" />
                                        {/each}
                                    </svg>
                                {/if}
                                {#if pictures.scoring}
                                    <div class="grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 text-xs text-[#e8d9b8]">
                                        {#each pictures.scoring as row, rowIndex (rowIndex)}
                                            <span class={row.tone === 'total' ? 'border-t border-[#5a4630] pt-0.5 font-bold text-[#ffd166]' : ''}>{row.label}</span>
                                            <span class="text-right font-mono {row.tone === 'total' ? 'border-t border-[#5a4630] pt-0.5 font-bold text-[#ffd166]' : row.tone === 'bad' ? 'text-[#ff8a7a]' : row.tone === 'good' ? 'text-[#8fd18f]' : ''}">{row.value}</span>
                                        {/each}
                                    </div>
                                {/if}
                                {#if pictures.lines}
                                    <div class="grid w-full max-w-xs grid-cols-[auto_auto] gap-x-4 text-xs text-[#e8d9b8]">
                                        {#each pictures.lines as line (line.label)}
                                            <span class={line.label === 'Profit' ? 'font-bold text-[#ffd166]' : ''}>{line.label}</span>
                                            <span class="text-right font-mono {line.amount < 0 ? 'text-[#ff8a7a]' : line.label === 'Profit' ? 'font-bold text-[#ffd166]' : ''}">{line.amount < 0 ? `-$${-line.amount}` : `$${line.amount}`}</span>
                                        {/each}
                                    </div>
                                {/if}
                                {#if pictures.credit}
                                    <div class="flex items-center gap-2 text-sm text-[#e8d9b8]">
                                        {#if pictures.creditLogo}<img src={pictures.creditLogo} alt="" class="h-10 w-auto" draggable="false" />{/if}
                                        <span>{pictures.credit}</span>
                                    </div>
                                {/if}
                                {#if pictures.drewUrl}
                                    <div class="flex items-center gap-2 text-sm text-[#e8d9b8]">
                                        <span>A new mine token turned up:</span>
                                        <img src={pictures.drewUrl} alt="new mine token" class="h-12 w-12" draggable="false" />
                                    </div>
                                {/if}
                                {#each pictures.entered as scourge, scourgeIndex (scourgeIndex)}
                                    <div class="flex flex-col gap-1">
                                        <div class="text-sm text-[#e8d9b8]">A scourge entered {scourge.region}</div>
                                        {#if scourge.url}<img src={scourge.url} alt="scourge" class="h-40 w-auto max-w-full self-start rounded object-contain" draggable="false" />{/if}
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    </div>
                </li>
            {/each}
            <li class="ms-4">
                <div
                    class="absolute -start-1.5 mt-1 h-3 w-3 rounded-full border border-[#1a120b] bg-[#5a4630]"
                ></div>
                <div class="text-[11px] text-[#a88d5a]">
                    {gameSession.game.createdAt ? timeAgo.format(gameSession.game.createdAt) : ''}
                </div>
                <div class="text-sm text-[#e0cfae]">The game was started</div>
            </li>
        </ol>
    </div>
</div>
