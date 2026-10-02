<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, type CorporationId } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import CreditsText from './CreditsText.svelte'

    const gameSession = getGameSession()

    const actions = $derived(gameSession.actions)

    // "ExpandNetwork" -> "Expand Network".
    function formatType(type: string) {
        return type.replace(/([a-z])([A-Z])/g, '$1 $2')
    }

    function corporationName(id: unknown): string | undefined {
        return typeof id === 'string' ? CorporationDisplayNames[id as CorporationId] : undefined
    }

    function credits(amount: unknown): string | undefined {
        return typeof amount === 'number' ? `₮${amount}` : undefined
    }

    // One short, readable line per action. Credits are written with the "₮" placeholder, which
    // CreditsText swaps for the game's own currency symbol. Hex IDs, internal metadata and other
    // bookkeeping fields are left out entirely.
    function details(action: Record<string, unknown>): string | undefined {
        const corporation = corporationName(action['corporationId'])
        const metadata = (action['metadata'] ?? {}) as Record<string, unknown>
        const parts: (string | undefined)[] = []

        switch (action['type']) {
            case ActionType.PlaceBid:
            case ActionType.PlaceShareBid:
                parts.push(corporation, credits(action['amount']))
                break
            case ActionType.PlaceBoardroomVote:
                parts.push(
                    corporation,
                    typeof action['amount'] === 'number'
                        ? `${action['amount']} vote${action['amount'] === 1 ? '' : 's'}`
                        : undefined
                )
                break
            case ActionType.CargoBoost:
                parts.push(
                    corporation,
                    typeof action['amount'] === 'number' ? `+${action['amount']} CARGO` : undefined
                )
                break
            case ActionType.Launder:
                parts.push(
                    typeof action['amount'] === 'number'
                        ? `${action['amount']} Alien Tech`
                        : undefined
                )
                break
            case ActionType.PayDividends:
                parts.push(
                    corporation,
                    typeof action['payoutPerShare'] === 'number'
                        ? `${credits(action['payoutPerShare'])} per Share`
                        : undefined
                )
                break
            case ActionType.PayTax:
                parts.push(
                    corporation,
                    credits(metadata['amount']),
                    typeof metadata['loans'] === 'number' && metadata['loans'] > 0
                        ? `${metadata['loans']} loan${metadata['loans'] === 1 ? '' : 's'}`
                        : undefined
                )
                break
            case ActionType.TaxAgentsTakeFromTaxBox:
                parts.push(
                    corporation,
                    metadata['amount'] !== undefined
                        ? `${credits(metadata['amount'])} from the Tax Box`
                        : undefined
                )
                break
            case ActionType.OrderShip:
                parts.push(
                    corporation,
                    typeof action['level'] === 'number' ? `Level ${action['level']}` : undefined
                )
                break
            case ActionType.BackroomDeal:
                parts.push(
                    action['direction'] === 'up'
                        ? 'Alien Mining Capacity up'
                        : action['direction'] === 'down'
                          ? 'Alien Mining Capacity down'
                          : undefined
                )
                break
            default:
                parts.push(corporation)
                if (typeof action['powerId'] === 'string') {
                    parts.push(CorporatePowerDisplayNames[action['powerId']] ?? undefined)
                }
                if (typeof action['shipLevel'] === 'number') {
                    parts.push(`Level ${action['shipLevel']}`)
                }
        }

        const text = parts.filter((part): part is string => !!part).join(' · ')
        return text.length > 0 ? text : undefined
    }
</script>

<div class="h-full overflow-y-auto p-3 text-[#e6e9f5]">
    {#if actions.length === 0}
        <div class="text-xs text-[#7f88ad]">No actions yet.</div>
    {:else}
        <ol class="space-y-1">
            {#each actions as action (action.id)}
                {@const line = details(action as unknown as Record<string, unknown>)}
                <li class="rounded-md bg-black/20 px-2.5 py-1.5 text-xs leading-snug">
                    <div class="flex items-baseline justify-between gap-2">
                        <span class="font-semibold">{formatType(action.type)}</span>
                        <span class="shrink-0 text-[#7f88ad]">
                            {#if action.playerId}
                                <PlayerName playerId={action.playerId} />
                            {:else}
                                Game
                            {/if}
                        </span>
                    </div>
                    {#if line}
                        <div class="mt-0.5 flex items-center gap-0.5 text-[#aeb5d6]">
                            <CreditsText text={line} />
                        </div>
                    {/if}
                </li>
            {/each}
        </ol>
    {/if}
</div>
