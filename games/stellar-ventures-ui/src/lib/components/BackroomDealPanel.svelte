<script lang="ts">
    import {
        ActionType,
        CorporatePowerId,
        BackroomDealDirection,
        BACKROOM_DEAL_MINING_CAPACITY_DELTA
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CorporationDisplayNames } from '$lib/utils/corporationDisplay.js'
    import DividendChartPanel from './DividendChartPanel.svelte'

    // Backroom Deal (Corporate Power Glossary, page 29): "Liquidation, One-Time (before Hostile
    // Takeover). Move the Alien Mining Capacity up or down by one row" (confirmed by the
    // co-designer: 1 row = +/-3, see actions/backroomDeal.ts). Offered once, right at the start
    // of Liquidation, to the President of whichever Corporation holds it - never a player choice
    // of *which* Corporation or *how much*, only which direction (or decline outright) - so,
    // like Sign The Agreement/Secret Agents before it, this panel is mounted for everyone by
    // ActionPanel.svelte (state.machineState === Liquidation && !backroomDealResolved) but only
    // actionable for that one President; everyone else just watches them decide.
    //
    // Per the co-designer's spec, the whole decision plays out on the Dividend Chart itself
    // rather than a separate box UI: the Alien Mining Capacity marker glows (reusing Hostile
    // Takeover's own highlightAlienMiningMarker technique - see DividendChartPanel.svelte);
    // clicking it reveals the two rows it could move to (+/-BACKROOM_DEAL_MINING_CAPACITY_DELTA,
    // floor-clamped at 0, matching the engine's own clamp exactly); clicking one of those submits
    // that direction. `revealed` is purely local pacing (nothing has been submitted yet, and
    // nothing here is a "reveal" of already-decided game state, unlike Sign The
    // Agreement/Hostile Takeover's own reveals) - not stored on gameSession, since there's
    // nothing here that needs to survive a state update the way those two do.
    const gameSession = getGameSession()

    const corporation = $derived(
        gameSession.gameState.corporations.find((corporation) =>
            corporation.hasActivePower(CorporatePowerId.BackroomDeal)
        )
    )
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    const canBackroomDeal = $derived(gameSession.validActionTypes.includes(ActionType.BackroomDeal))
    const canDecline = $derived(
        gameSession.validActionTypes.includes(ActionType.DeclineBackroomDeal)
    )

    let revealed = $state(false)

    const currentMiningCapacity = $derived(gameSession.gameState.alienCorporation.miningCapacity)
    const targetCapacities = $derived(
        revealed
            ? [
                  Math.max(0, currentMiningCapacity - BACKROOM_DEAL_MINING_CAPACITY_DELTA),
                  currentMiningCapacity + BACKROOM_DEAL_MINING_CAPACITY_DELTA
              ]
            : []
    )

    function reveal() {
        revealed = true
    }

    async function chooseTarget(targetMiningCapacity: number) {
        const direction =
            targetMiningCapacity > currentMiningCapacity
                ? BackroomDealDirection.Up
                : BackroomDealDirection.Down
        revealed = false
        await gameSession.backroomDeal(direction)
    }

    async function decline() {
        revealed = false
        await gameSession.declineBackroomDeal()
    }
</script>

<div class="flex h-full flex-col text-[#e6e9f5]">
    <div class="px-4 pt-3 text-center">
        <div class="text-sm font-semibold">Backroom Deal</div>
        {#if isMe && (canBackroomDeal || canDecline)}
            <div class="mt-1 text-xs text-[#a8b0d6]">
                {#if !revealed}
                    Apply to move the Alien Mining Capacity, or decline.
                {:else}
                    Choose a row to move the Alien Mining Capacity to, or decline.
                {/if}
            </div>
        {:else}
            <div class="mt-1 text-xs text-[#7f88ad]">
                Waiting on {corporation
                    ? CorporationDisplayNames[corporation.id]
                    : 'the'}'s President to resolve Backroom Deal...
            </div>
        {/if}
    </div>

    {#if isMe && (canBackroomDeal || canDecline)}
        <!-- Buttons live right under the header, above the chart, rather than below it - the
             chart's own tall aspect-ratio box can run past the visible frame, which is exactly
             what pushed this row down and off-screen (overlapping whatever renders below this
             panel) before. Apply does the same thing clicking the glowing Alien marker itself
             already does (reveal() - see above); it's just a second, more discoverable way in,
             per the co-designer's spec for the first view. Once revealed, Apply's job is done
             (the two chart markers take over choosing a direction), so only Decline remains. -->
        <div class="flex justify-center gap-2 px-4 pb-2 pt-2">
            {#if !revealed}
                <button
                    type="button"
                    onclick={reveal}
                    disabled={!canBackroomDeal}
                    class="rounded-md bg-[#2f6fed] px-4 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Apply
                </button>
            {/if}
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

    <div class="min-h-0 flex-1">
        <DividendChartPanel
            highlightAlienMiningMarker={isMe && !revealed}
            alienMiningMarkerClickable={isMe && !revealed}
            onAlienMiningMarkerClick={reveal}
            backroomDealTargetCapacities={isMe ? targetCapacities : []}
            onSelectBackroomDealTarget={chooseTarget}
        />
    </div>

    {#if gameSession.lastActionError}
        <div class="px-4 pb-2 text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
    {/if}
</div>
