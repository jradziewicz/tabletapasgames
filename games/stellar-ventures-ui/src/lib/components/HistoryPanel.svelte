<script lang="ts">
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { GameEngine, type GameAction } from '@tabletop/common'
    import {
        ActionType,
        Definition,
        MachineState,
        effectiveMiningCapacityForCorporation,
        type CorporationId,
        type HydratedStellarVenturesGameState,
        type StellarVenturesGameState
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporationColors, CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import {
        CorporatePowerDisplayNames,
        CorporatePowerDescriptions
    } from '$lib/utils/corporatePowerDisplay.js'
    import CreditsText from './CreditsText.svelte'

    // Same shape as the other Board Together games' History (e.g. Kaivai): newest first on a
    // timeline, each entry a short sentence with how long ago it was, and "The game was started"
    // at the very bottom. During the Corporation Round the Corporation is the actor (its
    // President is named beside the time), and each entry sums up what the step actually did -
    // Outposts built, Mining Capacity change, money spent or earned, CARGO, Shares issued.
    const gameSession = getGameSession()
    const timeAgo = createTimeAgo()
    const engine = new GameEngine(Definition.runtime)

    // States where the active Corporation in turn order is the one acting.
    const CorporationTurnStates = new Set<string>([
        MachineState.IssueShare,
        MachineState.ExpandNetworkOrWormhole,
        MachineState.PayDividends,
        MachineState.OrderShips,
        MachineState.ReleaseDividends,
        MachineState.OfferSignTheAgreement,
        MachineState.OfferSecretAgentsChoice,
        MachineState.OfferSpareParts
    ])

    type CorporationFigures = {
        treasury: number
        cargo: number
        shares: number
        miningCapacity: number
        outposts: number
        // Credits players have paid out of their own pocket for this Corporation (Private
        // Contractor), so a History entry can say what a player personally spent.
        contractorSpend: number
        // Running dividend totals per player (Pay Dividends and the Sign The Agreement bonus), so
        // a payout entry can list who received how much.
        dividendsByPlayer: Record<string, number>
    }

    // The handful of numbers a History entry is summarised from, taken from the state just
    // before an action (the state just after it is the next action's "before", or the current
    // state for the latest action).
    type Snapshot = {
        corporations: Partial<Record<CorporationId, CorporationFigures>>
        alienMiningCapacity: number
        corporation?: CorporationId
        corporationIsActor: boolean
    }

    function actingCorporation(state: HydratedStellarVenturesGameState): CorporationId | undefined {
        return (
            state.draftPowerCorporationId ??
            state.signTheAgreementCorporationId ??
            state.secretAgentsCorporationId ??
            state.taxAgentsCorporationId ??
            state.pendingSparePartsCorporationId ??
            state.expandingCorporationId ??
            state.activeInitialAuctionCorporationId ??
            state.boardroomBattleCorporationId ??
            (CorporationTurnStates.has(state.machineState)
                ? state.corporationTurnOrder[state.activeCorporationIndex]
                : undefined)
        )
    }

    // The Corporation itself is the actor for its own turn's steps (and the Draft Power that
    // follows Sign The Agreement); auctions, Boardroom Battles, Investor and Alien Tech actions
    // stay with the player.
    function corporationActs(state: HydratedStellarVenturesGameState): boolean {
        if (CorporationTurnStates.has(state.machineState)) return true
        return (
            state.machineState === MachineState.DraftPower &&
            state.draftPowerResumeState !== MachineState.InitialAuction
        )
    }

    function snapshot(state: HydratedStellarVenturesGameState): Snapshot {
        const corporations: Snapshot['corporations'] = {}
        const hexes = Object.values(state.board.hexes)
        for (const corporation of state.corporations) {
            if (!corporation.active) continue
            corporations[corporation.id] = {
                treasury: corporation.treasury,
                cargo: corporation.cargo,
                shares: corporation.issuedShareCount,
                miningCapacity: effectiveMiningCapacityForCorporation(state, corporation.id),
                outposts: hexes.filter((hex) => hex.outposts.includes(corporation.id)).length,
                contractorSpend: Object.values(corporation.privateContractorExpenseByPlayer ?? {}).reduce(
                    (sum, amount) => sum + amount,
                    0
                ),
                dividendsByPlayer: { ...(corporation.dividendsReceivedByPlayer ?? {}) }
            }
        }
        return {
            corporations,
            alienMiningCapacity: state.alienCorporation.miningCapacity,
            corporation: actingCorporation(state),
            corporationIsActor: corporationActs(state)
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
            let state = gameSession.gameState.dehydrate() as StellarVenturesGameState
            for (let i = actions.length - 1; i >= 0; i--) {
                const action = actions[i]!
                if (beforeByActionId.has(action.id)) break
                if (!action.undoPatch) break
                state = engine.undoProcessedAction({ action, state })
                const hydrated = Definition.runtime.hydrator.hydrateState(
                    structuredClone(state)
                ) as HydratedStellarVenturesGameState
                beforeByActionId.set(action.id, snapshot(hydrated))
            }
        } catch (error) {
            console.warn('Could not summarise History', error)
        }
        return { before: new Map(beforeByActionId), current }
    })

    // Consecutive builds by the same Corporation in the same turn read as one entry, including
    // the step that ends the build (where its cost is charged).
    const BuildActions = new Set<string>([
        ActionType.ExpandNetwork,
        ActionType.CreateWormhole,
        ActionType.PrivateContractor,
        ActionType.JerryRig,
        ActionType.FinishExpansion
    ])
    const OutpostBuildActions = new Set<string>([
        ActionType.ExpandNetwork,
        ActionType.PrivateContractor,
        ActionType.JerryRig
    ])
    const BuildEndActions = new Set<string>([
        ActionType.FinishExpansion,
        ActionType.DeclineExpandNetworkOrWormhole
    ])

    // Share auctions run during a Corporation's Issue Share step, but the bidders are players.
    const PlayerActsActions = new Set<string>([
        ActionType.PlaceShareBid,
        ActionType.PassShareBid,
        ActionType.PlaceBid,
        ActionType.PassAuction
    ])

    type Entry = {
        id: string
        actions: GameAction[]
        before?: Snapshot
        after?: Snapshot
    }

    // Which Corporation a build step is for: named on the action itself when it is an Investor
    // build (Private Contractor / Jerry-Rig), otherwise the Corporation whose turn it is. (Before
    // a Private Contractor's first Outpost, no Corporation is "expanding" yet, so the turn-based
    // answer alone split its first Outpost off from the rest.)
    function buildCorporation(action: GameAction, before: Snapshot | undefined) {
        const named = (action as unknown as Record<string, unknown>)['corporationId']
        return typeof named === 'string' ? named : before?.corporation
    }

    const entries = $derived.by(() => {
        const actions = gameSession.actions
        const { before, current } = snapshots
        const result: Entry[] = []
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i]!
            const actionBefore = before.get(action.id)
            const actionAfter =
                i + 1 < actions.length ? before.get(actions[i + 1]!.id) : current
            const previous = result.at(-1)
            const previousAction = previous?.actions.at(-1)
            // Consecutive Ship orders by the same Corporation in the same turn read as one entry
            // too ("ordered 2 Level 1 Ships, spent ₮2"), including the step that ends ordering.
            if (
                previous &&
                previousAction &&
                previousAction.type === ActionType.OrderShip &&
                (action.type === ActionType.OrderShip || action.type === ActionType.DeclineOrderShips) &&
                previousAction.playerId === action.playerId &&
                previous.before?.corporation === actionBefore?.corporation
            ) {
                previous.actions.push(action)
                previous.after = actionAfter
                continue
            }
            if (
                previous &&
                previousAction &&
                (BuildActions.has(action.type) || BuildEndActions.has(action.type)) &&
                BuildActions.has(previousAction.type) &&
                previousAction.type !== ActionType.FinishExpansion &&
                previousAction.playerId === action.playerId &&
                buildCorporation(previous.actions[0]!, previous.before) ===
                    buildCorporation(action, actionBefore)
            ) {
                previous.actions.push(action)
                previous.after = actionAfter
                continue
            }
            result.push({ id: action.id, actions: [action], before: actionBefore, after: actionAfter })
        }
        return result.reverse()
    })

    // "ExpandNetwork" -> "Expand Network".
    function formatType(type: string) {
        return type.replace(/([a-z])([A-Z])/g, '$1 $2')
    }

    function corporationName(id: unknown): string | undefined {
        return typeof id === 'string' ? CorporationDisplayNames[id as CorporationId] : undefined
    }

    function plural(count: number, word: string) {
        return `${count} ${word}${count === 1 ? '' : 's'}`
    }

    function entryCorporation(entry: Entry): CorporationId | undefined {
        const first = entry.actions[0] as unknown as Record<string, unknown>
        return (first['corporationId'] as CorporationId | undefined) ?? entry.before?.corporation
    }

    // The verb phrase. Credits use the "₮" placeholder, which CreditsText swaps for the game's
    // own currency symbol. "for <Corporation>" is only added when a player is the actor.
    function describe(entry: Entry, corp: string | undefined, corporationIsActor: boolean): string {
        const action = entry.actions[0] as unknown as Record<string, unknown>
        const forCorp = corp && !corporationIsActor ? ` for ${corp}` : ''
        const metadata = (action['metadata'] ?? {}) as Record<string, unknown>
        const amount = typeof action['amount'] === 'number' ? action['amount'] : undefined

        if (BuildActions.has(String(action['type']))) {
            const outposts = entry.actions.filter((a) => OutpostBuildActions.has(a.type)).length
            const wormholes = entry.actions.filter((a) => a.type === ActionType.CreateWormhole).length
            const via = entry.actions.some((a) => a.type === ActionType.PrivateContractor)
                ? ' via Private Contractor'
                : entry.actions.some((a) => a.type === ActionType.JerryRig)
                  ? ' via Jerry-Rig'
                  : ''
            const parts = [
                outposts > 0 ? `built ${plural(outposts, 'Outpost')}` : undefined,
                wormholes > 0 ? `created ${wormholes === 1 ? 'a Wormhole' : plural(wormholes, 'Wormhole')}` : undefined
            ].filter(Boolean)
            return `${parts.length > 0 ? parts.join(' and ') : 'finished building'}${forCorp}${via}`
        }

        switch (action['type']) {
            case ActionType.PlaceBid:
                return `bid ₮${amount ?? 0}${forCorp}`
            case ActionType.PassAuction:
            case ActionType.PassShareBid:
                return `passed${corp ? ` on ${corp}` : ''}`
            case ActionType.IssueShare:
                return `issued a Share${forCorp}`
            case ActionType.DeclineIssueShare:
                return `chose not to issue a Share${forCorp}`
            case ActionType.PlaceShareBid:
                return `bid ₮${amount ?? 0} for a Share${forCorp}`
            case ActionType.DeclineExpandNetworkOrWormhole:
                return `chose not to build${forCorp}`
            case ActionType.PayDividends:
                return typeof action['payoutPerShare'] === 'number'
                    ? `paid ₮${action['payoutPerShare']} per Share${forCorp}`
                    : `paid dividends${forCorp}`
            case ActionType.OrderShip: {
                // Every Ship ordered in this entry, counted per level: "2 Level 1 Ships and a
                // Level 3 Ship".
                const countByLevel = new Map<number, number>()
                for (const order of entry.actions) {
                    const level = (order as unknown as Record<string, unknown>)['level']
                    if (order.type === ActionType.OrderShip && typeof level === 'number') {
                        countByLevel.set(level, (countByLevel.get(level) ?? 0) + 1)
                    }
                }
                if (countByLevel.size === 0) return `ordered a Ship${forCorp}`
                const ships = [...countByLevel.entries()]
                    .sort(([a], [b]) => a - b)
                    .map(([level, count]) =>
                        count === 1 ? `a Level ${level} Ship` : `${count} Level ${level} Ships`
                    )
                return `ordered ${ships.join(' and ')}${forCorp}`
            }
            case ActionType.DeclineOrderShips:
                return `ordered no Ships${forCorp}`
            case ActionType.PlaceBoardroomVote:
                return `placed ${plural(amount ?? 0, 'vote')}${corp ? ` on ${corp}` : ''}`
            case ActionType.DeclineBoardroomVote:
                return 'placed no votes'
            case ActionType.CargoBoost:
                return `boosted CARGO${forCorp}`
            case ActionType.Launder:
                return `laundered ${amount ?? 0} Alien Tech`
            case ActionType.DraftPower: {
                const power =
                    typeof action['powerId'] === 'string'
                        ? (CorporatePowerDisplayNames[action['powerId']] ?? 'a Power')
                        : 'a Power'
                return `drafted ${power}${forCorp}`
            }
            // Corporate Powers - say what the Power actually did (its full text is the hover).
            case ActionType.LeakedResearch:
                return `used Leaked Research to research Wormhole Technology${forCorp}`
            case ActionType.AlienAlchemist:
                return `used Alien Alchemist to turn 2 unbuilt Outposts into an Alien Tech Cube${forCorp}`
            case ActionType.DismantlingOutposts:
                return `used Dismantling Outposts to return a Deep Space Outpost for ₮1${forCorp}`
            case ActionType.NebularExplorers:
                return `used Nebular Explorers to build on a Nebular Anomaly, revealing a new Alien Planet${forCorp}`
            case ActionType.FinePrint:
                return `used Fine Print to sit out the Boardroom Battle${forCorp}`
            case ActionType.DeepSpaceSmuggling:
                return `used Deep Space Smuggling to pay dividends on ${corp ?? 'another Corporation'}'s CARGO`
            case ActionType.DeepSpacePirates:
                return `used Deep Space Pirates to pay dividends on ${corp ?? 'another Corporation'}'s Mining Capacity`
            case ActionType.SpareParts:
                return `used Spare Parts to save a Ship from Scrapping${forCorp}`
            case ActionType.AlienEngineering: {
                const cubes =
                    typeof action['cargoBoostCubesToReclaim'] === 'number'
                        ? action['cargoBoostCubesToReclaim']
                        : 0
                const reclaimed = [
                    cubes > 0 ? plural(cubes, 'CARGO Boost cube') : undefined,
                    action['reclaimWormhole'] === true ? 'the Wormhole cube' : undefined
                ].filter(Boolean)
                return `used Alien Engineering to reclaim ${reclaimed.join(' and ') || 'Alien Tech'}${forCorp}`
            }
            case ActionType.InsuranceFraud:
                return typeof action['shipLevel'] === 'number'
                    ? `used Insurance Fraud to scrap a Level ${action['shipLevel']} Ship${forCorp}`
                    : `used Insurance Fraud${forCorp}`
            case ActionType.DeclineSpareParts:
                return `chose not to use Spare Parts${forCorp}`
            case ActionType.DeclineFinePrint:
                return `chose not to use Fine Print${forCorp}`
            case ActionType.DeclineBackroomDeal:
                return 'chose not to use Backroom Deal'
            case ActionType.DeclinePayDividendsPower:
                return `chose not to use its dividend Power${forCorp}`
            case ActionType.BlackMarket:
                return 'used Black Market to trade a Voting Disc for an Alien Tech Cube'
            case ActionType.ResearchWormhole:
                return `researched Wormhole Technology${forCorp}`
            case ActionType.DevelopPlanets: {
                const count = Array.isArray(action['hexIds']) ? action['hexIds'].length : 0
                return `developed ${plural(count, 'Planet')}${forCorp}`
            }
            case ActionType.SignTheAgreement:
                return `signed The Agreement${forCorp}`
            case ActionType.DeclineSignTheAgreement:
                return `chose not to sign The Agreement${forCorp}`
            case ActionType.PayTax: {
                const loans =
                    typeof metadata['loans'] === 'number' && metadata['loans'] > 0
                        ? ` (${plural(metadata['loans'], 'loan')})`
                        : ''
                return typeof metadata['amount'] === 'number'
                    ? `paid ₮${metadata['amount']} in taxes${forCorp}${loans}`
                    : `paid taxes${forCorp}`
            }
            case ActionType.TaxAgentsTakeFromTaxBox:
                return typeof metadata['amount'] === 'number'
                    ? `took ₮${metadata['amount']} from the Tax Box${forCorp}`
                    : `took from the Tax Box${forCorp}`
            case ActionType.BackroomDeal:
                return `moved Alien Mining Capacity ${action['direction'] === 'down' ? 'down' : 'up'}`
            case ActionType.ReleaseDividends:
                return `released dividends${forCorp}`
            case ActionType.ChooseBoardroomBattleCorporation:
                return `chose ${corp ?? 'a Corporation'} for the Boardroom Battle`
            case ActionType.PassInvestorAction:
            case ActionType.PassAlienTechAction:
                return 'passed'
            default:
                return `used ${formatType(String(action['type']))}${forCorp}`
        }
    }

    // A Corporate Power's full text, shown on hover over the line for any step that drafted or
    // used one ("LeakedResearch" action -> "leakedResearch" Power).
    function powerHoverText(entry: Entry): string | undefined {
        const action = entry.actions[0] as unknown as Record<string, unknown>
        const powerId =
            action['type'] === ActionType.DraftPower && typeof action['powerId'] === 'string'
                ? action['powerId']
                : String(action['type']).charAt(0).toLowerCase() + String(action['type']).slice(1)
        const description = CorporatePowerDescriptions[powerId]
        return description
            ? `${CorporatePowerDisplayNames[powerId] ?? ''}: ${description}`
            : undefined
    }

    // Who received dividends in this step and how much (Pay Dividends, or the Bonus Dividend
    // when signing The Agreement), largest first.
    function dividendRecipients(
        entry: Entry,
        corporationId: CorporationId | undefined
    ): { playerId: string; amount: number }[] {
        const was = corporationId ? entry.before?.corporations[corporationId] : undefined
        const now = corporationId ? entry.after?.corporations[corporationId] : undefined
        if (!was || !now) return []
        return Object.entries(now.dividendsByPlayer)
            .map(([playerId, total]) => ({
                playerId,
                amount: total - (was.dividendsByPlayer[playerId] ?? 0)
            }))
            .filter((recipient) => recipient.amount > 0)
            .sort((a, b) => b.amount - a.amount)
    }

    // What the step changed for its Corporation (and the Aliens), from the before/after
    // snapshots. Things the verb phrase already says (Outposts built, a Share issued) are not
    // repeated.
    function summary(entry: Entry, corporationId: CorporationId | undefined): string[] {
        const parts: string[] = []
        const { before, after } = entry
        if (!before || !after) return parts
        const type = entry.actions[0]!.type
        const was = corporationId ? before.corporations[corporationId] : undefined
        const now = corporationId ? after.corporations[corporationId] : undefined
        if (was && now) {
            const outposts = now.outposts - was.outposts
            if (outposts !== 0 && !BuildActions.has(type)) {
                parts.push(`${outposts > 0 ? '+' : ''}${plural(outposts, 'Outpost')}`)
            }
            const shares = now.shares - was.shares
            if (shares > 0 && type !== ActionType.IssueShare) {
                parts.push(`issued ${plural(shares, 'Share')}`)
            }
            const miningCapacity = now.miningCapacity - was.miningCapacity
            if (miningCapacity !== 0) {
                parts.push(
                    `Mining Capacity ${miningCapacity > 0 ? '+' : ''}${miningCapacity} (now ${now.miningCapacity})`
                )
            }
            const cargo = now.cargo - was.cargo
            if (cargo !== 0) parts.push(`CARGO ${cargo > 0 ? '+' : ''}${cargo}`)
            const treasury = now.treasury - was.treasury
            if (treasury < 0) parts.push(`spent ₮${-treasury}`)
            if (treasury > 0) parts.push(`earned ₮${treasury}`)
            const contractor = now.contractorSpend - was.contractorSpend
            if (contractor > 0) parts.push(`paid ₮${contractor} out of pocket`)
        }
        const alien = after.alienMiningCapacity - before.alienMiningCapacity
        if (alien !== 0) {
            parts.push(`Alien Mining Capacity ${alien > 0 ? '+' : ''}${alien}`)
        }
        return parts
    }
</script>

<div class="h-full overflow-y-auto px-3 py-2 text-[#e6e9f5]">
    <ol class="relative ms-1.5 border-s border-[#3a4166]">
        {#each entries as entry (entry.id)}
            {@const action = entry.actions[0]!}
            {@const corporationId = entryCorporation(entry)}
            {@const corp = corporationName(corporationId)}
            {@const corporationIsActor =
                !!corp && !!entry.before?.corporationIsActor && !PlayerActsActions.has(action.type)}
            {@const details = summary(entry, corporationId)}
            {@const powerHover = powerHoverText(entry)}
            {@const recipients = dividendRecipients(entry, corporationId)}
            <li class="mb-3 ms-4">
                <div
                    class="absolute -start-1.5 mt-1 h-3 w-3 rounded-full border border-[#0b0e1a]"
                    style="background-color: {corporationIsActor && corporationId
                        ? CorporationColors[corporationId]
                        : '#2f6fed'};"
                ></div>
                <div class="text-[11px] text-[#7f88ad]">
                    {action.createdAt ? timeAgo.format(action.createdAt) : ''}
                    {#if corporationIsActor && action.playerId}
                        · <PlayerName playerId={action.playerId} />
                    {/if}
                </div>
                <div
                    class="text-sm leading-snug {powerHover ? 'cursor-help underline decoration-dotted decoration-[#7f88ad] underline-offset-2' : ''}"
                    title={powerHover}
                >
                    {#if corporationIsActor && corporationId}
                        <span class="font-semibold" style="color: {CorporationColors[corporationId]};"
                            >{corp}</span
                        >
                        <CreditsText text={describe(entry, corp, true)} />
                    {:else if action.playerId}
                        <PlayerName playerId={action.playerId} />
                        <CreditsText text={describe(entry, corp, false)} />
                    {:else}
                        <span class="text-[#aeb5d6]">{formatType(action.type)}</span>
                    {/if}
                </div>
                {#if details.length > 0}
                    <div class="mt-0.5 text-xs text-[#aeb5d6]">
                        <CreditsText text={details.join(' · ')} />
                    </div>
                {/if}
                {#if recipients.length > 0}
                    <ul class="mt-0.5 list-disc ps-5 text-xs text-[#aeb5d6]">
                        {#each recipients as recipient (recipient.playerId)}
                            <li>
                                <PlayerName playerId={recipient.playerId} />
                                <CreditsText text={`received ₮${recipient.amount}`} />
                            </li>
                        {/each}
                    </ul>
                {/if}
            </li>
        {/each}
        <li class="ms-4">
            <div
                class="absolute -start-1.5 mt-1 h-3 w-3 rounded-full border border-[#0b0e1a] bg-[#7f88ad]"
            ></div>
            <div class="text-[11px] text-[#7f88ad]">
                {gameSession.game.createdAt ? timeAgo.format(gameSession.game.createdAt) : ''}
            </div>
            <div class="text-sm text-[#aeb5d6]">The game was started</div>
        </li>
    </ol>
</div>
