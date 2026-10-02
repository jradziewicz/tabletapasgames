<script lang="ts">
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { GameEngine, type GameAction } from '@tabletop/common'
    import {
        ActionType,
        Definition,
        MachineState,
        type CorporationId,
        type StellarVenturesGameState
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import CreditsText from './CreditsText.svelte'

    // Same shape as the other Board Together games' History (e.g. Kaivai): newest first on a
    // timeline, each entry a short "<player> did something" sentence with how long ago it was,
    // and "The game was started" at the very bottom.
    const gameSession = getGameSession()
    const timeAgo = createTimeAgo()

    const items = $derived([...gameSession.actions].reverse())

    // Most actions don't record which Corporation they were for (an Outpost, a Ship order, a
    // Share issue...), so work it out from the game state just before each action: walk back
    // from the current state through each action's undo patch. Results are cached by action id,
    // so a new action only costs one step.
    const engine = new GameEngine(Definition.runtime)
    const corporationByActionId = new Map<string, CorporationId | undefined>()

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

    function actingCorporation(before: StellarVenturesGameState): CorporationId | undefined {
        return (
            before.draftPowerCorporationId ??
            before.signTheAgreementCorporationId ??
            before.secretAgentsCorporationId ??
            before.taxAgentsCorporationId ??
            before.pendingSparePartsCorporationId ??
            before.expandingCorporationId ??
            before.activeInitialAuctionCorporationId ??
            before.boardroomBattleCorporationId ??
            (CorporationTurnStates.has(before.machineState)
                ? before.corporationTurnOrder[before.activeCorporationIndex]
                : undefined)
        )
    }

    const corporations = $derived.by(() => {
        const actions: GameAction[] = gameSession.actions
        try {
            let state = gameSession.gameState.dehydrate() as StellarVenturesGameState
            for (let i = actions.length - 1; i >= 0; i--) {
                const action = actions[i]!
                if (corporationByActionId.has(action.id)) break
                if (!action.undoPatch) break
                state = engine.undoProcessedAction({ action, state })
                corporationByActionId.set(action.id, actingCorporation(state))
            }
        } catch (error) {
            console.warn('Could not work out Corporations for History', error)
        }
        return new Map(corporationByActionId)
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

    // The sentence after the player's name. Credits use the "₮" placeholder, which CreditsText
    // swaps for the game's own currency symbol. Hex IDs and internal metadata never appear.
    function describe(action: Record<string, unknown>): string {
        const corp = corporationName(
            action['corporationId'] ?? corporations.get(String(action['id']))
        )
        const forCorp = corp ? ` for ${corp}` : ''
        const metadata = (action['metadata'] ?? {}) as Record<string, unknown>
        const amount = typeof action['amount'] === 'number' ? action['amount'] : undefined

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
            case ActionType.ExpandNetwork:
                return `built an Outpost${forCorp}`
            case ActionType.CreateWormhole:
                return `created a Wormhole${forCorp}`
            case ActionType.DeclineExpandNetworkOrWormhole:
                return `chose not to build${forCorp}`
            case ActionType.FinishExpansion:
                return `finished building${forCorp}`
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
                return `boosted CARGO +${amount ?? 0}${forCorp}`
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
            case ActionType.PassInvestorAction:
            case ActionType.PassAlienTechAction:
                return 'passed'
            default:
                return `used ${formatType(String(action['type']))}${forCorp}`
        }
    }
</script>

<div class="h-full overflow-y-auto px-3 py-2 text-[#e6e9f5]">
    <ol class="relative ms-1.5 border-s border-[#3a4166]">
        {#each items as action (action.id)}
            {@const record = action as unknown as Record<string, unknown>}
            <li class="mb-3 ms-4">
                <div
                    class="absolute -start-1.5 mt-1 h-3 w-3 rounded-full border border-[#0b0e1a] bg-[#2f6fed]"
                ></div>
                <div class="text-[11px] text-[#7f88ad]">
                    {action.createdAt ? timeAgo.format(action.createdAt) : ''}
                </div>
                <div class="text-sm leading-snug">
                    {#if action.playerId}
                        <PlayerName playerId={action.playerId} />
                        <CreditsText text={describe(record)} />
                    {:else}
                        <span class="text-[#aeb5d6]">{formatType(action.type)}</span>
                    {/if}
                </div>
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
