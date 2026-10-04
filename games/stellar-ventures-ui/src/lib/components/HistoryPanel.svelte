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
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
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
                outposts: hexes.filter((hex) => hex.outposts.includes(corporation.id)).length
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
        ActionType.FinishExpansion
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
            if (
                previous &&
                previousAction &&
                (BuildActions.has(action.type) || BuildEndActions.has(action.type)) &&
                BuildActions.has(previousAction.type) &&
                previousAction.type !== ActionType.FinishExpansion &&
                previousAction.playerId === action.playerId &&
                previous.before?.corporation === actionBefore?.corporation
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
            const outposts = entry.actions.filter((a) => a.type === ActionType.ExpandNetwork).length
            const wormholes = entry.actions.filter((a) => a.type === ActionType.CreateWormhole).length
            const parts = [
                outposts > 0 ? `built ${plural(outposts, 'Outpost')}` : undefined,
                wormholes > 0 ? `created ${wormholes === 1 ? 'a Wormhole' : plural(wormholes, 'Wormhole')}` : undefined
            ].filter(Boolean)
            return `${parts.length > 0 ? parts.join(' and ') : 'finished building'}${forCorp}`
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
            case ActionType.OrderShip:
                return typeof action['level'] === 'number'
                    ? `ordered a Level ${action['level']} Ship${forCorp}`
                    : `ordered a Ship${forCorp}`
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
                <div class="text-sm leading-snug">
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
