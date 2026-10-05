<script lang="ts">
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { GameEngine, type GameAction } from '@tabletop/common'
    import {
        ActionType,
        BoardNodesById,
        CardActionKind,
        CardKind,
        CompanyId,
        Definition,
        DragonHuntRegion,
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
        [WeaponTokenKind.BonusGold]: 'Gold',
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
        huntDrawn?: WeaponTokenKind[]
        statCount: number
    }

    function snapshot(state: HydratedRockyVenturesGameState): Snapshot {
        const players: Snapshot['players'] = {}
        const tableaus: Snapshot['tableaus'] = {}
        for (const player of state.players) {
            players[player.playerId] = {
                money: player.money,
                vp: player.victoryPoints,
                gems: player.gems,
                weaponLevel: player.weaponLevel,
                toolLevel: player.toolLevel
            }
            tableaus[player.playerId] = [...player.tableau]
        }
        const companyValues: Snapshot['companyValues'] = {}
        for (const company of state.companies) {
            companyValues[company.id] = company.value
        }
        return {
            players,
            companyValues,
            tableaus,
            huntDrawn: state.pendingHunt ? [...state.pendingHunt.drawn] : undefined,
            statCount: state.statEvents.length
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
            let state = gameSession.gameState.dehydrate() as RockyVenturesGameState
            for (let i = actions.length - 1; i >= 0; i--) {
                const action = actions[i]!
                if (beforeByActionId.has(action.id)) break
                if (!action.undoPatch) break
                state = engine.undoProcessedAction({ action, state })
                const hydrated = Definition.runtime.hydrator.hydrateState(
                    structuredClone(state)
                ) as HydratedRockyVenturesGameState
                beforeByActionId.set(action.id, snapshot(hydrated))
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
                ? card.actions.map((cardAction) => CardActionNames[cardAction.kind])
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
        const ore = extract?.source === 'silver' ? 'Silver' : extract?.source === 'gold' ? 'Gold' : undefined
        const city = placeName(detail['city'] ?? action['cityId'])
        const credit = companyName(action['creditCompanyId'])
        const earned = delta(entry, playerId, 'money')
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
            credit ? `via ${credit}` : undefined
        ]
            .filter(Boolean)
            .join(' ')
    }

    function describeAcquire(entry: Entry, action: Record<string, unknown>): string {
        const playerId = String(action['playerId'])
        const weapon = delta(entry, playerId, 'weaponLevel') ?? 0
        const tool = delta(entry, playerId, 'toolLevel') ?? 0
        const gems = delta(entry, playerId, 'gems') ?? 0
        const parts: string[] = []
        if (weapon > 0) parts.push(plural(weapon, 'Weapon'))
        if (tool > 0) parts.push(plural(tool, 'Tool'))
        if (gems > 0) parts.push(plural(gems, 'Gem'))
        if (!parts.length) return action['choice'] === 'tool' ? 'acquired a tool' : 'acquired a weapon'
        const level = weapon > 0
            ? entry.after?.players[playerId]?.weaponLevel
            : tool > 0
              ? entry.after?.players[playerId]?.toolLevel
              : undefined
        return `acquired ${parts.join(' and ')}${level !== undefined ? ` (now level ${level})` : ''}`
    }

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
            case ActionType.GemAction:
                switch (action['kind']) {
                    case 'repeat':
                        return 'spent a gem to repeat an action'
                    case 'market':
                        return 'spent a gem at the market'
                    case 'swap':
                        return 'spent a gem to swap'
                    case 'movePawn':
                        return `spent a gem to move ${their} pawn`
                    default:
                        return 'spent a gem'
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
            {#each entries as entry (entry.id)}
                {@const action = entry.actions[0]!}
                <li class="mb-3 ms-4">
                    <div
                        class="absolute -start-1.5 mt-1 h-3 w-3 rounded-full border border-[#1a120b] bg-[#c9a961]"
                    ></div>
                    <div class="text-[11px] text-[#a88d5a]">
                        {action.createdAt ? timeAgo.format(action.createdAt) : ''}
                    </div>
                    <div class="text-sm leading-snug">
                        {#if action.playerId}
                            <PlayerName playerId={action.playerId} />
                            {describe(entry)}
                        {:else}
                            <span class="text-[#e0cfae]">{formatType(action.type)}</span>
                        {/if}
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
