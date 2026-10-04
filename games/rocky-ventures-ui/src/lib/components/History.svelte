<script lang="ts">
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { ActionType, BoardNodesById, CompanyId } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Same shape as the other Board Together games' History (e.g. Kaivai): newest first on a
    // timeline, each entry a short "<player> did something" sentence with how long ago it was,
    // and "The game was started" at the very bottom. Internal ids never appear.
    const timeAgo = createTimeAgo()
    const gameSession = getGameSession()

    const items = $derived(gameSession.actions.toReversed())

    const CompanyNames: Record<CompanyId, string> = {
        [CompanyId.WizardCannonball]: 'Wizard Cannonball',
        [CompanyId.DwarvenPacific]: 'Dwarven Pacific',
        [CompanyId.GoblinCentral]: 'Goblin Central',
        [CompanyId.WingedWyrm]: 'Winged Wyrm'
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

    function plural(count: number, word: string) {
        return `${count} ${word}${count === 1 ? '' : 's'}`
    }

    // The sentence after the player's name.
    function describe(action: Record<string, unknown>): string {
        const their = action['playerId'] === gameSession.myPlayer?.id ? 'your' : 'their'
        const company = companyName(action['companyId'])
        const forCompany = company ? ` for ${company}` : ''

        switch (action['type']) {
            case ActionType.MovePawn:
                return `moved ${their} pawn`
            case ActionType.Tax:
                return 'collected taxes'
            case ActionType.Invest:
                return 'invested'
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
                return mine ? `claimed the ${mine} mine` : 'claimed a mine'
            }
            case ActionType.LayTrack:
                return `laid track${forCompany}`
            case ActionType.LayFreeTrack:
                return `laid free track${forCompany}`
            case ActionType.ExtractAndSell: {
                const mine = placeName(action['nodeId'])
                const city = placeName(action['cityId'])
                const credit = companyName(action['creditCompanyId'])
                return [
                    mine ? `extracted from ${mine}` : 'extracted and sold',
                    city ? `to ${city}` : undefined,
                    credit ? `via ${credit}` : undefined
                ]
                    .filter(Boolean)
                    .join(' ')
            }
            case ActionType.Hunt:
                return 'went hunting'
            case ActionType.ResolveHunt:
                return 'resolved the hunt'
            case ActionType.Acquire:
                return action['choice'] === 'tool' ? 'acquired a tool' : 'acquired a weapon'
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
            {#each items as action (action.id)}
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
                            {describe(action as unknown as Record<string, unknown>)}
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
