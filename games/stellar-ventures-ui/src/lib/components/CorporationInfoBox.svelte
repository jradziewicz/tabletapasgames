<script lang="ts">
    import type { Snippet } from 'svelte'
    import { ExpandNetworkOutpostCosts, type CorporationId } from '@tabletop/stellar-ventures'
    import {
        CorporationDisplayNames,
        CorporationLogoIcons,
        CorporationLogoAspect,
        CorporationOutpostIcons,
        CorporationAgreementTokenIcons
    } from '$lib/utils/corporationDisplay.js'
    import { ShipLevelIcons, ShipAspect } from '$lib/utils/shipDisplay.js'
    import CreditsIcon from './CreditsIcon.svelte'
    import OutpostIcon from './OutpostIcon.svelte'

    // At or below this many unbuilt Outposts left, the Outposts row shows one icon per piece;
    // above it, a "N [icon]" count.
    const OUTPOST_ICONS_SHOWN_INDIVIDUALLY_MAX = 5

    // The rulebook's Expand Network cost table (pages 12-13), keyed by however many Outposts
    // are built in one action - the same ExpandNetworkOutpostCosts ExpandNetworkPanel itself
    // reads for the live running total, shown here instead as a fixed at-a-glance legend.
    const outpostCostTiers = Object.keys(ExpandNetworkOutpostCosts)
        .map(Number)
        .sort((a, b) => a - b)

    // A small "who/what this action bar is currently acting on" card - name, logo, Treasury
    // (with a live "(-X)" preview of a cost this in-progress action has accumulated but not yet
    // actually charged - e.g. Expand Network's deferred lump sum, or Order Ships' still-queued
    // total), and optionally Mining Capacity (Expand Network only - Order Ships has no use for
    // it). Shared so every action bar that acts on one Corporation shows it the same way rather
    // than each re-implementing its own version.
    let {
        corporationId,
        treasury,
        pendingCost = 0,
        miningCapacity,
        miningCapacityGain = 0,
        cargo,
        cargoGain = 0,
        currentPayout,
        futurePayout,
        taxDue,
        availableShareCount,
        statusLabel,
        remainingOutposts,
        shipLevels,
        shipLevelsLabel = 'Ships',
        voteMarkers,
        showOutpostCostTable = false,
        hasNotSignedAgreement = false,
        outpostSacrificeHighlightCount = 0,
        onOutpostSacrificeClick,
        children
    }: {
        corporationId: CorporationId
        treasury: number
        pendingCost?: number
        miningCapacity?: number
        // Mining Capacity already gained THIS Expand Network action (from Outposts already
        // built on hexes with a Mining value), shown as a live "(+X)" next to the original
        // figure rather than folded into it, so the President can see both what they started
        // with and what this build has added so far.
        miningCapacityGain?: number
        // Current CARGO (Order Ships only - Expand Network has no use for it). Undefined skips
        // the row entirely.
        cargo?: number
        // CARGO still incoming but not yet actually on the Charter - the sum of every Ship
        // sitting in Ordered (not yet Delivered), both already-ordered ones and whatever's
        // freshly queued this action, clamped exactly like deliverOrderedShips itself clamps at
        // MAX_CARGO (so this never promises more than Delivery will actually pay out). Shown as
        // a live "(+X)" next to the current figure, same treatment as miningCapacityGain.
        cargoGain?: number
        // Dividend per Share this Corporation would pay out right now, at its current Cargo/
        // Mining Capacity (Order Ships only - Expand Network has no use for it, since Outposts
        // don't feed into Cargo). Undefined skips the row entirely.
        currentPayout?: number
        // What that same per-Share payout would become once every Ship currently Ordered (plus
        // whatever's freshly queued this action) actually gets Delivered next Administration
        // Round - i.e. dividendPayoutPerShare read off the future, post-Delivery Cargo instead
        // of the current one. Shown as a live "(+<CreditsIcon/>X)" gain next to the current
        // figure, in green, only when it's actually higher than currentPayout.
        futurePayout?: number
        // Tax this Corporation currently owes per Tax Payment, per operations/taxes.ts's
        // taxDueForCorporation - Borders & Taxes map only (undefined on Alpha, since there are
        // no Tax Zones to owe anything to). Undefined skips the row entirely.
        taxDue?: number
        // Shares still available to issue (Corporation.availableShareCount) - undefined skips
        // the row entirely.
        availableShareCount?: number
        // The Private/Minor/Major display label (see corporationDisplay.ts) - undefined skips
        // the row entirely.
        statusLabel?: string
        // This Corporation's own physical Outpost supply still in the box (model/corporation.ts's
        // unbuiltOutposts) - shown as one small icon per Outpost still available, the same
        // "supply as individual pieces" treatment the Shipyard gives Ships. Omitted (Order Ships)
        // when this action has nothing to do with Outposts. Undefined skips the row entirely;
        // pass 0 to show the row with none left.
        remainingOutposts?: number
        // This Corporation's own currently Delivered Ships (Corporation.deliveredShipLevels -
        // the Ships actually generating Cargo right now, not still-Ordered ones), shown as one
        // real Ship icon per Ship, right on the same row as remainingOutposts above rather than
        // a separate row - the co-designer wants Outposts and Ships read together as "what this
        // Corporation actually has out on the board/board-adjacent supply right now", not two
        // stacked lists. Only rendered when remainingOutposts is also given (currently just the
        // Issue Share step - ShareAuctionPanel.svelte); undefined skips it entirely for every
        // other caller, same as every other optional row here.
        shipLevels?: number[]
        // Label for the shipLevels row - "Ships" by default; Order Ships passes "Ordered" since
        // what it shows there is this Corporation's Ordered (not yet Delivered) Ships.
        shipLevelsLabel?: string
        // Votes already placed on this Corporation this Boardroom Battle, plus the current
        // voter's own still-queued preview (queued: true, ringed) - one entry per token, each
        // pre-resolved to its player's own vote-token icon by the caller (BoardroomBattlePanel),
        // so this component stays agnostic of players/colors. Same "supply as individual pieces"
        // treatment as remainingOutposts above. Undefined skips the row entirely; an empty array
        // shows the row with none cast yet.
        voteMarkers?: { key: string; src: string; queued?: boolean }[]
        // A fixed reference legend for Expand Network's own cost table (1 Outpost = <CreditsIcon
        // /> ExpandNetworkOutpostCosts[1], 2 = [2], etc.) - shown below the Outposts supply row,
        // Expand Network only.
        showOutpostCostTable?: boolean
        // The co-designer's own colored handshake token (AgreementPanel.svelte's own "has not
        // signed The Agreement yet" marker - see CorporationAgreementTokenIcons) shown in the top
        // row, right next to this Corporation's logo - Boardroom Battle only, so voters can see
        // at a glance which candidates still haven't signed without switching to the Agreement
        // tab. False (the default) skips it entirely for every other caller of this shared box.
        // Amethyst Agency has no token at all (the rules never let it sign), so this naturally
        // renders nothing for it even when true.
        hasNotSignedAgreement?: boolean
        // Alien Alchemist (Corporate Power Glossary, page 29): "remove 2 unbuilt Outposts... gaining
        // 1 Alien Technology Cube" - while the President is deciding whether to use it
        // (ExpandNetworkPanel.svelte's own picking mode), this highlights the first N of the
        // remainingOutposts icons above with the same pulsing glow queued Ships/Votes get
        // elsewhere, and makes them clickable (onOutpostSacrificeClick fires on ANY click among
        // them, since the 2 Outposts it removes are fungible - there's nothing to distinguish
        // "which" 2 got picked). 0 (the default) highlights nothing and renders the row exactly
        // as before.
        outpostSacrificeHighlightCount?: number
        onOutpostSacrificeClick?: () => void
        // Rendered in the box's own open space, to the right of the name/stats - e.g. Order
        // Ships' Purchase Ships/Clear buttons (see OrderShipPanel.svelte). Omitted entirely
        // (Expand Network) when there's nothing to act on from right here.
        children?: Snippet
    } = $props()

    const logoAspect = $derived(CorporationLogoAspect[corporationId] ?? 1)
    const agreementBadgeIcon = $derived(
        hasNotSignedAgreement ? CorporationAgreementTokenIcons[corporationId] : undefined
    )
</script>

<!-- flex/h-full/w-full only below sm: (see BoardroomBattlePanel's 2-col grid) so this box
     can stretch to match its row-mate's height on a narrow phone width, where the grid
     never drops to 1 column. At sm: and up this reverts to a plain, content-sized block
     (no flex/height/width overrides) - the original desktop sizing every other caller
     (ShareAuctionPanel, ExpandNetworkPanel, OrderShipPanel, InvestorActionPanel) already
     relies on, so a definite/fixed-width ancestor there is never forced open by this box. -->
<div class="max-sm:flex max-sm:h-full max-sm:w-full max-sm:flex-col rounded-lg border border-[#2a3155] bg-[#12162b] px-3 py-2">
    <div class="flex items-center gap-3">
        <img
            src={CorporationLogoIcons[corporationId]}
            alt=""
            class="h-8 shrink-0 drop-shadow"
            style="width: {32 * logoAspect}px;"
        />
        <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-[#e6e9f5]">
                {CorporationDisplayNames[corporationId]}
            </div>
            <div class="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#c3c9e6]">
                <span>
                    Treasury: <CreditsIcon />{treasury}
                    {#if pendingCost > 0}
                        <span class="font-semibold text-[#e0343a]">(-{pendingCost})</span>
                    {/if}
                </span>
                {#if miningCapacity !== undefined}
                    <span>
                        Mining Capacity: {miningCapacity}
                        {#if miningCapacityGain > 0}
                            <span class="font-semibold text-[#3ddc84]">(+{miningCapacityGain})</span>
                        {/if}
                    </span>
                {/if}
                {#if cargo !== undefined}
                    <span>
                        Cargo: {cargo}
                        {#if cargoGain > 0}
                            <span class="font-semibold text-[#3ddc84]">(+{cargoGain})</span>
                        {/if}
                    </span>
                {/if}
                {#if currentPayout !== undefined}
                    <span>
                        Payout: <CreditsIcon />{currentPayout}
                        {#if futurePayout !== undefined && futurePayout > currentPayout}
                            <span class="font-semibold text-[#3ddc84]">(+<CreditsIcon color="green" />{futurePayout - currentPayout})</span>
                        {/if}
                    </span>
                {/if}
                {#if taxDue !== undefined}
                    <span>Taxes: <CreditsIcon />{taxDue}</span>
                {/if}
                {#if availableShareCount !== undefined}
                    <span>Shares Remaining: {availableShareCount}</span>
                {/if}
                {#if statusLabel !== undefined}
                    <!-- Full-width spacer forces Status onto a line of its own in every box, so
                         the boxes line up with each other instead of Status landing on line one
                         in a box with fewer stats and on line two in the rest. -->
                    <span class="basis-full h-0" aria-hidden="true"></span>
                    <span>Status: {statusLabel}</span>
                {/if}
                {#if agreementBadgeIcon}
                    <!-- Sits right after the last stat, in the same wrapping flex row - NOT
                         pinned to the box's far right edge (that previously came from being a
                         sibling of the flex-1 stats div, which pushed it out to the end of the
                         whole row) - the co-designer wants it read as one more at-a-glance stat,
                         not a separate right-aligned badge. -->
                    <span
                        class="flex shrink-0 items-center gap-1"
                        title="Has not signed The Agreement"
                    >
                        <img
                            src={agreementBadgeIcon}
                            alt="Has not signed The Agreement"
                            class="h-6 w-auto shrink-0 drop-shadow"
                        />
                        <span class="text-[10px] text-[#7f88ad]">(unsigned)</span>
                    </span>
                {/if}
            </div>
        </div>
        {#if children}
            <div class="flex shrink-0 items-center gap-2">
                {@render children()}
            </div>
        {/if}
    </div>

    {#if remainingOutposts !== undefined || shipLevels !== undefined}
        <!-- One small icon per Outpost still in this Corporation's own physical supply - wraps
             onto as many lines as it needs, since that supply runs 15-25 pieces
             (OutpostSupplyByCorporationId), far more than fits on one line. Ships (shipLevels),
             when given, share this exact same row rather than getting a separate one - see
             shipLevels' own prop comment. Either half can appear on its own (Order Ships passes
             only shipLevels). -->
        <div class="mt-2 flex flex-wrap items-center gap-1 border-t border-[#232945] pt-2">
          {#if remainingOutposts !== undefined}
            <span class="mr-1 shrink-0 text-[10px] uppercase tracking-widest text-[#7f88ad]">
                Outposts:
            </span>
            {#if remainingOutposts > OUTPOST_ICONS_SHOWN_INDIVIDUALLY_MAX}
                <!-- Big supply: a count then one icon instead of 15-25 separate pieces. Once it
                     is down to a handful (see the constant above) each one is shown again.
                     Alien Alchemist's sacrifice pick keeps working - the icon takes on the same
                     pulsing glow and click handler the individual icons would have had. -->
                {@const sacrificing = outpostSacrificeHighlightCount > 0}
                <span class="inline-flex items-center gap-1">
                    <span class="text-sm font-semibold text-[#e6e9f5]">{remainingOutposts}</span>
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <img
                        src={CorporationOutpostIcons[corporationId]}
                        alt={sacrificing ? 'Sacrifice Outposts for Alien Alchemist' : ''}
                        class="h-6 w-6 shrink-0 object-contain {sacrificing
                            ? 'alien-alchemist-sacrifice-outpost cursor-pointer'
                            : 'drop-shadow'}"
                        onclick={sacrificing ? onOutpostSacrificeClick : undefined}
                    />
                </span>
            {:else if remainingOutposts > 0}
                {#each { length: remainingOutposts } as _, index (index)}
                    {@const highlighted = index < outpostSacrificeHighlightCount}
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <img
                        src={CorporationOutpostIcons[corporationId]}
                        alt={highlighted ? 'Sacrifice this Outpost for Alien Alchemist' : ''}
                        class="h-6 w-6 shrink-0 object-contain {highlighted
                            ? 'alien-alchemist-sacrifice-outpost cursor-pointer'
                            : 'drop-shadow'}"
                        onclick={highlighted ? onOutpostSacrificeClick : undefined}
                    />
                {/each}
            {:else}
                <span class="text-[10px] text-[#7f88ad]">None left</span>
            {/if}
          {/if}
            {#if shipLevels !== undefined}
                <span
                    class="{remainingOutposts !== undefined ? 'ml-3' : ''} mr-1 shrink-0 text-[10px] uppercase tracking-widest text-[#7f88ad]"
                >
                    {shipLevelsLabel}:
                </span>
                {#if shipLevels.length > 0}
                    {#each shipLevels as level, index (index)}
                        <img
                            src={ShipLevelIcons[level]}
                            alt="Level {level} Ship"
                            class="h-6 shrink-0 object-contain drop-shadow"
                            style="width: {1.5 * (ShipAspect[level] ?? 1)}rem;"
                        />
                    {/each}
                {:else}
                    <span class="text-[10px] text-[#7f88ad]">None yet</span>
                {/if}
            {/if}
        </div>
    {/if}

    {#if voteMarkers !== undefined}
        <!-- Same "supply as individual pieces" treatment as the Outposts row above, but for
             Votes cast on this Corporation this Boardroom Battle (see BoardroomBattlePanel.svelte) -
             each token pre-resolved to its own player's vote-token icon by the caller. -->
        <div class="mt-2 flex flex-wrap items-center gap-1 border-t border-[#232945] pt-2">
            <span class="mr-1 shrink-0 text-[10px] uppercase tracking-widest text-[#7f88ad]">
                Votes:
            </span>
            {#if voteMarkers.length > 0}
                {#each voteMarkers as marker (marker.key)}
                    <!-- Same "not yet actually submitted" pulsing glow the queued Ship on the
                         Charter/Shipyard gets (see CorporationCharter.svelte's
                         .charter-queued-ship) - drop-shadow follows this token's own silhouette
                         rather than a rectangle/circle traced around its bounding box. -->
                    <img
                        src={marker.src}
                        alt="Vote"
                        class="h-6 w-6 shrink-0 object-contain {marker.queued
                            ? 'queued-vote-marker'
                            : 'drop-shadow'}"
                    />
                {/each}
            {:else}
                <span class="text-[10px] text-[#7f88ad]">No votes yet</span>
            {/if}
        </div>
    {/if}

    {#if showOutpostCostTable}
        <!-- The rulebook's fixed Expand Network price tiers, read as a picture rather than a
             sentence: "<count> Outposts <OutpostIcon/> = <CreditsIcon/><cost>" for each tier. -->
        <div
            class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#232945] pt-2 text-xs text-[#c3c9e6]"
        >
            <span class="mr-1 shrink-0 text-[10px] uppercase tracking-widest text-[#7f88ad]">
                Outpost Costs:
            </span>
            {#each outpostCostTiers as count (count)}
                <span class="inline-flex items-center gap-1 whitespace-nowrap">
                    {count}<OutpostIcon /> = <CreditsIcon />{ExpandNetworkOutpostCosts[count]}
                </span>
            {/each}
        </div>
    {/if}
</div>

<style>
    /* Mirrors CorporationCharter.svelte's .charter-queued-ship / ShipyardPanel.svelte's
       .shipyard-orderable-ship exactly (same colors, same timing) - duplicated here rather than
       shared/imported since Svelte component styles are scoped per-file. */
    .queued-vote-marker {
        animation: queued-vote-marker-pulse 1.8s ease-in-out infinite;
    }
    @keyframes queued-vote-marker-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(61, 220, 132, 0.95)) drop-shadow(0 0 5px rgba(61, 220, 132, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 3px rgba(61, 220, 132, 1)) drop-shadow(0 0 9px rgba(61, 220, 132, 0.85));
        }
    }

    /* Same pulsing glow, same color family - the Alien Alchemist picking flow's own
       "click one of these to confirm" affordance (see ExpandNetworkPanel.svelte). */
    .alien-alchemist-sacrifice-outpost {
        animation: alien-alchemist-sacrifice-outpost-pulse 1.8s ease-in-out infinite;
    }
    @keyframes alien-alchemist-sacrifice-outpost-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(61, 220, 132, 0.95)) drop-shadow(0 0 5px rgba(61, 220, 132, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 3px rgba(61, 220, 132, 1)) drop-shadow(0 0 9px rgba(61, 220, 132, 0.85));
        }
    }
</style>
