<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionType,
        TOTAL_SHIP_COLUMNS,
        MAX_CARGO,
        shipCost,
        totalShipCount,
        effectiveMiningCapacityForCorporation,
        dividendPayoutPerShare,
        loansNeededForShip,
        loanHexesNeeded,
        LoanCreditPerLoan
    } from '@tabletop/stellar-ventures'
    import { CorporationDisplayNames, CHARTER_ASPECT } from '$lib/utils/corporationDisplay.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShipyardPanel from './ShipyardPanel.svelte'
    import CorporationCharterWithPowers from './CorporationCharterWithPowers.svelte'
    import CorporationInfoBox from './CorporationInfoBox.svelte'
    import LeakedResearchConfirmPanel from './LeakedResearchConfirmPanel.svelte'

    const gameSession = getGameSession()

    const corporationId = $derived(gameSession.gameState.activeCorporationId)
    const corporation = $derived(
        corporationId ? gameSession.gameState.getCorporation(corporationId) : undefined
    )
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    const canOrder = $derived(gameSession.validActionTypes.includes(ActionType.OrderShip))
    const canDecline = $derived(gameSession.validActionTypes.includes(ActionType.DeclineOrderShips))

    // Leaked Research (Corporate Power Glossary, page 29) - a free Research Wormhole for this
    // Corporation, offered alongside Order Ships for the rest of this Corporation's turn. No
    // target picker needed (this Corporation is the only eligible target), but per the
    // co-designer clicking the button brings up the Power Tile first (leakedResearchConfirming)
    // rather than submitting immediately - see LeakedResearchConfirmPanel.svelte.
    const canLeakedResearch = $derived(gameSession.validActionTypes.includes(ActionType.LeakedResearch))
    let leakedResearchConfirming = $state(false)

    async function confirmLeakedResearch() {
        leakedResearchConfirming = false
        if (!corporationId) return
        await gameSession.leakedResearch(corporationId)
    }

    $effect(() => {
        if (leakedResearchConfirming && !canLeakedResearch) {
            leakedResearchConfirming = false
        }
    })

    // Every other option this step allows now has its own controls (Order Ship, Decline, Forced
    // Ship Purchase, Leaked Research above/below) - this generic fallback is kept around for
    // whatever's left, currently nothing.
    const otherActionTypes = $derived(
        gameSession.validActionTypes.filter(
            (actionType) =>
                actionType !== ActionType.OrderShip &&
                actionType !== ActionType.DeclineOrderShips &&
                actionType !== ActionType.ForcedShipPurchase &&
                actionType !== ActionType.LeakedResearch
        )
    )

    // Forced Purchase's own "No Credits?" Loans (rulebook pages 16-17 & 25) - offered only when
    // this Corporation has no Ships at all AND can't afford even the cheapest currently-
    // available one (every other case is plain OrderShip's job - see
    // operations/shipOrdering.ts's isForcedShipPurchase/canAffordNextShip, mirrored here for
    // display rather than re-derived from validActionTypes, which only says whether it's legal,
    // not how many Loans/Outposts it needs).
    const canForcePurchase = $derived(gameSession.validActionTypes.includes(ActionType.ForcedShipPurchase))
    const forcePurchaseSection = $derived(gameSession.gameState.shipyard.lowestAvailableSection())
    const forcePurchaseLoans = $derived(
        corporation && forcePurchaseSection
            ? loansNeededForShip(corporation, forcePurchaseSection.level)
            : 0
    )
    const forcePurchaseHexesNeeded = $derived(
        corporation ? loanHexesNeeded(corporation, forcePurchaseLoans) : 0
    )
    const forcedShipPurchaseActive = $derived(gameSession.boardActionMode === ActionType.ForcedShipPurchase)
    const forcedShipPurchaseSelectedCount = $derived(gameSession.forcedShipPurchaseHexIds.length)

    // A single click resolves it immediately when the Corporation's still-unbuilt Outpost
    // supply alone covers every Loan needed (the common case - no board interaction required);
    // otherwise this starts the same "pick hexes, then Confirm" flow Develop Planet(s) uses,
    // scoped to exactly forcePurchaseHexesNeeded Outposts (Board.svelte's own
    // canForcedShipPurchase/toggleForcedShipPurchaseHex).
    function startForcePurchase() {
        if (forcePurchaseHexesNeeded === 0) {
            void gameSession.forcedShipPurchase([])
        } else {
            gameSession.boardActionMode = ActionType.ForcedShipPurchase
        }
    }

    async function confirmForcedShipPurchase() {
        await gameSession.forcedShipPurchase(gameSession.forcedShipPurchaseHexIds)
    }

    function cancelForcedShipPurchase() {
        gameSession.cancelForcedShipPurchase()
    }

    let chosenActionType: ActionType | undefined = $state()
    let payloadText = $state('{}')
    let parseError: string | undefined = $state()

    function chooseAction(actionType: string) {
        chosenActionType = actionType as ActionType
        payloadText = '{}'
        parseError = undefined
    }

    function cancelOther() {
        chosenActionType = undefined
        parseError = undefined
    }

    async function submitOther() {
        if (!chosenActionType) return

        let payload: Record<string, unknown>
        try {
            payload = JSON.parse(payloadText || '{}')
        } catch {
            parseError = 'Payload must be valid JSON'
            return
        }

        parseError = undefined
        const actionType = chosenActionType
        chosenActionType = undefined
        await gameSession.submitGenericAction(actionType, payload)
    }

    // Clicking a Ship in the Shipyard picker orders it immediately - one real OrderShip action per
    // click (the engine has no bulk "order several" action - see actions/orderShip.ts), which the
    // President can Undo like any other action. The one thing Undo can't take back is a section's
    // first-ever Ship flipping its still-hidden Alien Shipyard tile face up (secret information -
    // see resolveFirstShipOrderedEffects, which flags that action as beyond Undo), so ONLY that
    // click asks for a confirmation first (confirmingFlipLevel below).
    let ordering = $state(false)
    let confirmingFlipLevel: number | undefined = $state()

    // CARGO still incoming - every Ship level currently sitting in Ordered but not yet
    // Delivered (deliverOrderedShips only runs at the next Administration Round), clamped exactly
    // like deliverOrderedShips itself clamps CARGO at MAX_CARGO, so this never promises more than
    // Delivery will actually pay out.
    const pendingCargoLevelsSum = $derived(
        corporation?.orderedShipLevels.reduce((sum, level) => sum + level, 0) ?? 0
    )
    const incomingCargo = $derived(
        corporation ? Math.min(MAX_CARGO, corporation.cargo + pendingCargoLevelsSum) - corporation.cargo : 0
    )

    // Dividend preview: what this Corporation pays per Share right now vs. what it would pay
    // once every Ship already Ordered gets Delivered next Administration Round. Mining Capacity
    // doesn't move from ordering Ships, so only Cargo's side of the comparison changes here -
    // futureCargo is the same clamped total incomingCargo is built from, just expressed as an
    // absolute Cargo value instead of a delta.
    const miningCapacity = $derived(
        corporationId ? effectiveMiningCapacityForCorporation(gameSession.gameState, corporationId) : 0
    )
    const currentPayout = $derived(
        corporation ? dividendPayoutPerShare(corporation.cargo, miningCapacity, corporation.status) : 0
    )
    const futureCargo = $derived(
        corporation ? Math.min(MAX_CARGO, corporation.cargo + pendingCargoLevelsSum) : 0
    )
    const futurePayout = $derived(
        corporation ? dividendPayoutPerShare(futureCargo, miningCapacity, corporation.status) : 0
    )

    // Ships can only be Ordered from the Shipyard's current lowest available level, while the
    // Charter still has an empty column and the Treasury covers it - mirrors
    // shipyard.lowestAvailableSection()/canOrderAnotherShip().
    const lowestSection = $derived(gameSession.gameState.shipyard.lowestAvailableSection())
    const canOrderMore = $derived(
        isMe &&
            canOrder &&
            !!corporation &&
            TOTAL_SHIP_COLUMNS - totalShipCount(corporation) > 0 &&
            lowestSection !== undefined &&
            corporation.treasury >= shipCost(lowestSection.level)
    )
    const canOrderAnother = $derived(!ordering && canOrderMore)

    // True when ordering the Ship at this level would flip a still-hidden Alien Shipyard tile.
    function wouldFlipHiddenTile(level: number): boolean {
        const section = gameSession.gameState.shipyard.sectionForLevel(level)
        return (
            !!section && !section.firstShipOrdered && section.alienTileChevrons !== undefined
        )
    }

    function selectShip() {
        if (!canOrderAnother || !lowestSection) return
        const level = lowestSection.level
        if (wouldFlipHiddenTile(level)) {
            confirmingFlipLevel = level
            return
        }
        return orderNow(level)
    }

    async function confirmFlipOrder() {
        const level = confirmingFlipLevel
        confirmingFlipLevel = undefined
        if (level === undefined || !canOrderAnother || lowestSection?.level !== level) return
        await orderNow(level)
    }

    // Once nothing more can be ordered (no Charter column left, or no Ship the Treasury covers)
    // there's nothing left to confirm - move straight on to Declining (ending this step) rather
    // than making the President click "Done Ordering Ships" separately.
    async function orderNow(level: number) {
        if (ordering) return
        ordering = true
        try {
            const beforeCount = corporation ? totalShipCount(corporation) : 0
            await gameSession.orderShip(level)
            const afterCount = corporation ? totalShipCount(corporation) : 0
            // Confirm the order actually landed (rather than trusting the absence of
            // lastActionError alone - a silently-ignored, no-longer-valid action leaves it
            // untouched) before deciding whether the step is finished.
            if (!gameSession.lastActionError && afterCount > beforeCount && !canOrderMore && canDecline) {
                await gameSession.declineOrderShips()
            }
        } finally {
            ordering = false
        }
    }

    // The confirmation only makes sense for the Ship it was asked about - drop it if the situation
    // moved on (turn ended, or a different level is now the orderable one).
    $effect(() => {
        if (
            confirmingFlipLevel !== undefined &&
            (!canOrderMore || lowestSection?.level !== confirmingFlipLevel)
        ) {
            confirmingFlipLevel = undefined
        }
    })

    async function stopOrdering() {
        await gameSession.declineOrderShips()
    }
</script>

{#if corporationId}
    <div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
        <div class="text-sm">
            {#if presidentId}
                <PlayerName playerId={presidentId} />
            {/if}
            is ordering Ships for
            <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span>
        </div>

        <!-- Both children get their width fixed here, on a definite-width flex container,
             rather than each sizing itself internally - a percentage width inside ShipyardPanel
             (compact mode) or the Charter div would otherwise resolve against that component's
             own root element, which has no definite width of its own as a bare flex child. On
             mobile this stacks instead of sitting side-by-side - the 75% column made the
             5-column Shipyard grid and its Purchase Ships/Clear buttons uncomfortably cramped
             on a phone width, so it goes full-width there and only splits into columns at sm+. -->
        <div class="flex flex-col sm:flex-row items-start gap-3">
            <div class="w-full sm:w-[75%] space-y-2">
                <ShipyardPanel
                    compact
                    orderableLevel={canOrderAnother ? lowestSection?.level : undefined}
                    onSelectShip={selectShip}
                    needsConfirmation={wouldFlipHiddenTile}
                />

                {#if confirmingFlipLevel !== undefined}
                    <!-- The one purchase Undo can't take back: the first Ship out of a section
                         flips that section's hidden Alien Shipyard tile face up for everyone. -->
                    <div
                        class="space-y-1.5 rounded-md border border-[#e0b23d] bg-[#2a2410] p-2 text-xs"
                        role="alertdialog"
                        aria-label="Confirm buying a Ship that reveals an Alien Shipyard tile"
                    >
                        <div>
                            Buying the first Level {confirmingFlipLevel} Ship flips its Alien Shipyard tile
                            face up for everyone.
                            <span class="font-semibold">This can't be undone.</span>
                        </div>
                        <div class="flex gap-1.5">
                            <button
                                type="button"
                                onclick={confirmFlipOrder}
                                class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa]"
                            >
                                Buy Ship
                            </button>
                            <button
                                type="button"
                                onclick={() => (confirmingFlipLevel = undefined)}
                                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                {/if}

                <!-- Same Treasury card Expand Network shows (each Ship is paid for the moment it
                     is clicked, so there is no pending cost to preview). No Mining Capacity
                     here - Ships don't affect it, but CARGO does:
                     cargoGain previews what Delivery will eventually add (see incomingCargo
                     above). Sized to match the Shipyard above it (both share this 75% column)
                     rather than the full width of the panel, so it reads as belonging to the
                     Shipyard specifically. -->
                {#if corporation}
                    <CorporationInfoBox
                        {corporationId}
                        treasury={corporation.treasury}
                        cargo={corporation.cargo}
                        cargoGain={incomingCargo}
                        {currentPayout}
                        {futurePayout}
                    >
                        <!-- Forced Purchase's own "No Credits?" Loans (rulebook pages 16-17 &
                             25) - this Corporation has no Ships and can't afford one outright,
                             so clicking a Ship can't buy anything; this button does instead. -->
                        {#if canForcePurchase}
                            <button
                                type="button"
                                disabled={forcedShipPurchaseActive}
                                onclick={startForcePurchase}
                                class="rounded-md bg-[#2f6fed] px-2.5 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-50"
                            >
                                Force Purchase{#if forcePurchaseLoans > 0}
                                    ({forcePurchaseLoans} Loan{forcePurchaseLoans === 1 ? '' : 's'})
                                {/if}
                            </button>
                        {/if}
                    </CorporationInfoBox>
                {/if}
            </div>

            <!-- Once Force Purchase needs specific Outposts pulled off the board (unbuilt supply
                 alone doesn't cover every Loan needed - see forcePurchaseHexesNeeded), this takes
                 over the same "pick hexes on the board, then confirm as one batch" pattern
                 AlienTechActionPanel's own Develop Planet(s) box uses - Board.svelte's own
                 canForcedShipPurchase/toggleForcedShipPurchaseHex does the actual hex toggling;
                 this box just tracks the running count plus Confirm/Cancel. -->
            {#if forcedShipPurchaseActive}
                <div class="space-y-1.5 rounded-md border border-[#3a4166] bg-[#141833] p-2 text-xs">
                    <div>
                        Select {forcePurchaseHexesNeeded} Outpost{forcePurchaseHexesNeeded === 1
                            ? ''
                            : 's'} on the board to send to the Loan Box ({forcedShipPurchaseSelectedCount}/{forcePurchaseHexesNeeded}
                        selected).
                    </div>
                    <div class="flex gap-1.5 pt-1">
                        <button
                            type="button"
                            disabled={forcedShipPurchaseSelectedCount !== forcePurchaseHexesNeeded}
                            onclick={confirmForcedShipPurchase}
                            class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-40"
                        >
                            Confirm
                        </button>
                        <button
                            type="button"
                            onclick={cancelForcedShipPurchase}
                            class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            {/if}

            <!-- A small Corporation Charter, showing this Corporation's own Ordered Ships
                 tracker - so ordering a Ship visually reads as moving it from the Shipyard here,
                 into the first open column's ordered (top-row) slot, rather than just vanishing
                 into an abstract count. -->
            <div class="relative" style="width: 25%; aspect-ratio: {CHARTER_ASPECT};">
                <CorporationCharterWithPowers {corporationId} />
            </div>
        </div>

        {#if !isMe}
            <div class="text-xs text-[#7f88ad]">
                Waiting on {#if presidentId}<PlayerName playerId={presidentId} />{:else}the President{/if}
                to order Ships...
            </div>
        {/if}

        <!-- Hidden while an order is going through (which can end in an auto-Decline once nothing
             more can be ordered) - otherwise this would flash on screen and be clickable during
             that brief round-trip. -->
        {#if isMe && canDecline && !ordering}
            <button
                type="button"
                onclick={stopOrdering}
                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1.5 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
            >
                Done Ordering Ships
            </button>
        {/if}

        {#if isMe && canLeakedResearch && !ordering && !leakedResearchConfirming}
            <button
                type="button"
                onclick={() => (leakedResearchConfirming = true)}
                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1.5 text-xs font-semibold hover:border-[#2f6fed] hover:bg-[#212845]"
            >
                Leaked Research
            </button>
        {/if}

        {#if leakedResearchConfirming && corporationId}
            <LeakedResearchConfirmPanel
                {corporationId}
                onConfirm={confirmLeakedResearch}
                onCancel={() => (leakedResearchConfirming = false)}
            />
        {/if}

        {#if isMe && otherActionTypes.length > 0 && !ordering}
            <div class="border-t border-[#232945] pt-2">
                {#if !chosenActionType}
                    <div class="flex flex-wrap gap-1.5">
                        {#each otherActionTypes as actionType (actionType)}
                            <button
                                type="button"
                                onclick={() => chooseAction(actionType)}
                                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2 py-1 text-xs hover:bg-[#262c4d]"
                            >
                                {actionType}
                            </button>
                        {/each}
                    </div>
                {:else}
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between text-xs">
                            <span class="font-semibold">{chosenActionType}</span>
                            <button type="button" onclick={cancelOther} class="text-[#7f88ad] hover:text-white">
                                cancel
                            </button>
                        </div>
                        <textarea
                            bind:value={payloadText}
                            rows="3"
                            spellcheck="false"
                            class="w-full rounded-md border border-[#3a4166] bg-[#10142a] px-2 py-1 font-mono text-xs text-[#e6e9f5]"
                        ></textarea>
                        {#if parseError}
                            <div class="text-xs text-[#e0343a]">{parseError}</div>
                        {/if}
                        <button
                            type="button"
                            onclick={submitOther}
                            class="rounded-md bg-[#2f6fed] px-3 py-1 text-xs font-semibold hover:bg-[#3f7dfa]"
                        >
                            Submit
                        </button>
                    </div>
                {/if}
            </div>
        {/if}

        {#if gameSession.lastActionError}
            <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
        {/if}
    </div>
{/if}
