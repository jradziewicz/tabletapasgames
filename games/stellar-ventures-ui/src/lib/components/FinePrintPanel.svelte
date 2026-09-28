<script lang="ts">
    import { ActionType, CorporatePowerId } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import { CorporatePowerBackImages, POWER_CARD_ASPECT } from '$lib/utils/corporatePowerImages.js'
    import CorporationBadge from './CorporationBadge.svelte'

    // Fine Print (Corporate Power Glossary, page 29): "Investor Round, One-Time. Before
    // Boardroom Battle begins, discard to prevent any Votes being placed on this Corporation
    // (and it can't be forced to Issue a Share) during that specific Boardroom Battle." Offered
    // once, right at the start of every fresh Boardroom Battle, to the President of whichever
    // Corporation holds it - same "mounted for everyone by ActionPanel.svelte but only
    // actionable for that one President" treatment as Backroom Deal/Deep Space Smuggling before
    // it, but simpler than either: no target to pick, no chart, just the Power's own tile art
    // and a plain Apply/Decline - per the co-designer's spec, no text at all (the tile art
    // already says what it does; the buttons say what clicking them does).
    const gameSession = getGameSession()

    const corporation = $derived(
        gameSession.gameState.corporations.find((corporation) =>
            corporation.hasActivePower(CorporatePowerId.FinePrint)
        )
    )
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    const canFinePrint = $derived(gameSession.validActionTypes.includes(ActionType.FinePrint))
    const canDecline = $derived(gameSession.validActionTypes.includes(ActionType.DeclineFinePrint))

    async function apply() {
        await gameSession.finePrint()
    }

    async function decline() {
        await gameSession.declineFinePrint()
    }
</script>

<div class="flex h-full flex-col items-center justify-center gap-3 py-3 text-[#e6e9f5]">
    {#if corporation}
        <div class="flex w-[10.35rem] flex-col items-center gap-2">
            <CorporationBadge corporationId={corporation.id} />
            <img
                src={CorporatePowerBackImages[CorporatePowerId.FinePrint] ?? ''}
                alt={CorporatePowerDisplayNames[CorporatePowerId.FinePrint]}
                class="block w-full rounded-md shadow-lg"
                style="aspect-ratio: {POWER_CARD_ASPECT};"
            />
        </div>
    {/if}

    {#if isMe && (canFinePrint || canDecline)}
        <div class="flex justify-center gap-2">
            <button
                type="button"
                onclick={apply}
                disabled={!canFinePrint}
                class="rounded-md bg-[#2f6fed] px-4 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa] disabled:cursor-not-allowed disabled:opacity-50"
            >
                Apply
            </button>
            <button
                type="button"
                onclick={decline}
                disabled={!canDecline}
                class="rounded-md bg-[#5a6178] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6b7290] disabled:cursor-not-allowed disabled:opacity-50"
            >
                Decline
            </button>
        </div>
    {/if}

    {#if gameSession.lastActionError}
        <div class="px-4 text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
    {/if}
</div>
