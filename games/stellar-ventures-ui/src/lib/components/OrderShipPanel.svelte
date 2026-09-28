<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { ShipyardSection } from '@tabletop/stellar-ventures'
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

    // Clicking a Ship in the Shipyard picker only QUEUES it - it doesn't submit anything yet.
    // The President can keep clicking to queue several Ships in a row (up to the Charter's own
    // empty-column limit), each one immediately "moving over" to the Charter as a staged preview
    // (see the Charter markup below), and only when they click "Purchase Ships" does anything
    // actually get submitted - as one real OrderShip action per queued Ship, in the order they
    // were picked. A real Order Ship is real money, and for a section's first-ever Ship it also
    // flips that section's Alien Shipyard Tile (irreversibly revealing secret information), so
    // neither should happen while the President might still change their mind about the rest of
    // the queue.
    let selectedLevels: number[] = $state([])

    // Declared up here (rather than alongside frozenSections/frozenStagedCountByLevel, below,
    // next to purchaseShips itself) purely so canQueueAnother above can reference it - a $derived
    // callback only actually runs after the whole component has finished setting up, so this
    // ordering makes no difference at runtime, but svelte-check's TypeScript analysis still flags
    // a `let` referenced above its textual declaration as used-before-assignment regardless.
    let purchasing = $state(false)

    // CARGO still incoming - every Ship level currently sitting in Ordered but not yet
    // Delivered (deliverOrderedShips only runs at the next Administration Round), plus whatever
    // this President is queuing up right now (selectedLevels, below) - clamped exactly like
    // deliverOrderedShips itself clamps CARGO at MAX_CARGO, so this never promises more than
    // Delivery will actually pay out.
    const pendingCargoLevelsSum = $derived(
        (corporation?.orderedShipLevels.reduce((sum, level) => sum + level, 0) ?? 0) +
            selectedLevels.reduce((sum, level) => sum + level, 0)
    )
    const incomingCargo = $derived(
        corporation ? Math.min(MAX_CARGO, corporation.cargo + pendingCargoLevelsSum) - corporation.cargo : 0
    )

    // Dividend preview: what this Corporation pays per Share right now vs. what it would pay
    // once every Ship in the queue above actually gets Delivered next Administration Round.
    // Mining Capacity doesn't move from ordering Ships, so only Cargo's side of the comparison
    // changes here - futureCargo is the same clamped total incomingCargo is built from, just
    // expressed as an absolute Cargo value instead of a delta.
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

    // How much of each Ship level's own supply the current queue has already spoken for, and
    // what the Shipyard's own treasury has left to spend on the rest of it - both computed
    // entirely client-side from the REAL (not-yet-submitted-against) Shipyard/treasury, since
    // nothing in the queue is real until Purchase Ships runs. Mirrors
    // shipyard.lowestAvailableSection()/canOrderAnotherShip() exactly, just against these
    // simulated numbers instead of the live ones.
    const realSections = $derived(gameSession.gameState.shipyard.sections)
    const stagedCountByLevel = $derived.by(() => {
        const counts: Record<number, number> = {}
        for (const level of selectedLevels) {
            counts[level] = (counts[level] ?? 0) + 1
        }
        return counts
    })
    const simulatedTreasury = $derived(
        (corporation?.treasury ?? 0) - selectedLevels.reduce((sum, level) => sum + shipCost(level), 0)
    )
    const simulatedLowestLevel = $derived.by(() => {
        for (const section of realSections) {
            if (section.unlimited) return section.level
            const staged = stagedCountByLevel[section.level] ?? 0
            if (section.remainingShips - staged > 0) return section.level
        }
        return undefined
    })
    // How many more Ships the queue has room for - the Charter's 3 columns, minus whatever's
    // already really Ordered/Delivered, minus whatever's already queued.
    const queueRoomLeft = $derived(
        corporation ? TOTAL_SHIP_COLUMNS - totalShipCount(corporation) - selectedLevels.length : 0
    )
    const canQueueAnother = $derived(
        !purchasing &&
            isMe &&
            canOrder &&
            queueRoomLeft > 0 &&
            simulatedLowestLevel !== undefined &&
            simulatedTreasury >= shipCost(simulatedLowestLevel)
    )

    function selectShip() {
        if (!canQueueAnother || simulatedLowestLevel === undefined) return
        selectedLevels = [...selectedLevels, simulatedLowestLevel]
    }

    function clearQueue() {
        if (purchasing) return
        selectedLevels = []
    }

    // Submitting the queue is a real OrderShip action per queued Ship, one at a time (the engine
    // has no bulk "order several" action - see actions/orderShip.ts) - awaited in order so each
    // one lands against the Shipyard/treasury state the previous one just left behind. While this
    // runs, the Shipyard picker is fed a frozen snapshot of its pre-purchase self (frozenSections)
    // rather than the live, updating-mid-batch one, so nothing - in particular no Alien Tile flip
    // - visibly changes there until the whole queue has gone through; only then does the real
    // (by-then-matching) live state take back over. If a submission ever fails partway (a race
    // against some other change), stop rather than keep firing the rest of a now-stale queue.
    //
    // frozenStagedCountByLevel freezes alongside frozenSections, for the same reason: selectedLevels
    // itself shrinks as each queued Ship's real OrderShip action lands (see the loop below), so the
    // LIVE stagedCountByLevel derived from it shrinks right along with it. Feeding that shrinking
    // count against the frozen (unchanging) section count would make a Ship that was just bought -
    // and had already visually "moved" to the Charter while queued - appear to jump back into the
    // Shipyard the instant its purchase confirms (remainingShips - stagedCount ticking back up
    // before the real, by-then-lower remainingShips ever takes back over), reading as though the
    // Shipyard had spawned an extra copy of the Ship just bought. Freezing both together keeps the
    // Shipyard's displayed count rock steady for the whole purchase, exactly as the comment above
    // promises.
    let frozenSections: ShipyardSection[] | undefined = $state(undefined)
    let frozenStagedCountByLevel: Record<number, number> | undefined = $state(undefined)

    // The queue must only ever grow from an explicit Shipyard click (selectShip, below) - it is
    // never legal for it to reflect anything else. An Undo is the one event that can invalidate
    // it out from under the President without their say-so: it can change the real Shipyard's
    // remaining stock, the real Treasury, or the real Charter's own empty-column room that the
    // queue's simulated numbers (stagedCountByLevel/simulatedTreasury/queueRoomLeft, above) were
    // computed against. Rather than try to reconcile a stale queue against a reality that moved
    // out from under it, drop it entirely the instant an Undo is detected and make the President
    // re-pick from the (by-then up to date) Shipyard - state.actionCount only ever grows during
    // normal play (gameState.ts's own applyAction), so it going backwards is Undo's own signature
    // (see gameEngine.ts's action loop / GameUndo's popAction-based reversal). This also covers a
    // teammate acting as this Corporation's President concurrently undoing on another device.
    let lastSeenActionCount = $state(gameSession.gameState.actionCount)
    let queueDroppedByUndo = false

    $effect(() => {
        const currentActionCount = gameSession.gameState.actionCount
        if (currentActionCount < lastSeenActionCount && selectedLevels.length > 0) {
            selectedLevels = []
            queueDroppedByUndo = true
        }
        lastSeenActionCount = currentActionCount
    })

    async function purchaseShips() {
        if (selectedLevels.length === 0 || purchasing) return
        purchasing = true
        frozenSections = JSON.parse(JSON.stringify(realSections))
        frozenStagedCountByLevel = { ...stagedCountByLevel }
        queueDroppedByUndo = false

        while (selectedLevels.length > 0) {
            const level = selectedLevels[0]!
            const beforeCount = corporation ? totalShipCount(corporation) : 0
            await gameSession.orderShip(level)
            const afterCount = corporation ? totalShipCount(corporation) : 0
            // Confirm the order actually landed (rather than trusting the absence of
            // lastActionError alone - a silently-ignored, no-longer-valid action leaves it
            // untouched) before treating this queued Ship as done and moving to the next one.
            // An Undo landing mid-loop (queueDroppedByUndo, above) already empties selectedLevels
            // itself, so the while condition below stops on its own the next time it's checked -
            // this just also skips the auto-Decline afterwards, since an Undo-emptied queue was
            // never actually finished by the President.
            if (gameSession.lastActionError || afterCount <= beforeCount || queueDroppedByUndo) {
                break
            }
            selectedLevels = selectedLevels.slice(1)
        }

        // Once every queued Ship has actually gone through, there's nothing left to confirm -
        // move straight on to Declining (ending this step) rather than making the President
        // click "Done Ordering Ships" separately afterwards. Skipped when the queue was instead
        // emptied out from under us by an Undo (queueDroppedByUndo) - that's not "done", it's the
        // queue being invalidated, and auto-Declining on top of that would end the step the
        // President never actually finished.
        if (
            selectedLevels.length === 0 &&
            !queueDroppedByUndo &&
            !gameSession.lastActionError &&
            canDecline
        ) {
            await gameSession.declineOrderShips()
        }

        frozenSections = undefined
        frozenStagedCountByLevel = undefined
        purchasing = false
    }

    // If the President's own turn ends (a different Corporation comes up, or they're no longer
    // the one ordering) before Purchase Ships was ever clicked, drop anything still just queued -
    // nothing real was ever submitted for it.
    $effect(() => {
        if (!purchasing && selectedLevels.length > 0 && (!isMe || !canOrder)) {
            selectedLevels = []
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
                    orderableLevel={canQueueAnother ? simulatedLowestLevel : undefined}
                    stagedCountByLevel={frozenStagedCountByLevel ?? stagedCountByLevel}
                    sectionsOverride={frozenSections}
                    onSelectShip={selectShip}
                />

                <!-- Same Treasury-with-a-live-cost-preview card Expand Network shows -
                     pendingCost here is the still-queued total (see
                     selectedLevels/purchaseShips above), not yet actually spent until Purchase
                     Ships runs. No Mining Capacity here - Ships don't affect it, but CARGO does:
                     cargoGain previews what Delivery will eventually add (see incomingCargo
                     above). Sized to match the Shipyard above it (both share this 75% column)
                     rather than the full width of the panel, so it reads as belonging to the
                     Shipyard specifically. -->
                {#if corporation}
                    <CorporationInfoBox
                        {corporationId}
                        treasury={corporation.treasury}
                        pendingCost={selectedLevels.reduce((sum, level) => sum + shipCost(level), 0)}
                        cargo={corporation.cargo}
                        cargoGain={incomingCargo}
                        {currentPayout}
                        {futurePayout}
                    >
                        <!-- Forced Purchase's own "No Credits?" Loans (rulebook pages 16-17 &
                             25) replaces Purchase Ships/Clear entirely here, per the co-designer
                             - this Corporation has no Ships and can't afford one outright, so
                             there's nothing queued to Purchase or Clear in the first place. -->
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
                        {:else}
                            <button
                                type="button"
                                disabled={purchasing || selectedLevels.length === 0}
                                onclick={purchaseShips}
                                class="rounded-md bg-[#2f6fed] px-2.5 py-1 text-xs font-semibold hover:bg-[#3f7dfa] disabled:opacity-50"
                            >
                                {purchasing ? 'Purchasing…' : 'Purchase Ships'}
                            </button>
                            <button
                                type="button"
                                disabled={purchasing || selectedLevels.length === 0}
                                onclick={clearQueue}
                                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1 text-xs hover:border-[#2f6fed] hover:bg-[#212845] disabled:opacity-50"
                            >
                                Clear
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
                 into an abstract count. queuedLevels previews Ships clicked but not yet submitted
                 (see selectedLevels/purchaseShips above). -->
            <div class="relative" style="width: 25%; aspect-ratio: {CHARTER_ASPECT};">
                <CorporationCharterWithPowers {corporationId} queuedLevels={selectedLevels} />
            </div>
        </div>

        {#if !isMe}
            <div class="text-xs text-[#7f88ad]">
                Waiting on {#if presidentId}<PlayerName playerId={presidentId} />{:else}the President{/if}
                to order Ships...
            </div>
        {/if}

        <!-- Hidden while purchasing (which now includes an auto-Decline as soon as the queue
             clears, below) - otherwise this would flash on screen and be clickable during that
             brief round-trip right after Purchase Ships, forcing a redundant confirmation the
             President just gave by clicking Purchase Ships in the first place. -->
        {#if isMe && canDecline && selectedLevels.length === 0 && !purchasing}
            <button
                type="button"
                onclick={stopOrdering}
                class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-2.5 py-1.5 text-xs hover:border-[#2f6fed] hover:bg-[#212845]"
            >
                Done Ordering Ships
            </button>
        {/if}

        {#if isMe && canLeakedResearch && !purchasing && !leakedResearchConfirming}
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

        {#if isMe && selectedLevels.length === 0 && otherActionTypes.length > 0 && !purchasing}
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
